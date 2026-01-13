import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { getCloudProviderCredentials, getUserCloudProviders, saveCostData, pool } from '../database.js'
import { fetchProviderCostData } from '../services/cloudProviderIntegrations.js'

const router = express.Router()

// All routes require authentication
router.use(authenticateToken)

/**
 * Sync cost data from all active cloud providers
 * POST /api/sync
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId
    const { providerId } = req.body // Optional: sync specific provider

    // Get all active providers or specific provider
    const providers = providerId
      ? [{ provider_id: providerId }]
      : await getUserCloudProviders(userId)

    const results = []
    const errors = []

    // Calculate date range (current month and last month)
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1
    const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear

    const startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`
    const endDate = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0]

    for (const provider of providers) {
      try {
        // Skip if provider is not active
        if (provider.is_active === false) {
          continue
        }

        // Get decrypted credentials
        const credentials = await getCloudProviderCredentials(userId, provider.provider_id)
        
        if (!credentials) {
          errors.push({
            providerId: provider.provider_id,
            error: 'Credentials not found',
          })
          continue
        }

        // Fetch cost data from provider API
        const costData = await fetchProviderCostData(
          provider.provider_id,
          credentials,
          startDate,
          endDate
        )

        // Save to database
        await saveCostData(
          userId,
          provider.provider_id,
          currentMonth,
          currentYear,
          {
            providerName: provider.provider_name,
            icon: getProviderIcon(provider.provider_id),
            currentMonth: costData.currentMonth,
            lastMonth: costData.lastMonth || costData.currentMonth * 0.95,
            forecast: costData.forecast || costData.currentMonth * 1.1,
            credits: costData.credits || 0,
            savings: costData.savings || 0,
            services: costData.services || [],
          }
        )

        // Update last sync time
        const client = await pool.connect()
        try {
          await client.query(
            'UPDATE cloud_provider_credentials SET last_sync_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND provider_id = $2',
            [userId, provider.provider_id]
          )
        } finally {
          client.release()
        }

        results.push({
          providerId: provider.provider_id,
          status: 'success',
          costData: {
            currentMonth: costData.currentMonth,
            lastMonth: costData.lastMonth,
          },
        })
      } catch (error) {
        console.error(`Error syncing ${provider.provider_id}:`, error)
        errors.push({
          providerId: provider.provider_id,
          error: error.message,
        })
      }
    }

    res.json({
      message: 'Sync completed',
      results,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Sync error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * Sync cost data for a specific provider
 * POST /api/sync/:providerId
 */
router.post('/:providerId', async (req, res) => {
  try {
    const userId = req.user.userId
    const { providerId } = req.params

    // Get provider credentials
    const credentials = await getCloudProviderCredentials(userId, providerId)

    if (!credentials) {
      return res.status(404).json({ error: 'Provider credentials not found' })
    }

    // Get provider name for saving
    const providers = await getUserCloudProviders(userId)
    const provider = providers.find(p => p.provider_id === providerId)
    const providerName = provider?.provider_name || providerId

    // Calculate date range
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()
    const startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`
    const endDate = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0]

    // Fetch cost data
    const costData = await fetchProviderCostData(providerId, credentials, startDate, endDate)

    // Save to database
    await saveCostData(
      userId,
      providerId,
      currentMonth,
      currentYear,
      {
        providerName: providerName,
        icon: getProviderIcon(providerId),
        currentMonth: costData.currentMonth,
        lastMonth: costData.lastMonth || costData.currentMonth * 0.95,
        forecast: costData.forecast || costData.currentMonth * 1.1,
        credits: costData.credits || 0,
        savings: costData.savings || 0,
        services: costData.services || [],
      }
    )

        // Update last sync time
        const client = await pool.connect()
    try {
      await client.query(
        'UPDATE cloud_provider_credentials SET last_sync_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND provider_id = $2',
        [userId, providerId]
      )
    } finally {
      client.release()
    }

    res.json({
      message: 'Sync completed successfully',
      providerId,
      costData: {
        currentMonth: costData.currentMonth,
        lastMonth: costData.lastMonth,
        forecast: costData.forecast,
      },
    })
  } catch (error) {
    console.error('Sync provider error:', error)
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

/**
 * Helper function to get provider icon
 */
function getProviderIcon(providerId) {
  const icons = {
    aws: '☁️',
    azure: '🔷',
    gcp: '🔵',
    digitalocean: '🌊',
    linode: '🟢',
    vultr: '⚡',
  }
  return icons[providerId.toLowerCase()] || '☁️'
}

export default router
