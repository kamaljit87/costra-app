import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { createUser, getUserByEmail, getUserById } from '../database.js'
import { authenticateToken } from '../middleware/auth.js'
import { authLimiter } from '../middleware/rateLimiter.js'
import { validateSignup, validateLogin } from '../middleware/validator.js'
import logger from '../utils/logger.js'

const router = express.Router()

// Auth rate limiter removed - no rate limiting for authentication endpoints
// router.use(authLimiter)

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Create a new user account
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: SecurePassword123!
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error or user already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/signup',
  validateSignup,
  async (req, res) => {
    try {
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
      logger.error('Signup error', {
        requestId: req.requestId,
        email: req.body.email,
        error: error.message,
        stack: error.stack,
        code: error.code,
      })
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

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePassword123!
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/login',
  validateLogin,
  async (req, res) => {
    try {
      const { email, password } = req.body

      // Email is already normalized by validateLogin middleware
      // But ensure it's lowercase for database lookup (PostgreSQL is case-sensitive by default)
      const normalizedEmail = email.toLowerCase().trim()

      logger.debug('Login attempt', {
        requestId: req.requestId,
        email: normalizedEmail,
        emailLength: normalizedEmail.length,
      })

      // Find user
      let user
      try {
        user = await getUserByEmail(normalizedEmail)
      } catch (dbError) {
        logger.error('Database error in login', {
          requestId: req.requestId,
          email: normalizedEmail,
          error: dbError.message,
          stack: dbError.stack,
        })
        return res.status(500).json({ error: 'Database connection error. Please try again later.' })
      }
      
      if (!user) {
        logger.warn('Login attempt with non-existent email', {
          requestId: req.requestId,
          email: normalizedEmail,
        })
        return res.status(401).json({ error: 'Invalid credentials' })
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash)
      if (!isValidPassword) {
        logger.warn('Login attempt with incorrect password', {
          requestId: req.requestId,
          email: normalizedEmail,
          userId: user.id,
        })
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
      logger.error('Login error', {
        requestId: req.requestId,
        email: req.body.email,
        error: error.message,
        stack: error.stack,
      })
      // Provide more specific error messages
      if (error.message && error.message.includes('database')) {
        return res.status(500).json({ error: 'Database error. Please check your database connection.' })
      }
      res.status(500).json({ error: error.message || 'Internal server error' })
    }
  }
)

// Get current user
/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user information
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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
    logger.error('Get user error', {
      requestId: req.requestId,
      userId: req.user?.userId || req.user?.id,
      error: error.message,
      stack: error.stack,
    })
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
    logger.error('Refresh token error', {
      requestId: req.requestId,
      userId: req.user?.userId || req.user?.id,
      error: error.message,
      stack: error.stack,
    })
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

export default router
