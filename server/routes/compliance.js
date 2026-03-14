/**
 * Compliance Routes
 * Handles GDPR, DPDPA, and general data protection compliance endpoints
 */

import express from 'express'
import crypto from 'crypto'
import { authenticateToken } from '../middleware/auth.js'
import {
  exportUserData,
  createDeletionRequestWithToken,
  confirmDeletionRequest,
  cancelDeletionRequest,
  getDeletionRequestByToken,
  getDeletionRequestByCancelToken,
  getUserConsents,
  withdrawConsent,
  submitGrievance,
  getUserGrievances,
  getUserById,
  addMarketingLead,
} from '../database.js'
import { sendTransactionalEmail } from '../services/emailService.js'
import {
  deletionConfirmTemplate,
  accountDeletedTemplate,
  deletionCancelledTemplate,
} from '../services/emailTemplates.js'
import logger from '../utils/logger.js'

const FRONTEND_URL = () => process.env.FRONTEND_URL || 'http://localhost:5173'
const APP_URL = () => process.env.APP_URL || FRONTEND_URL()

const router = express.Router()

// ==========================================
// Data Export (GDPR Art. 20 - Right to Data Portability)
// ==========================================

/**
 * GET /api/compliance/export
 * Export all user data in machine-readable JSON format
 */
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const data = await exportUserData(userId)

    logger.info('User data export requested', { userId })

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="costdoq-data-export-${userId}-${new Date().toISOString().split('T')[0]}.json"`)
    res.json(data)
  } catch (error) {
    logger.error('Error exporting user data', {
      userId: req.user?.userId,
      error: error.message,
      stack: error.stack,
    })
    res.status(500).json({ error: 'Failed to export user data' })
  }
})

// ==========================================
// Account Deletion (GDPR Art. 17 - Right to Erasure)
// ==========================================

/**
 * POST /api/compliance/delete-account
 * Request account deletion — sends confirmation email with approve/cancel links
 */
router.post('/delete-account', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { reason } = req.body
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress

    const user = await getUserById(userId)
    if (!user) return res.status(404).json({ error: 'User not found' })

    // Generate confirm and cancel tokens
    const confirmToken = crypto.randomBytes(32).toString('hex')
    const confirmHash = crypto.createHash('sha256').update(confirmToken).digest('hex')
    const cancelToken = crypto.randomBytes(32).toString('hex')
    const cancelHash = crypto.createHash('sha256').update(cancelToken).digest('hex')

    const request = await createDeletionRequestWithToken(userId, ipAddress, reason, confirmHash, cancelHash)

    // Send confirmation email
    const confirmUrl = `${APP_URL()}/confirm-delete?token=${confirmToken}`
    const cancelUrl = `${APP_URL()}/cancel-delete?token=${cancelToken}`
    await sendTransactionalEmail({
      to: user.email,
      subject: 'Confirm Account Deletion — Costdoq',
      html: deletionConfirmTemplate(user.name, confirmUrl, cancelUrl),
    })

    logger.info('Account deletion requested — confirmation email sent', { userId, requestId: request.id })

    res.json({
      message: 'A confirmation email has been sent to your email address. Please check your inbox to confirm account deletion.',
      request: {
        id: request.id,
        status: request.status,
        requestedAt: request.requested_at,
      },
    })
  } catch (error) {
    if (error.message === 'A deletion request is already pending') {
      return res.status(409).json({ error: error.message })
    }
    logger.error('Error creating deletion request', {
      userId: req.user?.userId,
      error: error.message,
      stack: error.stack,
    })
    res.status(500).json({ error: 'Failed to create deletion request' })
  }
})

/**
 * POST /api/compliance/delete-account/:requestId/confirm
 * Confirm and execute account deletion (authenticated — from UI)
 */
router.post('/delete-account/:requestId/confirm', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const requestId = parseInt(req.params.requestId, 10)
    const { keepForMarketing } = req.body || {}

    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' })
    }

    const user = await getUserById(userId)

    // If user opted in to marketing emails, save their email before deletion
    if (keepForMarketing && user) {
      try {
        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress
        await addMarketingLead(user.email, user.name, 'account_deletion', ipAddress)
        logger.info('User opted in to marketing emails before deletion', { userId, email: user.email })
      } catch (marketingError) {
        logger.warn('Failed to save marketing lead before deletion', { userId, error: marketingError.message })
      }
    }

    await confirmDeletionRequest(userId, requestId)

    // Send "account deleted" email (fire-and-forget, user no longer exists in DB)
    if (user) {
      sendTransactionalEmail({
        to: user.email,
        subject: 'Account Deleted — Costdoq',
        html: accountDeletedTemplate(user.name),
      }).catch((e) => logger.error('Failed to send account deleted email', { error: e.message }))
    }

    logger.info('Account deletion confirmed and executed', { userId, requestId, keepForMarketing: !!keepForMarketing })

    res.json({
      message: 'Your account and all associated data have been permanently deleted.',
    })
  } catch (error) {
    logger.error('Error confirming deletion', {
      userId: req.user?.userId,
      requestId: req.params.requestId,
      error: error.message,
      stack: error.stack,
    })
    res.status(500).json({ error: error.message || 'Failed to delete account' })
  }
})

/**
 * POST /api/compliance/delete-account/confirm-by-token
 * Confirm account deletion via email token link (no auth required)
 */
router.post('/delete-account/confirm-by-token', async (req, res) => {
  try {
    const { token, keepForMarketing } = req.body
    if (!token) {
      return res.status(400).json({ error: 'Token is required' })
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const request = await getDeletionRequestByToken(tokenHash)
    if (!request) {
      return res.status(400).json({ error: 'Invalid or expired deletion link.' })
    }

    const user = await getUserById(request.user_id)

    if (keepForMarketing && user) {
      try {
        await addMarketingLead(user.email, user.name, 'account_deletion', request.ip_address)
      } catch (marketingError) {
        logger.warn('Failed to save marketing lead', { error: marketingError.message })
      }
    }

    await confirmDeletionRequest(request.user_id, request.id)

    if (user) {
      sendTransactionalEmail({
        to: user.email,
        subject: 'Account Deleted — Costdoq',
        html: accountDeletedTemplate(user.name),
      }).catch((e) => logger.error('Failed to send account deleted email', { error: e.message }))
    }

    logger.info('Account deletion confirmed via email token', { userId: request.user_id, requestId: request.id })

    res.json({ message: 'Your account and all associated data have been permanently deleted.' })
  } catch (error) {
    logger.error('Error confirming deletion by token', { error: error.message })
    res.status(500).json({ error: error.message || 'Failed to delete account' })
  }
})

/**
 * POST /api/compliance/delete-account/cancel-by-token
 * Cancel account deletion via email token link (no auth required)
 */
router.post('/delete-account/cancel-by-token', async (req, res) => {
  try {
    const { token } = req.body
    if (!token) {
      return res.status(400).json({ error: 'Token is required' })
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const request = await getDeletionRequestByCancelToken(tokenHash)
    if (!request) {
      return res.status(400).json({ error: 'Invalid or expired cancellation link.' })
    }

    await cancelDeletionRequest(request.user_id, request.id)

    const user = await getUserById(request.user_id)
    if (user) {
      sendTransactionalEmail({
        to: user.email,
        subject: 'Account Deletion Cancelled — Costdoq',
        html: deletionCancelledTemplate(user.name),
      }).catch((e) => logger.error('Failed to send deletion cancelled email', { error: e.message }))
    }

    logger.info('Account deletion cancelled via email token', { userId: request.user_id, requestId: request.id })

    res.json({ message: 'Account deletion cancelled. Your account is safe.' })
  } catch (error) {
    logger.error('Error cancelling deletion by token', { error: error.message })
    res.status(500).json({ error: 'Failed to cancel deletion request' })
  }
})

/**
 * POST /api/compliance/delete-account/:requestId/cancel
 * Cancel a pending deletion request
 */
router.post('/delete-account/:requestId/cancel', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const requestId = parseInt(req.params.requestId, 10)

    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' })
    }

    const result = await cancelDeletionRequest(userId, requestId)

    if (!result) {
      return res.status(404).json({ error: 'Deletion request not found or already processed' })
    }

    // Send cancellation email
    const user = await getUserById(userId)
    if (user) {
      sendTransactionalEmail({
        to: user.email,
        subject: 'Account Deletion Cancelled — Costdoq',
        html: deletionCancelledTemplate(user.name),
      }).catch((e) => logger.error('Failed to send deletion cancelled email', { error: e.message }))
    }

    logger.info('Account deletion cancelled', { userId, requestId })

    res.json({ message: 'Deletion request cancelled successfully' })
  } catch (error) {
    logger.error('Error cancelling deletion', {
      userId: req.user?.userId,
      error: error.message,
      stack: error.stack,
    })
    res.status(500).json({ error: 'Failed to cancel deletion request' })
  }
})

// ==========================================
// Consent Management (GDPR Art. 7 / DPDPA Sec. 6)
// ==========================================

/**
 * GET /api/compliance/consents
 * Get all consent records for the current user
 */
router.get('/consents', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const consents = await getUserConsents(userId)

    res.json({ consents })
  } catch (error) {
    logger.error('Error fetching consents', {
      userId: req.user?.userId,
      error: error.message,
      stack: error.stack,
    })
    res.status(500).json({ error: 'Failed to fetch consent records' })
  }
})

/**
 * POST /api/compliance/consents/withdraw
 * Withdraw a specific consent
 */
router.post('/consents/withdraw', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { consentType } = req.body

    if (!consentType) {
      return res.status(400).json({ error: 'consentType is required' })
    }

    const validTypes = ['privacy_policy', 'terms_of_service', 'marketing_emails', 'data_processing', 'cookie_analytics']
    if (!validTypes.includes(consentType)) {
      return res.status(400).json({ error: 'Invalid consent type' })
    }

    // Warn that withdrawing core consents may require account deletion
    if (['privacy_policy', 'terms_of_service', 'data_processing'].includes(consentType)) {
      const result = await withdrawConsent(userId, consentType)
      logger.info('Core consent withdrawn — account may need to be deactivated', { userId, consentType })
      return res.json({
        message: `Consent for ${consentType} withdrawn. Note: Withdrawing consent for core data processing may require account deletion, as we cannot provide the service without processing your data.`,
        consent: result,
      })
    }

    const result = await withdrawConsent(userId, consentType)
    logger.info('Consent withdrawn', { userId, consentType })

    res.json({
      message: `Consent for ${consentType} withdrawn successfully`,
      consent: result,
    })
  } catch (error) {
    logger.error('Error withdrawing consent', {
      userId: req.user?.userId,
      error: error.message,
      stack: error.stack,
    })
    res.status(500).json({ error: 'Failed to withdraw consent' })
  }
})

// ==========================================
// Grievance Redressal (DPDPA Sec. 13)
// ==========================================

/**
 * POST /api/compliance/grievance
 * Submit a grievance/complaint
 */
router.post('/grievance', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { category, subject, description } = req.body

    if (!category || !subject || !description) {
      return res.status(400).json({ error: 'category, subject, and description are required' })
    }

    const validCategories = ['data_access', 'data_correction', 'data_deletion', 'consent_withdrawal', 'data_breach', 'other']
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid grievance category' })
    }

    // Get user info for the grievance record
    const user = await getUserById(userId)

    const grievance = await submitGrievance({
      userId,
      email: user.email,
      name: user.name,
      category,
      subject,
      description,
    })

    logger.info('Grievance submitted', { userId, grievanceId: grievance.id, category })

    res.status(201).json({
      message: 'Your grievance has been submitted. We will respond within 30 days as required by applicable data protection laws.',
      grievance: {
        id: grievance.id,
        category: grievance.category,
        status: grievance.status,
        submittedAt: grievance.submitted_at,
      },
    })
  } catch (error) {
    logger.error('Error submitting grievance', {
      userId: req.user?.userId,
      error: error.message,
      stack: error.stack,
    })
    res.status(500).json({ error: 'Failed to submit grievance' })
  }
})

/**
 * GET /api/compliance/grievances
 * Get grievances for the current user
 */
router.get('/grievances', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const grievances = await getUserGrievances(userId)

    res.json({ grievances })
  } catch (error) {
    logger.error('Error fetching grievances', {
      userId: req.user?.userId,
      error: error.message,
      stack: error.stack,
    })
    res.status(500).json({ error: 'Failed to fetch grievances' })
  }
})

export default router
