import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
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
  createEmailVerificationToken,
  verifyEmailToken,
  createPasswordResetToken,
  verifyPasswordResetToken,
  markPasswordResetTokenUsed,
  updateUserPassword,
} from '../database.js'
import { authenticateToken } from '../middleware/auth.js'
import { validateSignup, validateLogin } from '../middleware/validator.js'
import { createTrialSubscription } from '../services/subscriptionService.js'
import { addMarketingLead } from '../database.js'
import { sendTransactionalEmail } from '../services/emailService.js'
import {
  verifyEmailTemplate,
  passwordResetTemplate,
  welcomeTemplate,
  passwordChangedTemplate,
  twoFactorEnabledTemplate,
  twoFactorDisabledTemplate,
} from '../services/emailTemplates.js'
import logger from '../utils/logger.js'

const router = express.Router()

const TOTP_ISSUER = 'Costra'
const TEMP_TOKEN_EXPIRY = '10m'
const FRONTEND_URL = () => process.env.FRONTEND_URL || 'http://localhost:5173'

/** Generate a secure random token and its SHA-256 hash */
function generateTokenPair() {
  const token = crypto.randomBytes(32).toString('hex')
  const hash = crypto.createHash('sha256').update(token).digest('hex')
  return { token, hash }
}

/** Send email verification to user */
async function sendVerificationEmail(userId, email, name) {
  const { token, hash } = generateTokenPair()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  await createEmailVerificationToken(userId, email, hash, expiresAt)
  const verifyUrl = `${FRONTEND_URL()}/verify-email?token=${token}`
  await sendTransactionalEmail({
    to: email,
    subject: 'Verify Your Email — Costra',
    html: verifyEmailTemplate(name, verifyUrl),
  })
}

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
    emailVerified: user.email_verified ?? false,
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

/** Forgot password: sends reset email if user exists. Always returns generic success to prevent user enumeration. */
router.post('/forgot-password', async (req, res) => {
  const email = req.body?.email
  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'Email is required' })
  }

  // Always return success immediately to prevent timing-based enumeration
  res.json({ message: 'If an account exists for this email, you will receive reset instructions.' })

  // Send reset email in background (after response)
  try {
    const user = await getUserByEmail(email.trim().toLowerCase())
    if (user && user.password_hash) {
      const { token, hash } = generateTokenPair()
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      await createPasswordResetToken(user.id, hash, expiresAt)
      const resetUrl = `${FRONTEND_URL()}/reset-password?token=${token}`
      await sendTransactionalEmail({
        to: user.email,
        subject: 'Reset Your Password — Costra',
        html: passwordResetTemplate(user.name, resetUrl),
      })
      logger.info('Password reset email sent', { email: user.email })
    }
  } catch (err) {
    logger.error('Error sending password reset email', { email: email.trim(), error: err.message })
  }
})

/** Reset password: verify token and set new password */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' })
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const resetToken = await verifyPasswordResetToken(tokenHash)
    if (!resetToken) {
      return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' })
    }

    // Update password
    const passwordHash = await bcrypt.hash(newPassword, 10)
    await updateUserPassword(resetToken.user_id, passwordHash)
    await markPasswordResetTokenUsed(resetToken.id)

    // Send confirmation email
    const user = await getUserById(resetToken.user_id)
    if (user) {
      sendTransactionalEmail({
        to: user.email,
        subject: 'Password Changed — Costra',
        html: passwordChangedTemplate(user.name),
      }).catch((e) => logger.error('Failed to send password changed email', { error: e.message }))
    }

    logger.info('Password reset completed', { userId: resetToken.user_id })
    res.json({ message: 'Password reset successfully. You can now sign in with your new password.' })
  } catch (error) {
    logger.error('Password reset error', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** Verify email: validate token and mark email as verified */
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body
    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' })
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const verified = await verifyEmailToken(tokenHash)
    if (!verified) {
      return res.status(400).json({ error: 'Invalid or expired verification link. Please request a new one.' })
    }

    logger.info('Email verified', { userId: verified.user_id, email: verified.email })
    res.json({ message: 'Email verified successfully!' })
  } catch (error) {
    logger.error('Email verification error', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** Resend verification email */
router.post('/resend-verification', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const user = await getUserById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    if (user.email_verified) {
      return res.json({ message: 'Email is already verified' })
    }

    await sendVerificationEmail(userId, user.email, user.name)
    logger.info('Verification email resent', { userId })
    res.json({ message: 'Verification email sent. Please check your inbox.' })
  } catch (error) {
    logger.error('Resend verification error', { userId: req.user?.userId, error: error.message })
    res.status(500).json({ error: 'Failed to resend verification email' })
  }
})

/** Waitlist: store lead details securely (no auth required) */
router.post('/waitlist', async (req, res) => {
  try {
    const { name, email, company } = req.body
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' })
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'Please enter a valid email address' })
    }

    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    await addMarketingLead(
      email.trim().toLowerCase(),
      name.trim(),
      'waitlist',
      typeof ipAddress === 'string' ? ipAddress.split(',')[0].trim() : ipAddress,
      company?.trim() || null
    )

    logger.info('Waitlist signup', { email: email.trim().toLowerCase(), name: name.trim() })
    res.json({ message: 'Successfully joined the waitlist' })
  } catch (error) {
    logger.error('Waitlist error', { error: error.message })
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
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

      // Send verification and welcome emails (non-blocking)
      try {
        await sendVerificationEmail(userId, email, name)
      } catch (emailErr) {
        logger.error('Failed to send verification email', { userId, error: emailErr.message })
      }
      sendTransactionalEmail({
        to: email,
        subject: 'Welcome to Costra!',
        html: welcomeTemplate(name),
      }).catch((e) => logger.error('Failed to send welcome email', { userId, error: e.message }))

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
        emailVerified: user.email_verified ?? false,
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
    // Send notification email
    const user2fa = await getUserById(userId)
    if (user2fa) {
      sendTransactionalEmail({
        to: user2fa.email,
        subject: 'Two-Factor Authentication Enabled — Costra',
        html: twoFactorEnabledTemplate(user2fa.name),
      }).catch((e) => logger.error('Failed to send 2FA enabled email', { error: e.message }))
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
    // Send notification email
    const userDis = await getUserById(userId)
    if (userDis) {
      sendTransactionalEmail({
        to: userDis.email,
        subject: 'Two-Factor Authentication Disabled — Costra',
        html: twoFactorDisabledTemplate(userDis.name),
      }).catch((e) => logger.error('Failed to send 2FA disabled email', { error: e.message }))
    }
    res.json({ message: 'Two-factor authentication disabled.' })
  } catch (error) {
    logger.error('2FA disable error', { requestId: req.requestId, error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
