import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { attachOrg } from '../middleware/orgAuth.js'
import logger from '../utils/logger.js'
import {
  saveSlackIntegration,
  getSlackIntegration,
  deleteSlackIntegration,
} from '../database.js'
import { sendSlackTestMessage } from '../services/slackService.js'

const router = express.Router()
router.use(authenticateToken, attachOrg)

// GET /api/slack/settings
router.get('/settings', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const integration = await getSlackIntegration(userId, req.orgId)
    res.json({ integration: integration || null })
  } catch (error) {
    logger.error('Error getting Slack settings', { error: error.message })
    res.status(500).json({ error: 'Failed to get Slack settings' })
  }
})

// POST /api/slack/settings
router.post('/settings', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { webhookUrl, channelName, dailyDigest, anomalyAlerts, budgetAlerts } = req.body
    if (!webhookUrl) return res.status(400).json({ error: 'webhookUrl is required' })
    const integration = await saveSlackIntegration(userId, req.orgId, {
      channelName, webhookUrl, dailyDigest, anomalyAlerts, budgetAlerts,
    })
    res.json({ integration })
  } catch (error) {
    logger.error('Error saving Slack settings', { error: error.message })
    res.status(500).json({ error: 'Failed to save Slack settings' })
  }
})

// DELETE /api/slack/settings
router.delete('/settings', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    await deleteSlackIntegration(userId, req.orgId)
    res.json({ message: 'Slack integration disconnected' })
  } catch (error) {
    logger.error('Error deleting Slack integration', { error: error.message })
    res.status(500).json({ error: 'Failed to disconnect Slack' })
  }
})

// POST /api/slack/test
router.post('/test', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const integration = await getSlackIntegration(userId, req.orgId)
    if (!integration?.webhook_url) return res.status(400).json({ error: 'No Slack webhook configured' })
    const success = await sendSlackTestMessage(integration.webhook_url)
    if (success) {
      res.json({ message: 'Test message sent successfully' })
    } else {
      res.status(500).json({ error: 'Failed to send test message' })
    }
  } catch (error) {
    logger.error('Error sending Slack test', { error: error.message })
    res.status(500).json({ error: 'Failed to send test message' })
  }
})

export default router
