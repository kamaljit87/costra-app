import express from 'express'
import jwt from 'jsonwebtoken'
import { createOrUpdateGoogleUser, getUserByGoogleId } from '../database.js'
import logger from '../utils/logger.js'

const router = express.Router()

// Google OAuth callback
router.post('/callback', async (req, res) => {
  try {
    const { googleId, name, email, avatarUrl } = req.body

    if (!googleId || !email) {
      return res.status(400).json({ error: 'Google ID and email are required' })
    }

    // Create or update user
    const userId = await createOrUpdateGoogleUser(googleId, name, email, avatarUrl)

    // Get user data
    const user = await getUserByGoogleId(googleId)

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({
      message: 'Google authentication successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatar_url,
      },
    })
  } catch (error) {
    logger.error('Google auth error', { 
      googleId: req.body?.googleId, 
      email: req.body?.email, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

export default router
