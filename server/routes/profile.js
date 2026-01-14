import express from 'express'
import bcrypt from 'bcryptjs'
import { body, validationResult } from 'express-validator'
import { authenticateToken } from '../middleware/auth.js'
import { 
  getUserById, 
  updateUserProfile, 
  updateUserAvatar, 
  updateUserPassword,
  getUserByEmail 
} from '../database.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads', 'avatars')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, `avatar-${req.user.userId}-${uniqueSuffix}${path.extname(file.originalname)}`)
  }
})

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)
    
    if (extname && mimetype) {
      return cb(null, true)
    } else {
      cb(new Error('Only image files are allowed'))
    }
  }
})

// Get current user profile
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = await getUserById(req.user.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at,
      },
    })
  } catch (error) {
    console.error('Get profile error:', error)
    res.status(500).json({ error: 'Failed to get profile' })
  }
})

// Update profile (name, email)
router.put('/',
  authenticateToken,
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('email').optional().isEmail().withMessage('Valid email is required'),
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

      const { name, email } = req.body

      // Check if email is already taken by another user
      if (email) {
        const existingUser = await getUserByEmail(email)
        if (existingUser && existingUser.id !== req.user.userId) {
          return res.status(400).json({ error: 'Email is already in use' })
        }
      }

      const updatedUser = await updateUserProfile(req.user.userId, { name, email })
      
      res.json({
        message: 'Profile updated successfully',
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          avatarUrl: updatedUser.avatar_url,
        },
      })
    } catch (error) {
      console.error('Update profile error:', error)
      res.status(500).json({ error: 'Failed to update profile' })
    }
  }
)

// Upload avatar
router.post('/avatar', 
  authenticateToken, 
  upload.single('avatar'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' })
      }

      // Get current user to delete old avatar if exists
      const currentUser = await getUserById(req.user.userId)
      if (currentUser && currentUser.avatar_url && currentUser.avatar_url.startsWith('/api/uploads/')) {
        const oldAvatarPath = path.join(__dirname, '..', currentUser.avatar_url.replace('/api/', ''))
        if (fs.existsSync(oldAvatarPath)) {
          fs.unlinkSync(oldAvatarPath)
        }
      }

      // Construct the avatar URL
      const avatarUrl = `/api/uploads/avatars/${req.file.filename}`
      
      await updateUserAvatar(req.user.userId, avatarUrl)

      res.json({
        message: 'Avatar uploaded successfully',
        avatarUrl,
      })
    } catch (error) {
      console.error('Upload avatar error:', error)
      // Clean up uploaded file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path)
      }
      res.status(500).json({ error: error.message || 'Failed to upload avatar' })
    }
  }
)

// Remove avatar
router.delete('/avatar', authenticateToken, async (req, res) => {
  try {
    const currentUser = await getUserById(req.user.userId)
    
    // Delete the avatar file if it exists
    if (currentUser && currentUser.avatar_url && currentUser.avatar_url.startsWith('/api/uploads/')) {
      const avatarPath = path.join(__dirname, '..', currentUser.avatar_url.replace('/api/', ''))
      if (fs.existsSync(avatarPath)) {
        fs.unlinkSync(avatarPath)
      }
    }

    await updateUserAvatar(req.user.userId, null)

    res.json({ message: 'Avatar removed successfully' })
  } catch (error) {
    console.error('Remove avatar error:', error)
    res.status(500).json({ error: 'Failed to remove avatar' })
  }
})

// Change password
router.put('/password',
  authenticateToken,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
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

      const { currentPassword, newPassword } = req.body

      // Get current user
      const user = await getUserById(req.user.userId)
      if (!user) {
        return res.status(404).json({ error: 'User not found' })
      }

      // Check if user has a password (not Google OAuth only)
      if (!user.password_hash) {
        return res.status(400).json({ 
          error: 'Cannot change password for accounts created with Google Sign-In' 
        })
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash)
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' })
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 10)
      
      // Update password
      await updateUserPassword(req.user.userId, newPasswordHash)

      res.json({ message: 'Password changed successfully' })
    } catch (error) {
      console.error('Change password error:', error)
      res.status(500).json({ error: 'Failed to change password' })
    }
  }
)

export default router
