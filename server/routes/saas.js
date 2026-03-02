import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { attachOrg } from '../middleware/orgAuth.js'
import logger from '../utils/logger.js'
import {
  createSaaSProvider,
  getSaaSProviders,
  deleteSaaSProvider,
  saveSaaSCost,
  getSaaSCosts,
  getSaaSTotalsByProvider,
} from '../database.js'

const router = express.Router()
router.use(authenticateToken, attachOrg)

// GET /api/saas/providers
router.get('/providers', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const providers = await getSaaSProviders(userId, req.orgId)
    res.json({ providers })
  } catch (error) {
    logger.error('Error listing SaaS providers', { error: error.message })
    res.status(500).json({ error: 'Failed to list SaaS providers' })
  }
})

// POST /api/saas/providers
router.post('/providers', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { providerName, providerType, apiKey, apiEndpoint } = req.body
    if (!providerName || !providerType) {
      return res.status(400).json({ error: 'providerName and providerType are required' })
    }
    const provider = await createSaaSProvider(userId, req.orgId, {
      providerName, providerType, apiKeyEncrypted: apiKey || null, apiEndpoint,
    })
    res.status(201).json({ provider })
  } catch (error) {
    logger.error('Error creating SaaS provider', { error: error.message })
    res.status(500).json({ error: 'Failed to create SaaS provider' })
  }
})

// DELETE /api/saas/providers/:id
router.delete('/providers/:id', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const result = await deleteSaaSProvider(parseInt(req.params.id), userId)
    if (!result) return res.status(404).json({ error: 'SaaS provider not found' })
    res.json({ message: 'SaaS provider deleted' })
  } catch (error) {
    logger.error('Error deleting SaaS provider', { error: error.message })
    res.status(500).json({ error: 'Failed to delete SaaS provider' })
  }
})

// GET /api/saas/costs
router.get('/costs', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { startDate, endDate, providerId } = req.query
    const costs = await getSaaSCosts(userId, req.orgId, {
      startDate, endDate, providerId: providerId ? parseInt(providerId) : undefined,
    })
    res.json({ costs })
  } catch (error) {
    logger.error('Error listing SaaS costs', { error: error.message })
    res.status(500).json({ error: 'Failed to list SaaS costs' })
  }
})

// GET /api/saas/totals
router.get('/totals', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const totals = await getSaaSTotalsByProvider(userId, req.orgId)
    res.json({ totals })
  } catch (error) {
    logger.error('Error getting SaaS totals', { error: error.message })
    res.status(500).json({ error: 'Failed to get SaaS totals' })
  }
})

// POST /api/saas/costs/upload
router.post('/costs/upload', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { providerId, costs } = req.body
    if (!providerId || !Array.isArray(costs)) {
      return res.status(400).json({ error: 'providerId and costs array are required' })
    }
    let imported = 0
    for (const entry of costs) {
      await saveSaaSCost(userId, req.orgId, {
        saasProviderId: providerId,
        serviceName: entry.serviceName || entry.service,
        date: entry.date,
        cost: parseFloat(entry.cost || entry.amount || 0),
        usageQuantity: entry.quantity ? parseFloat(entry.quantity) : null,
        usageUnit: entry.unit || null,
      })
      imported++
    }
    res.json({ message: `${imported} cost entries imported`, imported })
  } catch (error) {
    logger.error('Error uploading SaaS costs', { error: error.message })
    res.status(500).json({ error: 'Failed to upload SaaS costs' })
  }
})

export default router
