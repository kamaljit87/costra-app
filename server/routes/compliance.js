/**
 * Compliance Routes
 * Handles GDPR, DPDPA, and general data protection compliance endpoints
 */

import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import {
  exportUserData,
  createDeletionRequest,
  confirmDeletionRequest,
  cancelDeletionRequest,
  getUserConsents,
  withdrawConsent,
  submitGrievance,
  getUserGrievances,
  getUserById,
} from '../database.js'
import logger from '../utils/logger.js'

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
    res.setHeader('Content-Disposition', `attachment; filename="costra-data-export-${userId}-${new Date().toISOString().split('T')[0]}.json"`)
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
 * Request account deletion
 */
router.post('/delete-account', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { reason } = req.body
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress

    const request = await createDeletionRequest(userId, ipAddress, reason)

    logger.info('Account deletion requested', { userId, requestId: request.id })

    res.json({
      message: 'Deletion request created. Please confirm to permanently delete your account and all associated data.',
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
 * Confirm and execute account deletion
 */
router.post('/delete-account/:requestId/confirm', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const requestId = parseInt(req.params.requestId, 10)

    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' })
    }

    await confirmDeletionRequest(userId, requestId)

    logger.info('Account deletion confirmed and executed', { userId, requestId })

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
