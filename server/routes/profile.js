import express from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { body, validationResult } from 'express-validator'
import { authenticateToken } from '../middleware/auth.js'
import logger from '../utils/logger.js'
import {
  getUserById,
  updateUserProfile,
  updateUserAvatar,
  updateUserPassword,
  getUserByEmail,
  createNotification,
  createEmailChangeRequest,
  verifyEmailChangeToken,
  cancelEmailChangeByToken,
} from '../database.js'
import { sendTransactionalEmail } from '../services/emailService.js'
import {
  emailChangeVerifyTemplate,
  emailChangeNotifyTemplate,
  emailChangedConfirmTemplate,
  passwordChangedTemplate,
} from '../services/emailTemplates.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

const serverRoot = path.resolve(__dirname, '..')

/** Resolve an avatar DB path to a safe filesystem path, or null if it escapes the server root */
function safeAvatarPath(avatarUrl) {
  const relative = avatarUrl.replace('/api/', '')
  const resolved = path.resolve(serverRoot, relative)
  if (!resolved.startsWith(serverRoot + path.sep)) return null
  return resolved
}

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
        isAdmin: user.is_admin || false,
      },
    })
  } catch (error) {
    logger.error('Get profile error', { 
      userId: req.user?.userId || req.user?.id, 
      error: error.message, 
      stack: error.stack 
    })
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
      const userId = req.user.userId

      // If email is changing, go through verification flow
      if (email) {
        const currentUser = await getUserById(userId)
        if (currentUser && email.toLowerCase() !== currentUser.email.toLowerCase()) {
          const existingUser = await getUserByEmail(email)
          if (existingUser && existingUser.id !== userId) {
            return res.status(400).json({ error: 'Email is already in use' })
          }

          // Generate tokens for verify (new email) and cancel (old email)
          const verifyToken = crypto.randomBytes(32).toString('hex')
          const verifyHash = crypto.createHash('sha256').update(verifyToken).digest('hex')
          const cancelToken = crypto.randomBytes(32).toString('hex')
          const cancelHash = crypto.createHash('sha256').update(cancelToken).digest('hex')
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

          await createEmailChangeRequest(userId, email, verifyHash, cancelHash, expiresAt)

          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
          const verifyUrl = `${frontendUrl}/verify-email-change?token=${verifyToken}`
          const cancelUrl = `${frontendUrl}/cancel-email-change?token=${cancelToken}`

          // Send verification to new email
          sendTransactionalEmail({
            to: email,
            subject: 'Verify Your New Email — Costra',
            html: emailChangeVerifyTemplate(currentUser.name, email, verifyUrl),
          }).catch((e) => logger.error('Failed to send email change verification', { error: e.message }))

          // Send notification to old email
          sendTransactionalEmail({
            to: currentUser.email,
            subject: 'Email Change Requested — Costra',
            html: emailChangeNotifyTemplate(currentUser.name, email, cancelUrl),
          }).catch((e) => logger.error('Failed to send email change notification', { error: e.message }))

          // If only email is changing (no name change), return early with pending message
          if (!name || name === currentUser.name) {
            return res.json({
              message: 'A verification email has been sent to your new email address. Please verify to complete the change.',
              emailChangePending: true,
              user: {
                id: currentUser.id,
                name: currentUser.name,
                email: currentUser.email,
                avatarUrl: currentUser.avatar_url,
              },
            })
          }
        }
      }

      // Update name only (email change goes through verification)
      const updatedUser = await updateUserProfile(userId, { name })

      // Create notification for profile update
      try {
        await createNotification(userId, {
          type: 'info',
          title: 'Profile Updated',
          message: email ? 'Name updated. A verification email has been sent for your email change.' : 'Your profile information has been updated successfully',
          link: '/settings',
          linkText: 'View Settings'
        })
      } catch (notifError) {
        logger.error('Profile: Failed to create notification', {
          userId,
          error: notifError.message
        })
      }

      res.json({
        message: email ? 'Name updated. Please check your new email to verify the email change.' : 'Profile updated successfully',
        emailChangePending: !!email,
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          avatarUrl: updatedUser.avatar_url,
        },
      })
    } catch (error) {
      logger.error('Update profile error', {
        userId: req.user?.userId,
        error: error.message,
        stack: error.stack
      })
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
        const oldAvatarPath = safeAvatarPath(currentUser.avatar_url)
        if (oldAvatarPath && fs.existsSync(oldAvatarPath)) {
          fs.unlinkSync(oldAvatarPath)
        }
      }

      // Construct the avatar URL
      const avatarUrl = `/api/uploads/avatars/${req.file.filename}`
      
      await updateUserAvatar(req.user.userId, avatarUrl)

      // Create notification for avatar upload
      try {
        await createNotification(req.user.userId, {
          type: 'success',
          title: 'Avatar Updated',
          message: 'Your profile picture has been updated successfully',
          link: '/settings',
          linkText: 'View Settings'
        })
      } catch (notifError) {
        logger.error('Profile: Failed to create notification', {
          userId: req.user.userId,
          error: notifError.message
        })
      }

      res.json({
        message: 'Avatar uploaded successfully',
        avatarUrl,
      })
    } catch (error) {
      logger.error('Upload avatar error', {
        userId: req.user?.userId,
        error: error.message,
        stack: error.stack
      })
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
      const avatarPath = safeAvatarPath(currentUser.avatar_url)
      if (avatarPath && fs.existsSync(avatarPath)) {
        fs.unlinkSync(avatarPath)
      }
    }

    await updateUserAvatar(req.user.userId, null)

    res.json({ message: 'Avatar removed successfully' })
  } catch (error) {
    logger.error('Remove avatar error', { 
      userId: req.user?.userId || req.user?.id, 
      error: error.message, 
      stack: error.stack 
    })
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

      // Create notification for password change
      try {
        await createNotification(req.user.userId, {
          type: 'success',
          title: 'Password Changed',
          message: 'Your password has been changed successfully. If you did not make this change, please contact support immediately.',
          link: '/settings',
          linkText: 'View Settings'
        })
      } catch (notifError) {
        logger.error('Profile: Failed to create notification', {
          userId: req.user.userId,
          error: notifError.message
        })
      }

      // Send password changed email (fire-and-forget)
      sendTransactionalEmail({
        to: user.email,
        subject: 'Password Changed — Costra',
        html: passwordChangedTemplate(user.name),
      }).catch((e) => logger.error('Failed to send password changed email', { error: e.message }))

      res.json({ message: 'Password changed successfully' })
    } catch (error) {
      logger.error('Change password error', {
        userId: req.user?.userId,
        error: error.message,
        stack: error.stack
      })
      res.status(500).json({ error: 'Failed to change password' })
    }
  }
)

