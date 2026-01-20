import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { 
  getCloudProviderCredentialsByAccountId,
  getUserCloudProviders, 
  saveCostData, 
  saveBulkDailyCostData,
  getCachedCostData,
  setCachedCostData,
  updateCloudProviderSyncTime,
  clearUserCache,
  clearCostExplanationsCache,
  calculateAnomalyBaseline,
  createNotification,
  pool 
} from '../database.js'
import { fetchProviderCostData, getDateRange } from '../services/cloudProviderIntegrations.js'

const router = express.Router()

// All routes require authentication
router.use(authenticateToken)

/**
 * Sync cost data from all active cloud provider accounts
 * POST /api/sync
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId
    const { accountId } = req.body // Optional: sync specific account

    console.log(`[Sync] Starting sync for user ${userId}, account: ${accountId || 'ALL'}`)

    // Clear user cache first to ensure fresh data
    const clearedCount = await clearUserCache(userId)
    console.log(`[Sync] Cleared ${clearedCount} cache entries for user ${userId}`)
    
    // Clear cost explanations cache to ensure fresh summaries after sync
    const clearedExplanations = await clearCostExplanationsCache(userId)
    console.log(`[Sync] Cleared ${clearedExplanations} cost explanation cache entries for user ${userId}`)

    // Get all active provider accounts or specific account
    let accounts = await getUserCloudProviders(userId)
    
    // Filter by specific account if provided
    if (accountId) {
      accounts = accounts.filter(a => a.id === parseInt(accountId, 10))
    }

    console.log(`[Sync] Found ${accounts.length} account(s) to sync`)

    const results = []
    const errors = []

    // Calculate date range - fetch last 365 days for historical data
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    // Fetch 365 days of data for full year historical tracking
    const { startDate, endDate } = getDateRange(365)
    console.log(`[Sync] Date range: ${startDate} to ${endDate}`)

    for (const account of accounts) {
      const accountLabel = account.account_alias || `${account.provider_id} (${account.id})`
      console.log(`[Sync] Processing account: ${accountLabel}`)
      
      try {
        // Skip if account is not active
        if (account.is_active === false) {
          console.log(`[Sync] Skipping inactive account: ${accountLabel}`)
          continue
        }

        // Get decrypted credentials using account ID
        const accountData = await getCloudProviderCredentialsByAccountId(userId, account.id)
        
        if (!accountData || !accountData.credentials) {
          console.log(`[Sync] No credentials found for account: ${accountLabel}`)
          errors.push({
            accountId: account.id,
            accountAlias: account.account_alias,
            providerId: account.provider_id,
            error: 'Credentials not found',
          })
          continue
        }
        console.log(`[Sync] Got credentials for account: ${accountLabel}`)

        // Check cache first (unless force refresh is requested)
        // Use account ID in cache key to support multiple accounts
        const cacheKey = `account-${account.id}-${startDate}-${endDate}`
        const forceRefresh = req.query.force === 'true'
        let costData = forceRefresh ? null : await getCachedCostData(userId, account.provider_id, cacheKey)
        
        if (costData && !forceRefresh) {
          console.log(`[Sync] Using cached data for account: ${accountLabel}`)
        } else {
          if (forceRefresh) {
            console.log(`[Sync] Force refresh requested for account: ${accountLabel}`)
          }
          console.log(`[Sync] Fetching fresh data for account: ${accountLabel}`)
          // Fetch cost data from provider API
          costData = await fetchProviderCostData(
            account.provider_id,
            accountData.credentials,
            startDate,
            endDate
          )
          
          console.log(`[Sync] Fetched data for ${accountLabel}:`)
          console.log(`  - currentMonth: $${costData.currentMonth?.toFixed(2) || 0}`)
          console.log(`  - lastMonth: $${costData.lastMonth?.toFixed(2) || 0}`)
          console.log(`  - dailyData points: ${costData.dailyData?.length || 0}`)
          console.log(`  - services: ${costData.services?.length || 0}`)
          
          // Cache the result for 60 minutes
          await setCachedCostData(userId, account.provider_id, cacheKey, costData, 60)
        }

        // Save monthly cost data to database
        console.log(`[Sync] Saving monthly cost data for account: ${accountLabel}`)
        await saveCostData(
          userId,
          account.provider_id,
          currentMonth,
          currentYear,
          {
            providerName: account.provider_name,
            accountAlias: account.account_alias,
            accountId: account.id,
            icon: getProviderIcon(account.provider_id),
            currentMonth: costData.currentMonth,
            lastMonth: costData.lastMonth || costData.currentMonth * 0.95,
            forecast: costData.forecast || costData.currentMonth * 1.1,
            credits: costData.credits || 0,
            savings: costData.savings || 0,
            services: costData.services || [],
          }
        )

        // Save daily cost data for historical tracking (include account ID)
        if (costData.dailyData && costData.dailyData.length > 0) {
          console.log(`[Sync] Saving ${costData.dailyData.length} daily data points for account: ${accountLabel}`)
          await saveBulkDailyCostData(userId, account.provider_id, costData.dailyData, account.id)
        } else {
          console.log(`[Sync] No daily data to save for account: ${accountLabel}`)
        }

        // Calculate anomaly baselines for all services (async, non-blocking)
        calculateBaselinesForServices(userId, account.provider_id, account.id, costData)
          .catch(err => console.error(`[Sync] Baseline calculation failed for ${accountLabel}:`, err.message))

        // Update last sync time for this account
        await updateCloudProviderSyncTime(userId, account.id)

        // Create success notification
        await createNotification(userId, {
          type: 'sync',
          title: `Sync Completed: ${accountLabel}`,
          message: `Successfully synced cost data. Current month: $${costData.currentMonth.toFixed(2)}`,
          link: `/provider/${account.provider_id}`,
          linkText: 'View Details',
          metadata: {
            accountId: account.id,
            providerId: account.provider_id,
            currentMonth: costData.currentMonth
          }
        }).catch(err => console.error('[Sync] Failed to create notification:', err))

        results.push({
          accountId: account.id,
          accountAlias: account.account_alias,
          providerId: account.provider_id,
          status: 'success',
          costData: {
            currentMonth: costData.currentMonth,
            lastMonth: costData.lastMonth,
          },
        })
      } catch (error) {
        console.error(`Error syncing account ${accountLabel}:`, error)
        
        // Create error notification
        await createNotification(userId, {
          type: 'warning',
          title: `Sync Failed: ${accountLabel}`,
          message: error.message || 'Failed to sync cost data',
          link: `/provider/${account.provider_id}`,
          linkText: 'View Details',
          metadata: {
            accountId: account.id,
            providerId: account.provider_id,
            error: error.message
          }
        }).catch(err => console.error('[Sync] Failed to create error notification:', err))
        
        errors.push({
          accountId: account.id,
          accountAlias: account.account_alias,
          providerId: account.provider_id,
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
 * Sync cost data for a specific account
 * POST /api/sync/account/:accountId
 */
