import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { attachOrg } from '../middleware/orgAuth.js'
import logger from '../utils/logger.js'
import { encrypt, decrypt } from '../services/encryption.js'
import { getSaaSAdapter, getCredentialFields } from '../services/saas-providers/index.js'
import {
  createSaaSProvider,
  getSaaSProviders,
  deleteSaaSProvider,
  getSaaSProviderById,
  updateSaaSProviderSyncStatus,
  upsertSaaSCost,
  saveSaaSCost,
  getSaaSCosts,
  getSaaSTotalsByProvider,
} from '../database.js'

const router = express.Router()
router.use(authenticateToken, attachOrg)

// GET /api/saas/credential-fields/:type
router.get('/credential-fields/:type', (req, res) => {
  const fields = getCredentialFields(req.params.type)
  res.json({ fields })
})

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
    const { providerName, providerType, credentials } = req.body
    if (!providerName || !providerType) {
      return res.status(400).json({ error: 'providerName and providerType are required' })
    }

    // If credentials provided, validate them first
    let credentialsEncrypted = null
    if (credentials && Object.keys(credentials).length > 0) {
      const adapter = getSaaSAdapter(providerType)
      if (adapter) {
        const testResult = await adapter.testConnection(credentials)
        if (!testResult.success) {
          return res.status(400).json({ error: testResult.message })
        }
      }
      credentialsEncrypted = encrypt(JSON.stringify(credentials))
    }

    const provider = await createSaaSProvider(userId, req.orgId, {
      providerName, providerType, credentialsEncrypted,
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

// POST /api/saas/providers/:id/test
router.post('/providers/:id/test', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const provider = await getSaaSProviderById(parseInt(req.params.id), userId)
    if (!provider) return res.status(404).json({ error: 'Provider not found' })

    const adapter = getSaaSAdapter(provider.provider_type)
    if (!adapter) return res.status(400).json({ error: 'No adapter for this provider type' })

    if (!provider.credentials_encrypted) {
      return res.status(400).json({ error: 'No credentials configured for this provider' })
    }

    const credentials = JSON.parse(decrypt(provider.credentials_encrypted))
    const result = await adapter.testConnection(credentials)
    res.json(result)
  } catch (error) {
    logger.error('Error testing SaaS provider', { error: error.message })
    res.status(500).json({ error: 'Failed to test connection' })
  }
})

// POST /api/saas/providers/:id/sync
router.post('/providers/:id/sync', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const provider = await getSaaSProviderById(parseInt(req.params.id), userId)
    if (!provider) return res.status(404).json({ error: 'Provider not found' })

    const adapter = getSaaSAdapter(provider.provider_type)
    if (!adapter) return res.status(400).json({ error: 'No adapter for this provider type' })

    if (!provider.credentials_encrypted) {
      return res.status(400).json({ error: 'No credentials configured. Edit the provider to add credentials.' })
    }

    // Mark as syncing
    await updateSaaSProviderSyncStatus(provider.id, 'syncing')

    try {
      const credentials = JSON.parse(decrypt(provider.credentials_encrypted))
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 30) // Last 30 days

      const costs = await adapter.fetchCosts(credentials, startDate, endDate)

      let imported = 0
      for (const entry of costs) {
        await upsertSaaSCost(userId, req.orgId, {
          saasProviderId: provider.id,
          serviceName: entry.serviceName,
          date: entry.date,
          cost: entry.cost,
          usageQuantity: entry.usageQuantity || null,
          usageUnit: entry.usageUnit || null,
          metadata: entry.metadata || {},
        })
        imported++
      }

      await updateSaaSProviderSyncStatus(provider.id, 'success')
      res.json({ message: `Synced ${imported} cost entries`, imported })
    } catch (syncError) {
      await updateSaaSProviderSyncStatus(provider.id, 'error', syncError.message)
      logger.error('SaaS sync failed', { providerId: provider.id, error: syncError.message })
      res.status(500).json({ error: `Sync failed: ${syncError.message}` })
    }
  } catch (error) {
    logger.error('Error syncing SaaS provider', { error: error.message })
    res.status(500).json({ error: 'Failed to sync provider' })
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
