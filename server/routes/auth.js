import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import {
  createUser,
  getUserByEmail,
  getUserById,
  recordMultipleConsents,
  get2FAStatus,
  setTOTPPending,
  getTOTPPending,
  confirmTOTPAndEnable,
  disableTOTP,
  getUserTOTPSecret,
} from '../database.js'
import { authenticateToken } from '../middleware/auth.js'
import { validateSignup, validateLogin } from '../middleware/validator.js'
import { createTrialSubscription } from '../services/subscriptionService.js'
import logger from '../utils/logger.js'

const JWT_2FA_PENDING_EXPIRY = '5m'

const router = express.Router()

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
      const { name, email, password, consentAccepted } = req.body

      // Require consent to Privacy Policy and Terms of Service (GDPR Art. 6 / DPDPA Sec. 6)
      if (!consentAccepted) {
        return res.status(400).json({ error: 'You must accept the Privacy Policy and Terms of Service to create an account' })
      }

      // Check if user already exists (generic message to prevent user enumeration)
      const existingUser = await getUserByEmail(email)
      if (existingUser) {
        return res.status(400).json({ error: 'Unable to create account with the provided information' })
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10)

      // Create user
      const createdUser = await createUser(name, email, passwordHash)
      const userId = createdUser.id

      // Record consent (GDPR/DPDPA compliance)
      try {
        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress
        const userAgent = req.headers['user-agent'] || ''
        await recordMultipleConsents(userId, [
          { consentType: 'privacy_policy', version: '1.0' },
          { consentType: 'terms_of_service', version: '1.0' },
          { consentType: 'data_processing', version: '1.0' },
        ], ipAddress, userAgent)
        logger.info('Consent recorded for new user', { userId, email })
      } catch (consentError) {
        logger.error('Failed to record consent', { userId, email, error: consentError.message })
      }

      // Create 7-day trial subscription
      try {
        await createTrialSubscription(userId)
        logger.info('Trial subscription created for new user', { userId, email })
      } catch (trialError) {
        logger.error('Failed to create trial subscription', { userId, email, error: trialError.message })
        // Don't fail signup if trial creation fails
      }

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
      if (error.code === '23505') { // PostgreSQL unique constraint violation
        return res.status(400).json({ error: 'Unable to create account with the provided information' })
      }
      if (error.message && error.message.includes('database')) {
        return res.status(500).json({ error: 'Database error. Please try again later.' })
      }
      res.status(500).json({ error: 'Internal server error' })
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

      // If 2FA is enabled, return a short-lived token for the 2FA verification step (use get2FAStatus so we match Settings logic)
      const twoFAStatus = await get2FAStatus(user.id)
      if (twoFAStatus?.enabled) {
        const tempToken = jwt.sign(
          { userId: user.id, email: user.email, purpose: '2fa_pending' },
          process.env.JWT_SECRET,
          { expiresIn: JWT_2FA_PENDING_EXPIRY }
        )
        return res.json({
          requires2fa: true,
          tempToken,
          message: 'Enter your authentication code',
        })
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
      if (error.message && error.message.includes('database')) {
        return res.status(500).json({ error: 'Database error. Please try again later.' })
      }
      res.status(500).json({ error: 'Internal server error' })
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
    res.status(500).json({ error: 'Internal server error' })
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
    res.status(500).json({ error: 'Internal server error' })
  }
})

// --- 2FA (TOTP) routes ---

/** Verify 2FA code after login and return full JWT */
router.post('/2fa/verify-login', async (req, res) => {
  try {
    const { tempToken, code } = req.body
    if (!tempToken || !code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Token and code are required' })
    }
    let payload
    try {
      payload = jwt.verify(tempToken, process.env.JWT_SECRET)
    } catch (e) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' })
    }
    if (payload.purpose !== '2fa_pending' || !payload.userId) {
      return res.status(401).json({ error: 'Invalid token' })
    }
    const secret = await getUserTOTPSecret(payload.userId)
    if (!secret) {
      return res.status(401).json({ error: 'Two-factor not enabled for this account' })
    }
    const valid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code.replace(/\s/g, ''),
      window: 1,
    })
    if (!valid) {
      return res.status(401).json({ error: 'Invalid or expired code' })
    }
    const user = await getUserById(payload.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
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
        avatarUrl: user.avatar_url || null,
      },
    })
  } catch (error) {
    logger.error('2FA verify-login error', { error: error.message, stack: error.stack })
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** Get current user's 2FA status (enabled or not) */
router.get('/2fa/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const status = await get2FAStatus(userId)
    if (!status) {
      return res.status(404).json({ error: 'User not found' })
    }
    res.json({ enabled: !!status.enabled })
  } catch (error) {
    logger.error('2FA status error', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** Start 2FA setup: generate secret, store pending, return QR data URL and secret for manual entry */
router.post('/2fa/setup', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const user = await getUserById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    const status = await get2FAStatus(userId)
    if (status?.enabled) {
      return res.status(400).json({ error: 'Two-factor authentication is already enabled' })
    }
    const secret = speakeasy.generateSecret({
      name: `Costra (${user.email})`,
      length: 20,
      issuer: 'Costra',
    })
    await setTOTPPending(userId, secret.base32)
    const otpauthUrl = secret.otpauth_url || speakeasy.otpauthURL({
      secret: secret.base32,
      label: user.email.replace(/@/g, '%40'),
      issuer: 'Costra',
      encoding: 'base32',
    })
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl)
    res.json({ secret: secret.base32, qrDataUrl })
  } catch (error) {
    logger.error('2FA setup error', { error: error.message, stack: error.stack })
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** Confirm 2FA setup with a code from the authenticator app */
router.post('/2fa/confirm', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { code } = req.body
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Code is required' })
    }
    const pendingSecret = await getTOTPPending(userId)
    if (!pendingSecret) {
      return res.status(400).json({ error: 'No 2FA setup in progress. Start setup again.' })
    }
    const valid = speakeasy.totp.verify({
      secret: pendingSecret,
      encoding: 'base32',
      token: code.replace(/\s/g, ''),
      window: 1,
    })
    if (!valid) {
      return res.status(401).json({ error: 'Invalid or expired code. Please try again.' })
    }
    const ok = await confirmTOTPAndEnable(userId)
    if (!ok) {
      return res.status(400).json({ error: 'Could not enable 2FA' })
    }
    res.json({ message: 'Two-factor authentication is now enabled' })
  } catch (error) {
    logger.error('2FA confirm error', { error: error.message, stack: error.stack })
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** Disable 2FA (requires current password) */
router.post('/2fa/disable', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { password, code } = req.body
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required to disable 2FA' })
    }
    const user = await getUserById(userId)
    if (!user || !user.password_hash) {
      return res.status(400).json({ error: 'Cannot disable 2FA for this account' })
    }
    const validPassword = await bcrypt.compare(password, user.password_hash)
    if (!validPassword) {
      return res.status(401).json({ error: 'Incorrect password' })
    }
    // Optionally require current TOTP code for extra security
    if (code) {
      const secret = await getUserTOTPSecret(userId)
      if (secret) {
        const validCode = speakeasy.totp.verify({
          secret,
          encoding: 'base32',
          token: String(code).replace(/\s/g, ''),
          window: 1,
        })
        if (!validCode) {
          return res.status(401).json({ error: 'Invalid authentication code' })
        }
      }
    }
    await disableTOTP(userId)
    res.json({ message: 'Two-factor authentication has been disabled' })
  } catch (error) {
    logger.error('2FA disable error', { error: error.message, stack: error.stack })
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
