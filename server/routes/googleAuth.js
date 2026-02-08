import express from 'express'
import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'
import { createOrUpdateGoogleUser, getUserByGoogleId } from '../database.js'
import logger from '../utils/logger.js'

const router = express.Router()

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID

// Google OAuth callback - verifies ID token server-side
router.post('/callback', async (req, res) => {
  try {
    const { credential } = req.body

    if (!credential) {
      return res.status(400).json({ error: 'Google credential token is required' })
    }

    if (!GOOGLE_CLIENT_ID) {
      logger.error('Google OAuth: GOOGLE_CLIENT_ID not configured')
      return res.status(500).json({ error: 'Google OAuth is not configured' })
    }

    // Verify the Google ID token server-side
    const client = new OAuth2Client(GOOGLE_CLIENT_ID)
    let ticket
    try {
      ticket = await client.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      })
    } catch (verifyError) {
      logger.warn('Google OAuth: Invalid ID token', { error: verifyError.message })
      return res.status(401).json({ error: 'Invalid Google credential' })
    }

    const payload = ticket.getPayload()
    if (!payload || !payload.sub || !payload.email) {
      return res.status(401).json({ error: 'Invalid Google token payload' })
    }

    const googleId = payload.sub
    const email = payload.email
    const name = payload.name || email.split('@')[0]
    const avatarUrl = payload.picture || null

    // Verify email is verified by Google
    if (!payload.email_verified) {
      return res.status(401).json({ error: 'Google email not verified' })
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
      error: error.message,
      stack: error.stack
    })
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
