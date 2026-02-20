import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import speakeasy from 'speakeasy'
import {
  createUser,
  getUserByEmail,
  getUserById,
  get2FAStatus,
  getUserTOTPSecret,
  setTOTPPending,
  getTOTPPending,
  confirmTOTPAndEnable,
  disableTOTP,
  recordMultipleConsents,
} from '../database.js'
import { authenticateToken } from '../middleware/auth.js'
import { validateSignup, validateLogin } from '../middleware/validator.js'
import { createTrialSubscription } from '../services/subscriptionService.js'
import logger from '../utils/logger.js'

const router = express.Router()

const TOTP_ISSUER = 'Costra'
const TEMP_TOKEN_EXPIRY = '10m'

/** Issue a short-lived token only valid for POST /auth/2fa/verify */
function signTemporary2FAToken(userId, email) {
  return jwt.sign(
    { userId, email, purpose: '2fa_verify' },
    process.env.JWT_SECRET,
    { expiresIn: TEMP_TOKEN_EXPIRY }
  )
}

/** Verify temporary 2FA token; returns payload or throws */
function verifyTemporary2FAToken(temporaryToken) {
  const payload = jwt.verify(temporaryToken, process.env.JWT_SECRET)
  if (payload.purpose !== '2fa_verify') throw new Error('Invalid token purpose')
  return payload
}

function toUserResponse(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatar_url ?? null,
    isAdmin: user.is_admin || false,
  }
}

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
/** Public config (no auth). Used by frontend to hide signup when DISABLE_SIGNUP is set. */
router.get('/config', (_req, res) => {
  const signupDisabled = process.env.DISABLE_SIGNUP === 'true' || process.env.DISABLE_SIGNUP === '1'
  res.json({ signupDisabled })
})

/** Forgot password: accept email and return generic success (no email sent unless configured). Prevents user enumeration. */
router.post('/forgot-password', (req, res) => {
  const email = req.body?.email
  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'Email is required' })
  }
  // Always return success to avoid revealing whether the account exists
  res.json({ message: 'If an account exists for this email, you will receive reset instructions.' })
})

router.post('/signup',
  validateSignup,
  async (req, res) => {
    try {
      if (process.env.DISABLE_SIGNUP === 'true' || process.env.DISABLE_SIGNUP === '1') {
        return res.status(503).json({ error: 'Sign up is temporarily disabled.' })
      }

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
        user: toUserResponse(user),
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

      const twoFA = await get2FAStatus(user.id)
      if (twoFA?.enabled) {
        const temporaryToken = signTemporary2FAToken(user.id, user.email)
        return res.json({
          message: 'Two-factor authentication required',
          twoFactorRequired: true,
          temporaryToken,
          user: toUserResponse(user),
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
        user: toUserResponse(user),
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
        isAdmin: user.is_admin || false,
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
      user: toUserResponse(user),
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

// --- 2FA verify (no auth middleware; uses temporary token) ---
router.post('/2fa/verify', async (req, res) => {
  try {
    const { temporaryToken, code } = req.body
    if (!temporaryToken || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ error: 'temporaryToken and code are required' })
    }
    let payload
    try {
      payload = verifyTemporary2FAToken(temporaryToken)
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired code. Please sign in again.' })
    }
    const userId = payload.userId
    const secret = await getUserTOTPSecret(userId)
    if (!secret) {
      return res.status(401).json({ error: 'Two-factor authentication is not enabled for this account.' })
    }
    const valid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code.trim(),
      window: 1,
    })
    if (!valid) {
      return res.status(401).json({ error: 'Invalid verification code.' })
    }
    const user = await getUserById(userId)
    if (!user) {
      return res.status(401).json({ error: 'User not found.' })
    }
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )
    res.json({
      message: 'Two-factor verification successful',
      token,
      user: toUserResponse(user),
    })
  } catch (error) {
    logger.error('2FA verify error', { requestId: req.requestId, error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// --- 2FA setup (authenticated) ---
router.get('/2fa/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const status = await get2FAStatus(userId)
    const enabled = status?.enabled === true || status?.enabled === 't'
    res.json({ enabled: !!enabled })
  } catch (error) {
    logger.error('2FA status error', { requestId: req.requestId, error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/2fa/setup', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const user = await getUserById(userId)
    if (!user) return res.status(404).json({ error: 'User not found' })
    const status = await get2FAStatus(userId)
    if (status?.enabled) {
      return res.status(400).json({ error: 'Two-factor authentication is already enabled.' })
    }
    const gen = speakeasy.generateSecret({
      name: `${TOTP_ISSUER} (${user.email})`,
      length: 20,
    })
    await setTOTPPending(userId, gen.base32)
    res.json({
      secret: gen.base32,
      otpauthUrl: gen.otpauth_url,
    })
  } catch (error) {
    logger.error('2FA setup error', { requestId: req.requestId, error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/2fa/confirm', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const code = req.body?.code
    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ error: 'Code is required' })
    }
    const pending = await getTOTPPending(userId)
    if (!pending) {
      return res.status(400).json({ error: 'No 2FA setup in progress. Start setup first.' })
    }
    const valid = speakeasy.totp.verify({
      secret: pending,
      encoding: 'base32',
      token: code.trim(),
      window: 1,
    })
    if (!valid) {
      return res.status(400).json({ error: 'Invalid verification code.' })
    }
    const ok = await confirmTOTPAndEnable(userId)
    if (!ok) {
      return res.status(400).json({ error: 'Could not enable 2FA. Please try again.' })
    }
    res.json({ message: 'Two-factor authentication enabled.' })
  } catch (error) {
    logger.error('2FA confirm error', { requestId: req.requestId, error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/2fa/disable', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const code = req.body?.code
    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ error: 'Code is required' })
    }
    const secret = await getUserTOTPSecret(userId)
    if (!secret) {
      return res.status(400).json({ error: 'Two-factor authentication is not enabled.' })
    }
    const valid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code.trim(),
      window: 1,
    })
    if (!valid) {
      return res.status(401).json({ error: 'Invalid verification code.' })
    }
    await disableTOTP(userId)
    res.json({ message: 'Two-factor authentication disabled.' })
  } catch (error) {
    logger.error('2FA disable error', { requestId: req.requestId, error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
