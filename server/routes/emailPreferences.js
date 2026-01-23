/**
 * Email Preferences Routes
 * Manage email alert preferences (Pro only)
 */

import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { requireFeature } from '../middleware/featureGate.js'
import {
  getUserEmailPreferences,
  updateUserEmailPreferences,
} from '../services/emailService.js'
import logger from '../utils/logger.js'

const router = express.Router()

// All routes require authentication and Pro subscription
router.use(authenticateToken)
router.use(requireFeature('email_alerts'))

/**
 * GET /api/email-preferences
 * Get user email preferences
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const preferences = await getUserEmailPreferences(userId)
    
    res.json({ preferences })
  } catch (error) {
    logger.error('Error getting email preferences', { 
      userId: req.user?.userId, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to get email preferences' })
  }
})

/**
 * PUT /api/email-preferences
 * Update user email preferences
 */
router.put('/', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { emailAlertsEnabled, emailAnomalyAlerts, emailBudgetAlerts, emailWeeklySummary } = req.body
    
    await updateUserEmailPreferences(userId, {
      emailAlertsEnabled,
      emailAnomalyAlerts,
      emailBudgetAlerts,
      emailWeeklySummary,
    })
    
    res.json({ message: 'Email preferences updated successfully' })
  } catch (error) {
    logger.error('Error updating email preferences', { 
      userId: req.user?.userId, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to update email preferences' })
  }
})

export default router
