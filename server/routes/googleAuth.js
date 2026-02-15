import express from 'express'
import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'
import { createOrUpdateGoogleUser, getUserByGoogleId } from '../database.js'
import logger from '../utils/logger.js'

const router = express.Router()

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const FRONTEND_URL = (process.env.FRONTEND_URL || '').replace(/\/$/, '')

async function verifyGoogleIdToken(idToken) {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID not configured')
  }
  const client = new OAuth2Client(GOOGLE_CLIENT_ID)
  const ticket = await client.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  })
  return ticket.getPayload()
}

// Google OAuth callback - accepts either ID token (One Tap) or authorization code (redirect flow)
router.post('/callback', async (req, res) => {
  try {
    const { credential, code } = req.body

    let payload
    if (code) {
      // Redirect flow: exchange authorization code for tokens
      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        logger.error('Google OAuth: code flow requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET')
        return res.status(500).json({ error: 'Google OAuth is not configured for redirect flow' })
      }
      if (!FRONTEND_URL) {
        return res.status(500).json({ error: 'FRONTEND_URL is required for Google redirect flow' })
      }
      const redirectUri = `${FRONTEND_URL}/auth/google/callback`
      const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirectUri)
      let tokens
      try {
        const result = await client.getToken({ code, redirect_uri: redirectUri })
        tokens = result.tokens
      } catch (exchangeError) {
        const msg = exchangeError.message || ''
        logger.warn('Google OAuth: code exchange failed', { error: msg, redirectUri })
        // Google often returns redirect_uri_mismatch or invalid_grant - surface a clear message
        if (msg.includes('redirect_uri_mismatch') || msg.includes('redirect_uri')) {
          return res.status(400).json({
            error: 'Redirect URI mismatch. Set FRONTEND_URL to the exact site URL (e.g. https://costra.app) with no trailing slash, and add that callback URL in Google Cloud Console.',
          })
        }
        if (msg.includes('invalid_grant') || msg.includes('Token has been expired')) {
          return res.status(400).json({ error: 'Authorization expired. Please try signing in again.' })
        }
        return res.status(400).json({ error: 'Google sign-in failed. Try again or use email/password.' })
      }
      if (!tokens?.id_token) {
        return res.status(401).json({ error: 'No ID token in Google response' })
      }
      try {
        payload = await verifyGoogleIdToken(tokens.id_token)
      } catch (verifyError) {
        logger.warn('Google OAuth: Invalid ID token after code exchange', { error: verifyError.message })
        return res.status(401).json({ error: 'Invalid Google credential' })
      }
    } else if (credential) {
      // One Tap / popup: verify ID token directly
      if (!GOOGLE_CLIENT_ID) {
        logger.error('Google OAuth: GOOGLE_CLIENT_ID not configured')
        return res.status(500).json({ error: 'Google OAuth is not configured' })
      }
      try {
        payload = await verifyGoogleIdToken(credential)
      } catch (verifyError) {
        logger.warn('Google OAuth: Invalid ID token', { error: verifyError.message })
        return res.status(401).json({ error: 'Invalid Google credential' })
      }
    } else {
      return res.status(400).json({ error: 'Request must include credential (ID token) or code (authorization code)' })
    }

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
    const msg = error.message || ''
    if (msg.includes('JWT_SECRET') || msg.includes('secret')) {
      return res.status(500).json({ error: 'Server configuration error (JWT).' })
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