router.post('/account/:accountId', async (req, res) => {
  try {
    const userId = req.user.userId
    const accountId = parseInt(req.params.accountId, 10)

    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' })
    }

    // Get account credentials
    const accountData = await getCloudProviderCredentialsByAccountId(userId, accountId)

    if (!accountData || !accountData.credentials) {
      return res.status(404).json({ error: 'Account credentials not found' })
    }

    const { providerId, providerName, accountAlias, credentials } = accountData
    const accountLabel = accountAlias || `${providerId} (${accountId})`

    // Clear cost explanations cache for this account to ensure fresh summaries
    await clearCostExplanationsCache(userId, providerId, accountId)
    console.log(`[Sync] Cleared cost explanation cache for account: ${accountLabel}`)

    // Calculate date range - fetch last 365 days for historical data
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()
    const { startDate, endDate } = getDateRange(365)

    // Check cache first
    const cacheKey = `account-${accountId}-${startDate}-${endDate}`
    let costData = await getCachedCostData(userId, providerId, cacheKey)
    
    if (!costData) {
      // Fetch cost data from provider API
      costData = await fetchProviderCostData(providerId, credentials, startDate, endDate)
      
      // Cache the result for 60 minutes
      await setCachedCostData(userId, providerId, cacheKey, costData, 60)
    }

    // Save monthly cost data to database
    await saveCostData(
      userId,
      providerId,
      currentMonth,
      currentYear,
      {
        providerName: providerName,
        accountAlias: accountAlias,
        accountId: accountId,
        icon: getProviderIcon(providerId),
        currentMonth: costData.currentMonth,
        lastMonth: costData.lastMonth || costData.currentMonth * 0.95,
        forecast: costData.forecast || costData.currentMonth * 1.1,
        credits: costData.credits || 0,
        savings: costData.savings || 0,
        services: costData.services || [],
      }
    )

    // Save daily cost data for historical tracking (with account ID)
    if (costData.dailyData && costData.dailyData.length > 0) {
      await saveBulkDailyCostData(userId, providerId, costData.dailyData, accountId)
    }

    // Calculate anomaly baselines for all services (async, non-blocking)
    calculateBaselinesForServices(userId, providerId, accountId, costData)
      .catch(err => console.error(`[Sync] Baseline calculation failed for account ${accountId}:`, err.message))

    // Update last sync time for this account
    await updateCloudProviderSyncTime(userId, accountId)

    res.json({
      message: 'Sync completed successfully',
      accountId,
      accountAlias,
      providerId,
      costData: {
        currentMonth: costData.currentMonth,
        lastMonth: costData.lastMonth,
        forecast: costData.forecast,
      },
    })
  } catch (error) {
    console.error('Sync account error:', error)
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

/**
 * Legacy: Sync cost data for all accounts of a specific provider type
 * POST /api/sync/:providerId
 */
router.post('/:providerId', async (req, res) => {
  try {
    const userId = req.user.userId
    const { providerId } = req.params

    // Get all accounts for this provider type
    const allAccounts = await getUserCloudProviders(userId)
    const providerAccounts = allAccounts.filter(a => a.provider_id === providerId && a.is_active)

    if (providerAccounts.length === 0) {
      return res.status(404).json({ error: 'No active accounts found for this provider' })
    }

    // Clear cost explanations cache for this provider to ensure fresh summaries
    await clearCostExplanationsCache(userId, providerId)
    console.log(`[Sync] Cleared cost explanation cache for provider: ${providerId}`)

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()
    const { startDate, endDate } = getDateRange(365)

    const results = []
    const errors = []

    for (const account of providerAccounts) {
      try {
        const accountData = await getCloudProviderCredentialsByAccountId(userId, account.id)
        
        if (!accountData || !accountData.credentials) {
          errors.push({ accountId: account.id, error: 'Credentials not found' })
          continue
        }

        // Check cache first
        const cacheKey = `account-${account.id}-${startDate}-${endDate}`
        let costData = await getCachedCostData(userId, providerId, cacheKey)
        
        if (!costData) {
          costData = await fetchProviderCostData(providerId, accountData.credentials, startDate, endDate)
          await setCachedCostData(userId, providerId, cacheKey, costData, 60)
        }

        // Save data
        await saveCostData(userId, providerId, currentMonth, currentYear, {
          providerName: account.provider_name,
          accountAlias: account.account_alias,
          accountId: account.id,
          icon: getProviderIcon(providerId),
          currentMonth: costData.currentMonth,
          lastMonth: costData.lastMonth || costData.currentMonth * 0.95,
          forecast: costData.forecast || costData.currentMonth * 1.1,
          credits: costData.credits || 0,
          savings: costData.savings || 0,
          services: costData.services || [],
        })

        if (costData.dailyData && costData.dailyData.length > 0) {
          await saveBulkDailyCostData(userId, providerId, costData.dailyData, account.id)
        }

        // Calculate anomaly baselines for all services (async, non-blocking)
        calculateBaselinesForServices(userId, providerId, account.id, costData)
          .catch(err => console.error(`[Sync] Baseline calculation failed for account ${account.id}:`, err.message))

        await updateCloudProviderSyncTime(userId, account.id)

        results.push({
          accountId: account.id,
          accountAlias: account.account_alias,
          status: 'success',
          costData: { currentMonth: costData.currentMonth, lastMonth: costData.lastMonth },
        })
      } catch (error) {
        errors.push({ accountId: account.id, error: error.message })
      }
    }

    res.json({
      message: 'Sync completed',
      providerId,
      results,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Sync provider error:', error)
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

/**
 * Helper function to calculate anomaly baselines for all services after sync
 */
async function calculateBaselinesForServices(userId, providerId, accountId, costData) {
  try {
    // Get unique services from cost data
    const services = costData.services || []
    if (services.length === 0) {
      console.log(`[Baseline Calculation] No services found for ${providerId}, skipping baseline calculation`)
      return
    }

    // Calculate baselines for the last 7 days to ensure we have recent data
    const today = new Date()
    const datesToCalculate = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      datesToCalculate.push(date.toISOString().split('T')[0])
    }

    console.log(`[Baseline Calculation] Calculating baselines for ${services.length} services, ${datesToCalculate.length} dates`)

    // Calculate baselines for each service and date combination
    let calculated = 0
    let errors = 0
    
    for (const service of services) {
      const serviceName = service.name || service.service_name
      if (!serviceName) continue

      for (const date of datesToCalculate) {
        try {
          await calculateAnomalyBaseline(userId, providerId, serviceName, date, accountId)
          calculated++
        } catch (err) {
          // Log but don't fail - baseline calculation is best effort
          if (errors === 0) { // Only log first error to avoid spam
            console.error(`[Baseline Calculation] Error calculating baseline for ${serviceName} on ${date}:`, err.message)
          }
          errors++
        }
      }
    }

    console.log(`[Baseline Calculation] Completed: ${calculated} baselines calculated, ${errors} errors`)
    
    // Check for significant anomalies after baseline calculation
    // Only notify for very significant anomalies (>50% variance) to avoid notification spam
    try {
      const { getAnomalies } = await import('../database.js')
      const significantAnomalies = await getAnomalies(userId, providerId, 50, accountId) // 50% threshold
      
      if (significantAnomalies.length > 0) {
        // Get the most significant anomaly
        const topAnomaly = significantAnomalies[0]
        const variancePercent = topAnomaly.variancePercent || 0
        
        if (variancePercent >= 50) {
          await createNotification(userId, {
            type: 'anomaly',
            title: `Cost Anomaly Detected: ${topAnomaly.serviceName}`,
            message: `${topAnomaly.serviceName} costs are ${variancePercent.toFixed(1)}% ${topAnomaly.isIncrease ? 'higher' : 'lower'} than the 30-day baseline`,
            link: providerId ? `/provider/${providerId}?tab=analytics` : '/dashboard',
            linkText: 'View Anomalies',
            metadata: {
              providerId,
              accountId,
              serviceName: topAnomaly.serviceName,
              variancePercent,
              isIncrease: topAnomaly.isIncrease
            }
          }).catch(err => console.error('[Sync] Failed to create anomaly notification:', err))
        }
      }
    } catch (anomalyCheckError) {
      // Don't fail sync if anomaly check fails
      console.error(`[Baseline Calculation] Error checking anomalies:`, anomalyCheckError.message)
    }
  } catch (error) {
    // Don't fail sync if baseline calculation fails
    console.error(`[Baseline Calculation] Error calculating baselines:`, error.message)
  }
}

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