// Verify email change (from new email link — no auth required)
router.post('/verify-email-change', async (req, res) => {
  try {
    const { token } = req.body
    if (!token) {
      return res.status(400).json({ error: 'Token is required' })
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const changeReq = await verifyEmailChangeToken(tokenHash)
    if (!changeReq) {
      return res.status(400).json({ error: 'Invalid or expired verification link.' })
    }

    // Send confirmation to both old and new emails
    const user = await getUserById(changeReq.user_id)
    if (user) {
      const html = emailChangedConfirmTemplate(user.name)
      // Send to new email (now current)
      sendTransactionalEmail({ to: user.email, subject: 'Email Address Updated — Costra', html })
        .catch((e) => logger.error('Failed to send email changed confirm', { error: e.message }))
    }

    logger.info('Email change verified', { userId: changeReq.user_id, newEmail: changeReq.new_email })
    res.json({ message: 'Email address updated successfully!' })
  } catch (error) {
    logger.error('Email change verification error', { error: error.message })
    res.status(500).json({ error: 'Failed to verify email change' })
  }
})

// Cancel email change (from old email link — no auth required)
router.post('/cancel-email-change', async (req, res) => {
  try {
    const { token } = req.body
    if (!token) {
      return res.status(400).json({ error: 'Token is required' })
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const result = await cancelEmailChangeByToken(tokenHash)
    if (!result) {
      return res.status(400).json({ error: 'Invalid or expired cancellation link, or no pending change.' })
    }

    logger.info('Email change cancelled', { userId: result.user_id })
    res.json({ message: 'Email change cancelled. Your email address remains unchanged.' })
  } catch (error) {
    logger.error('Email change cancellation error', { error: error.message })
    res.status(500).json({ error: 'Failed to cancel email change' })
  }
})

export default router
