/**
 * Sync Preferences Routes
 * Manage auto-sync preferences (Starter & Pro)
 */

import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { requireFeature } from '../middleware/featureGate.js'
import { pool } from '../database.js'
import logger from '../utils/logger.js'

const router = express.Router()

// All routes require authentication
router.use(authenticateToken)

/**
 * GET /api/sync/preferences
 * Get sync preferences for user's accounts
 */
router.get('/preferences', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const client = await pool.connect()
    
    try {
      const result = await client.query(
        `SELECT id, provider_id, account_alias, auto_sync_enabled, auto_sync_time
         FROM cloud_provider_credentials
         WHERE user_id = $1 AND is_active = true
         ORDER BY created_at DESC`,
        [userId]
      )
      
      res.json({ 
        accounts: result.rows.map(row => ({
          accountId: row.id,
          providerId: row.provider_id,
          accountAlias: row.account_alias,
          autoSyncEnabled: row.auto_sync_enabled || false,
          autoSyncTime: row.auto_sync_time || '02:00:00',
        }))
      })
    } finally {
      client.release()
    }
  } catch (error) {
    logger.error('Error getting sync preferences', { 
      userId: req.user?.userId, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to get sync preferences' })
  }
})

/**
 * PUT /api/sync/preferences
 * Update sync preferences for an account
 */
router.put('/preferences', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { accountId, autoSyncEnabled, autoSyncTime } = req.body
    
    if (!accountId) {
      return res.status(400).json({ error: 'accountId is required' })
    }
    
    // Check if user has access to scheduled sync
    const { canAccessFeature } = await import('../services/subscriptionService.js')
    const hasAccess = await canAccessFeature(userId, 'scheduled_sync')
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Feature not available',
        message: 'Scheduled sync requires a Starter or Pro subscription',
        feature: 'scheduled_sync',
        requiredPlan: 'Starter',
        upgradeUrl: '/settings/billing',
      })
    }
    
    const client = await pool.connect()
    try {
      // Verify account belongs to user
      const accountCheck = await client.query(
        `SELECT id FROM cloud_provider_credentials
         WHERE id = $1 AND user_id = $2`,
        [accountId, userId]
      )
      
      if (accountCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Account not found' })
      }
      
      // Update preferences
      await client.query(
        `UPDATE cloud_provider_credentials
         SET auto_sync_enabled = $1,
             auto_sync_time = COALESCE($2, auto_sync_time, '02:00:00'),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND user_id = $4`,
        [autoSyncEnabled ?? false, autoSyncTime || null, accountId, userId]
      )
      
      res.json({ message: 'Sync preferences updated successfully' })
    } finally {
      client.release()
    }
  } catch (error) {
    logger.error('Error updating sync preferences', { 
      userId: req.user?.userId, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to update sync preferences' })
  }
})

export default router
