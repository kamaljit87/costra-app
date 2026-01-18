import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { body, validationResult } from 'express-validator'
import { createUser, getUserByEmail, getUserById } from '../database.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

// Signup endpoint
router.post('/signup',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: errors.array().map(e => e.msg).join(', '),
          errors: errors.array() 
        })
      }

      const { name, email, password } = req.body

      // Check if user already exists
      const existingUser = await getUserByEmail(email)
      if (existingUser) {
        return res.status(400).json({ error: 'User with this email already exists' })
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10)

      // Create user
      const userId = await createUser(name, email, passwordHash)

      // Generate JWT token
      const token = jwt.sign(
        { userId, email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      )

      // Get the created user to return full user object
      const user = await getUserByEmail(email)
      res.status(201).json({
        message: 'User created successfully',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatar_url,
        },
      })
    } catch (error) {
      console.error('Signup error:', error)
      // Provide more specific error messages
      if (error.code === '23505') { // PostgreSQL unique constraint violation
        return res.status(400).json({ error: 'User with this email already exists' })
      }
      if (error.message && error.message.includes('database')) {
        return res.status(500).json({ error: 'Database error. Please check your database connection.' })
      }
      res.status(500).json({ error: error.message || 'Internal server error' })
    }
  }
)

// Login endpoint
router.post('/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { email, password } = req.body

      // Find user
      let user
      try {
        user = await getUserByEmail(email)
      } catch (dbError) {
        console.error('Database error in login:', dbError)
        return res.status(500).json({ error: 'Database connection error. Please try again later.' })
      }
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' })
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash)
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' })
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      )

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatar_url,
        },
      })
    } catch (error) {
      console.error('Login error:', error)
      console.error('Login error stack:', error.stack)
      // Provide more specific error messages
      if (error.message && error.message.includes('database')) {
        return res.status(500).json({ error: 'Database error. Please check your database connection.' })
      }
      res.status(500).json({ error: error.message || 'Internal server error' })
    }
  }
)

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' })
    }
    const user = await getUserById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatar_url || null,
      },
    })
  } catch (error) {
    console.error('Get user error:', error)
    console.error('Get user error stack:', error.stack)
    // Return error but don't crash - let frontend handle gracefully
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

// Refresh token endpoint
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' })
    }
    
    const user = await getUserById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Generate new JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({
      message: 'Token refreshed successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatar_url || null,
      },
    })
  } catch (error) {
    console.error('Refresh token error:', error)
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

export default router
