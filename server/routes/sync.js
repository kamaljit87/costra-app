import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { syncLimiter } from '../middleware/rateLimiter.js'
import {
  getCloudProviderCredentialsByAccountId,
  getUserCloudProviders,
  saveCostData,
  saveBulkDailyCostData,
  saveServiceUsageMetrics,
  getCachedCostData,
  setCachedCostData,
  updateCloudProviderSyncTime,
  clearUserCache,
  clearCostExplanationsCache,
  calculateAnomalyBaseline,
  createNotification,
  pool
} from '../database.js'
import { del as cacheDel } from '../utils/cache.js'
import { fetchProviderCostData, getDateRange } from '../services/cloudProviderIntegrations.js'
import { getProviderAdapter } from '../services/providers/index.js'
import { writeCostCacheCSV } from '../services/costCacheCSV.js'

/** Date range for a calendar month (1-based month, full year). Uses UTC so server TZ doesn't change the month. */
function getDateRangeForMonth(month, year) {
  const start = new Date(Date.UTC(year, month - 1, 1))
  const endLastDay = new Date(Date.UTC(year, month, 0))
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: endLastDay.toISOString().split('T')[0],
  }
}
import { enhanceCostData } from '../utils/costCalculations.js'
import { sanitizeCostData, validateCostDataResponse } from '../utils/dataValidator.js'
import { runOptimizationForUser } from '../services/optimizationEngine.js'
import logger from '../utils/logger.js'

const router = express.Router()

// All routes require authentication
router.use(authenticateToken)

// Apply sync-specific rate limiting (20 requests/hour in production)
router.use(syncLimiter)

/**
 * Sync a single account — extracted for parallel execution.
 * Returns { result } on success or { error } on failure.
 */
async function syncSingleAccount({ account, userId, requestId, startDate, endDate, currentMonth, currentYear, forceRefresh }) {
  const accountLabel = account.account_alias || `${account.provider_id} (${account.id})`
  logger.info('Processing account', { requestId, userId, accountId: account.id, accountLabel })

  try {
    const accountData = await getCloudProviderCredentialsByAccountId(userId, account.id)

    if (!accountData) {
      logger.warn('No account data found', { requestId, userId, accountId: account.id, accountLabel })
      return { error: { accountId: account.id, accountAlias: account.account_alias, providerId: account.provider_id, error: 'Account not found' } }
    }

    // Use provider adapter for credential resolution (each provider handles its own logic)
    const adapter = getProviderAdapter(account.provider_id)
    if (!adapter) {
      logger.warn('No adapter found for provider', { requestId, userId, accountId: account.id, accountLabel, providerId: account.provider_id })
      return { error: { accountId: account.id, accountAlias: account.account_alias, providerId: account.provider_id, error: `Unsupported provider: ${account.provider_id}` } }
    }

    const { credentials: credentialsToUse, error: credError } = await adapter.resolveCredentials(account, accountData)
    if (credError || !credentialsToUse) {
      logger.warn('Credential resolution failed', { requestId, userId, accountId: account.id, accountLabel, error: credError })
      return { error: { accountId: account.id, accountAlias: account.account_alias, providerId: account.provider_id, error: credError || 'Credentials not found' } }
    }

    logger.debug('Using credentials for account', { requestId, userId, accountId: account.id, accountLabel, connectionType: accountData.connectionType || 'manual' })

    // Check cache first (unless force refresh is requested)
    const cacheKey = `account-${account.id}-${startDate}-${endDate}`
    let costData = forceRefresh ? null : await getCachedCostData(userId, account.provider_id, cacheKey)

    if (costData && !forceRefresh) {
      logger.debug('Using cached data', { requestId, userId, accountId: account.id, accountLabel })
    } else {
      if (forceRefresh) {
        logger.debug('Force refresh requested', { requestId, userId, accountId: account.id, accountLabel })
      }
      logger.info('Fetching fresh data', { requestId, userId, accountId: account.id, accountLabel })
      costData = await adapter.fetchCostData(credentialsToUse, startDate, endDate)

      // Synthesize daily data for providers that don't give daily granularity (e.g. Linode, DO, Vultr, IBM)
      const synthesized = adapter.synthesizeDailyData(costData, startDate, endDate)
      if (synthesized && synthesized.length > 0) {
        costData.dailyData = synthesized
      }

      logger.info('Fetched data for account', {
        requestId, userId, accountId: account.id, accountLabel,
        currentMonth: costData.currentMonth?.toFixed(2) || 0,
        lastMonth: costData.lastMonth?.toFixed(2) || 0,
        dailyDataPoints: costData.dailyData?.length || 0,
        servicesCount: costData.services?.length || 0,
      })

      await setCachedCostData(userId, account.provider_id, cacheKey, costData, 60)
    }

    // Validate and sanitize cost data
    const validation = validateCostDataResponse(costData)
    if (!validation.valid) {
      logger.warn('Cost data validation failed, but continuing', { requestId, userId, accountId: account.id, errors: validation.errors })
    }

    const enhancedData = await enhanceCostData(costData, account.provider_id, credentialsToUse, currentYear, currentMonth, costData.dailyData)
    const sanitizedData = sanitizeCostData(enhancedData)

    // Save monthly cost data
    logger.debug('Saving monthly cost data', { requestId, userId, accountId: account.id, accountLabel })
    await saveCostData(userId, account.provider_id, currentMonth, currentYear, {
      providerName: account.provider_name,
      accountAlias: account.account_alias,
      accountId: account.id,
      icon: getProviderIcon(account.provider_id),
      currentMonth: sanitizedData.currentMonth,
      lastMonth: sanitizedData.lastMonth,
      forecast: sanitizedData.forecast,
      forecastConfidence: sanitizedData.forecastConfidence,
      credits: sanitizedData.credits || 0,
      savings: sanitizedData.savings || 0,
      services: sanitizedData.services || [],
      taxCurrentMonth: sanitizedData.taxCurrentMonth || 0,
      taxLastMonth: sanitizedData.taxLastMonth || 0,
    })

    // Save daily cost data for historical tracking
    if (costData.dailyData && costData.dailyData.length > 0) {
      logger.debug('Saving daily data points', { requestId, userId, accountId: account.id, accountLabel, dailyDataCount: costData.dailyData.length })
      await saveBulkDailyCostData(userId, account.provider_id, costData.dailyData, account.id)
    }

    await writeCostCacheCSV(userId, account.id, currentYear, currentMonth, {
      dailyData: costData.dailyData || [],
      services: sanitizedData.services || [],
      total: sanitizedData.currentMonth,
    }).catch(() => {})

    // Save service-level cost + usage for Cost vs Usage analytics (AWS returns serviceUsageMetrics)
    if (costData.serviceUsageMetrics?.length > 0) {
      try {
        await saveServiceUsageMetrics(userId, account.id, account.provider_id, costData.serviceUsageMetrics)
        logger.debug('Service usage metrics saved', { requestId, userId, accountId: account.id, count: costData.serviceUsageMetrics.length })
      } catch (metricsErr) {
        logger.warn('Failed to save service usage metrics (non-fatal)', { requestId, userId, accountId: account.id, error: metricsErr.message })
      }
    }

    // Calculate anomaly baselines (async, non-blocking)
    calculateBaselinesForServices(userId, account.provider_id, account.id, costData)
      .catch(err => logger.error('Baseline calculation failed', { requestId, userId, accountId: account.id, accountLabel, error: err.message, stack: err.stack }))

    // Run optimization analysis (async, non-blocking)
    runOptimizationForUser(userId)
      .catch(err => logger.error('Optimization analysis failed after sync', { userId, error: err.message }))

    await updateCloudProviderSyncTime(userId, account.id)

    await createNotification(userId, {
      type: 'sync',
      title: `Sync Completed: ${accountLabel}`,
      message: `Successfully synced cost data. Current month: $${Number(costData.currentMonth ?? 0).toFixed(2)}`,
      link: `/provider/${account.provider_id}`,
      linkText: 'View Details',
      metadata: { accountId: account.id, providerId: account.provider_id, currentMonth: costData.currentMonth }
    }).catch(err => logger.error('Failed to create notification', { requestId, userId, error: err.message, stack: err.stack }))

    return {
      result: {
        accountId: account.id,
        accountAlias: account.account_alias,
        providerId: account.provider_id,
        status: 'success',
        costData: { currentMonth: costData.currentMonth, lastMonth: costData.lastMonth },
      }
    }
  } catch (error) {
    logger.error('Error syncing account', { requestId, userId, accountId: account.id, accountLabel, error: error.message, stack: error.stack })

    await createNotification(userId, {
      type: 'warning',
      title: `Sync Failed: ${accountLabel}`,
      message: error.message || 'Failed to sync cost data',
      link: `/provider/${account.provider_id}`,
      linkText: 'View Details',
      metadata: { accountId: account.id, providerId: account.provider_id, error: error.message }
    }).catch(err => logger.error('Failed to create error notification', { requestId, userId, error: err.message, stack: err.stack }))

    return { error: { accountId: account.id, accountAlias: account.account_alias, providerId: account.provider_id, error: error.message } }
  }
}

/**
 * Sync cost data from all active cloud provider accounts
 * POST /api/sync
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { accountId } = req.body // Optional: sync specific account

    logger.info('Starting sync', { requestId: req.requestId, userId, accountId: accountId || 'ALL' })

    // Clear user cache first to ensure fresh data
    const clearedCount = await clearUserCache(userId)
    logger.debug('Cleared cache entries', { requestId: req.requestId, userId, clearedCount })
    
    // Clear cost explanations cache to ensure fresh summaries after sync
    const clearedExplanations = await clearCostExplanationsCache(userId)
    logger.debug('Cleared cost explanation cache', { requestId: req.requestId, userId, clearedExplanations })

    // Get all active provider accounts or specific account
    let accounts = await getUserCloudProviders(userId)
    
    // Filter by specific account if provided
    if (accountId) {
      accounts = accounts.filter(a => a.id === parseInt(accountId, 10))
    }

    logger.info('Found accounts to sync', { requestId: req.requestId, userId, accountCount: accounts.length })

    if (accounts.length === 0) {
      return res.status(200).json({
        message: 'No cloud providers connected. Add a cloud provider to start syncing cost data.',
        results: [],
        noProviders: true,
      })
    }

    const results = []
    const errors = []

    // Calculate date range - fetch last 365 days for historical data
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    // Fetch 365 days of data for full year historical tracking
    const { startDate, endDate } = getDateRange(365)
    logger.debug('Sync date range', { requestId: req.requestId, userId, startDate, endDate })

    const forceRefresh = req.query.force === 'true'
    const activeAccounts = accounts.filter(a => a.is_active !== false)

    // Process all accounts in parallel for faster sync
    const syncResults = await Promise.allSettled(
      activeAccounts.map(account => syncSingleAccount({
        account, userId, requestId: req.requestId,
        startDate, endDate, currentMonth, currentYear, forceRefresh,
      }))
    )

    for (let i = 0; i < syncResults.length; i++) {
      const settled = syncResults[i]
      if (settled.status === 'fulfilled') {
        if (settled.value.error) {
          errors.push(settled.value.error)
        } else {
          results.push(settled.value.result)
        }
      } else {
        const account = activeAccounts[i]
        errors.push({
          accountId: account.id,
          accountAlias: account.account_alias,
          providerId: account.provider_id,
          error: settled.reason?.message || 'Unknown sync error',
        })
      }
    }

    // Use appropriate status code based on results
    const statusCode = errors.length > 0
      ? (results.length > 0 ? 207 : 500)  // 207 partial success, 500 total failure
      : 200

    const responseBody = {
      message: errors.length > 0
        ? (results.length > 0 ? 'Sync completed with errors' : 'Sync failed for all accounts')
        : 'Sync completed',
      results,
      errors: errors.length > 0 ? errors : undefined,
    }
    // Add error field for non-ok responses so frontend apiRequest can parse it
    if (statusCode >= 400) {
      responseBody.error = errors.map(e => `${e.accountAlias || e.providerId}: ${e.error}`).join('; ')
    }
    res.status(statusCode).json(responseBody)
  } catch (error) {
    logger.error('Sync error', { requestId: req.requestId, userId: req.user?.userId, error: error.message, stack: error.stack })
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * Fetch and save cost data for a specific month (e.g. when compare page has no data for that month).
 * POST /api/sync/fetch-month
 * Body: { providerId: string, month: number, year: number }
 */
router.post('/fetch-month', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { providerId, month, year } = req.body || {}

    if (!providerId || !month || !year) {
      return res.status(400).json({ error: 'providerId, month, and year are required' })
    }
    const monthNum = parseInt(month, 10)
    const yearNum = parseInt(year, 10)
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12 || isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
      return res.status(400).json({ error: 'Invalid month or year' })
    }

    const providerAccounts = await getUserCloudProviders(userId)
    const providerIdLower = String(providerId || '').toLowerCase().trim()
    const accounts = providerAccounts.filter(
      a => String(a.provider_id || '').toLowerCase().trim() === providerIdLower && a.is_active !== false
    )
    if (accounts.length === 0) {
      logger.warn('Fetch-month: no active accounts for provider', { userId, providerId, providerIdLower })
      return res.status(404).json({ error: 'No active accounts found for this provider' })
    }

    const { startDate, endDate } = getDateRangeForMonth(monthNum, yearNum)
    logger.info('Fetch-month: fetching data for period', { userId, providerId, month: monthNum, year: yearNum, startDate, endDate })

    const results = []
    const errors = []

    for (const account of accounts) {
      try {
        const accountData = await getCloudProviderCredentialsByAccountId(userId, account.id)
        if (!accountData) {
          errors.push({ accountId: account.id, error: 'Account not found' })
          continue
        }

        const fetchAdapter = getProviderAdapter(account.provider_id)
        if (!fetchAdapter) {
          errors.push({ accountId: account.id, error: `Unsupported provider: ${account.provider_id}` })
          continue
        }
        const { credentials: credentialsToUse, error: credResolveErr } = await fetchAdapter.resolveCredentials(account, accountData)
        if (credResolveErr || !credentialsToUse) {
          errors.push({ accountId: account.id, error: credResolveErr || 'Credentials not found' })
          continue
        }

        const costData = await fetchAdapter.fetchCostData(credentialsToUse, startDate, endDate)
        // Synthesize daily data for invoice-based providers
        const synthDaily = fetchAdapter.synthesizeDailyData(costData, startDate, endDate)
        if (synthDaily && synthDaily.length > 0) {
          costData.dailyData = synthDaily
        }
        const validation = validateCostDataResponse(costData)
        if (!validation.valid) {
          logger.warn('Fetch-month: validation failed, continuing', { userId, accountId: account.id, errors: validation.errors })
        }

        // fetchProviderCostData calculates currentMonth/lastMonth relative to today's date,
        // which gives 0 for historical months. Recalculate the total for the target month
        // from daily data so the saved cost_data.current_month_cost is accurate.
        const targetMonthTotal = (costData.dailyData || []).reduce((sum, d) => {
          const dayDate = new Date(d.date)
          if (dayDate.getUTCFullYear() === yearNum && dayDate.getUTCMonth() + 1 === monthNum) {
            return sum + (parseFloat(d.cost) || 0)
          }
          return sum
        }, 0)
        if (targetMonthTotal > 0 && costData.currentMonth === 0) {
          costData.currentMonth = targetMonthTotal
          logger.info('Fetch-month: recalculated currentMonth from daily data', {
            userId, accountId: account.id, month: monthNum, year: yearNum,
            total: targetMonthTotal.toFixed(2),
          })
        }

        const enhancedData = await enhanceCostData(
          costData,
          providerId,
          credentialsToUse,
          yearNum,
          monthNum,
          costData.dailyData
        )
        const sanitizedData = sanitizeCostData(enhancedData)

        await saveCostData(userId, providerId, monthNum, yearNum, {
          providerName: account.provider_name,
          accountAlias: account.account_alias,
          accountId: account.id,
          icon: getProviderIcon(providerId),
          currentMonth: sanitizedData.currentMonth,
          lastMonth: sanitizedData.lastMonth,
          forecast: sanitizedData.forecast,
          forecastConfidence: sanitizedData.forecastConfidence,
          credits: sanitizedData.credits || 0,
          savings: sanitizedData.savings || 0,
          services: sanitizedData.services || [],
          taxCurrentMonth: sanitizedData.taxCurrentMonth || 0,
          taxLastMonth: sanitizedData.taxLastMonth || 0,
        })
        logger.info('Fetch-month: saved cost_data', { userId, providerId, accountId: account.id, month: monthNum, year: yearNum })

        if (costData.dailyData && costData.dailyData.length > 0) {
          await saveBulkDailyCostData(userId, providerId, costData.dailyData, account.id)
        }
        if (costData.serviceUsageMetrics?.length > 0) {
          try {
            await saveServiceUsageMetrics(userId, account.id, providerId, costData.serviceUsageMetrics)
          } catch (metricsErr) {
            logger.warn('Fetch-month: saveServiceUsageMetrics failed (non-fatal)', { accountId: account.id, error: metricsErr.message })
          }
        }

        await writeCostCacheCSV(userId, account.id, yearNum, monthNum, {
          dailyData: costData.dailyData || [],
          services: sanitizedData.services || [],
          total: sanitizedData.currentMonth,
        }).catch(() => {})

        await clearUserCache(userId).catch(() => {})
        await cacheDel(`cost_data:${userId}:${monthNum}:${yearNum}`).catch(() => {})
        results.push({ accountId: account.id, accountAlias: account.account_alias, status: 'success' })
      } catch (err) {
        logger.error('Fetch-month: account failed', { userId, accountId: account.id, providerId, error: err.message, stack: err.stack })
        errors.push({ accountId: account.id, error: err.message || 'Unknown error' })
      }
    }

    const statusCode = errors.length > 0 ? (results.length > 0 ? 207 : 500) : 200
    const message = errors.length > 0
      ? (results.length > 0 ? 'Fetched with some errors' : 'Failed to fetch data for this month')
      : 'Data fetched and saved'
    const firstErrorDetail = errors.length > 0 ? errors[0].error : null
    res.status(statusCode).json({
      message,
      error: statusCode === 500 && firstErrorDetail ? `${message}: ${firstErrorDetail}` : undefined,
      providerId,
      month: monthNum,
      year: yearNum,
      results,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    logger.error('Fetch-month error', { userId: req.user?.userId, error: error.message, stack: error.stack })
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

/**
 * Sync cost data for a specific account
 * POST /api/sync/account/:accountId
 */
router.post('/account/:accountId', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const accountId = parseInt(req.params.accountId, 10)

    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' })
    }

    // Get account credentials
    const accountData = await getCloudProviderCredentialsByAccountId(userId, accountId)

    if (!accountData) {
      return res.status(404).json({ error: 'Account not found' })
    }

    const { providerId, providerName, accountAlias } = accountData
    const accountLabel = accountAlias || `${providerId} (${accountId})`

    // Use provider adapter for credential resolution
    const acctAdapter = getProviderAdapter(providerId)
    if (!acctAdapter) {
      return res.status(400).json({ error: `Unsupported provider: ${providerId}` })
    }

    const { credentials: credentialsToUse, error: credErr } = await acctAdapter.resolveCredentials(
      { id: accountId, provider_id: providerId },
      accountData
    )
    if (credErr || !credentialsToUse) {
      return res.status(400).json({ error: credErr || 'Account credentials not found or invalid' })
    }

    // Clear cost explanations cache for this account to ensure fresh summaries
    await clearCostExplanationsCache(userId, providerId, accountId)
    logger.debug('Cleared cost explanation cache for account', { requestId: req.requestId, userId, accountId, accountLabel })

    // Calculate date range - fetch last 365 days for historical data
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()
    const { startDate, endDate } = getDateRange(365)

    // Check cache first
    const cacheKey = `account-${accountId}-${startDate}-${endDate}`
    let costData = await getCachedCostData(userId, providerId, cacheKey)
    
    if (!costData) {
      // Fetch cost data from provider API using the appropriate credentials
      costData = await acctAdapter.fetchCostData(credentialsToUse, startDate, endDate)

      // Synthesize daily data for invoice-based providers
      const acctSynthDaily = acctAdapter.synthesizeDailyData(costData, startDate, endDate)
      if (acctSynthDaily && acctSynthDaily.length > 0) {
        costData.dailyData = acctSynthDaily
      }

      // Cache the result for 60 minutes
      await setCachedCostData(userId, providerId, cacheKey, costData, 60)
    }

    // Validate and sanitize cost data
    const validation = validateCostDataResponse(costData)
    if (!validation.valid) {
      logger.warn('Cost data validation failed, but continuing', {
        requestId: req.requestId,
        userId,
        accountId,
        errors: validation.errors,
      })
    }

    // Enhance cost data with accurate lastMonth and forecast
    const enhancedData = await enhanceCostData(
      costData,
      providerId,
      credentialsToUse,
      currentYear,
      currentMonth,
      costData.dailyData
    )

    // Sanitize data before saving
    const sanitizedData = sanitizeCostData(enhancedData)

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
        currentMonth: sanitizedData.currentMonth,
        lastMonth: sanitizedData.lastMonth, // No fallback - use actual data or null
        forecast: sanitizedData.forecast, // Calculated from trend, not fixed percentage
        credits: sanitizedData.credits || 0,
        savings: sanitizedData.savings || 0,
        services: sanitizedData.services || [],
        taxCurrentMonth: sanitizedData.taxCurrentMonth || 0,
        taxLastMonth: sanitizedData.taxLastMonth || 0,
      }
    )

    // Save daily cost data for historical tracking (with account ID)
    if (costData.dailyData && costData.dailyData.length > 0) {
      await saveBulkDailyCostData(userId, providerId, costData.dailyData, accountId)
    }

    await writeCostCacheCSV(userId, accountId, currentYear, currentMonth, {
      dailyData: costData.dailyData || [],
      services: sanitizedData.services || [],
      total: sanitizedData.currentMonth,
    }).catch(() => {})

    // Calculate anomaly baselines for all services (async, non-blocking)
    calculateBaselinesForServices(userId, providerId, accountId, costData)
      .catch(err => logger.error('Baseline calculation failed for account', { requestId: req.requestId, userId, accountId, error: err.message, stack: err.stack }))

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
    logger.error('Sync account error', { requestId: req.requestId, userId, accountId, error: error.message, stack: error.stack })
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

/**
 * Legacy: Sync cost data for all accounts of a specific provider type
 * POST /api/sync/:providerId
 */
router.post('/:providerId', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { providerId } = req.params

    // Get all accounts for this provider type (case-insensitive for provider_id)
    const allAccounts = await getUserCloudProviders(userId)
    const providerIdNorm = String(providerId || '').toLowerCase().trim()
    const providerAccounts = allAccounts.filter(
      a => String(a.provider_id || '').toLowerCase().trim() === providerIdNorm && a.is_active !== false
    )

    if (providerAccounts.length === 0) {
      return res.status(404).json({ error: 'No active accounts found for this provider' })
    }

    // Clear cost explanations cache for this provider to ensure fresh summaries
    await clearCostExplanationsCache(userId, providerId)
    logger.debug('Cleared cost explanation cache for provider', { requestId: req.requestId, userId, providerId })

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
          const legacyAdapter = getProviderAdapter(providerId)
          if (legacyAdapter) {
            costData = await legacyAdapter.fetchCostData(accountData.credentials, startDate, endDate)
            const legacySynth = legacyAdapter.synthesizeDailyData(costData, startDate, endDate)
            if (legacySynth && legacySynth.length > 0) {
              costData.dailyData = legacySynth
            }
          } else {
            costData = await fetchProviderCostData(providerId, accountData.credentials, startDate, endDate)
          }
          await setCachedCostData(userId, providerId, cacheKey, costData, 60)
        }

        // Validate and sanitize cost data
        const validation = validateCostDataResponse(costData)
        if (!validation.valid) {
          logger.warn('Cost data validation failed, but continuing', {
            requestId: req.requestId,
            userId,
            accountId: account.id,
            errors: validation.errors,
          })
        }

        // Enhance cost data with accurate lastMonth and forecast
        const enhancedData = await enhanceCostData(
          costData,
          providerId,
          accountData.credentials,
          currentYear,
          currentMonth,
          costData.dailyData
        )

        // Sanitize data before saving
        const sanitizedData = sanitizeCostData(enhancedData)

        // Save data
        await saveCostData(userId, providerId, currentMonth, currentYear, {
          providerName: account.provider_name,
          accountAlias: account.account_alias,
          accountId: account.id,
          icon: getProviderIcon(providerId),
          currentMonth: sanitizedData.currentMonth,
          lastMonth: sanitizedData.lastMonth, // No fallback - use actual data or null
          forecast: sanitizedData.forecast, // Calculated from trend, not fixed percentage
          credits: sanitizedData.credits || 0,
          savings: sanitizedData.savings || 0,
          services: sanitizedData.services || [],
          taxCurrentMonth: sanitizedData.taxCurrentMonth || 0,
          taxLastMonth: sanitizedData.taxLastMonth || 0,
        })

        if (costData.dailyData && costData.dailyData.length > 0) {
          await saveBulkDailyCostData(userId, providerId, costData.dailyData, account.id)
        }

        await writeCostCacheCSV(userId, account.id, currentYear, currentMonth, {
          dailyData: costData.dailyData || [],
          services: sanitizedData.services || [],
          total: sanitizedData.currentMonth,
        }).catch(() => {})

        // Calculate anomaly baselines for all services (async, non-blocking)
        calculateBaselinesForServices(userId, providerId, account.id, costData)
          .catch(err => logger.error('Baseline calculation failed for account (provider sync)', { requestId: req.requestId, userId, accountId: account.id, providerId, error: err.message, stack: err.stack }))

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

    if (results.length > 0) {
      await cacheDel(`cost_data:${userId}:${currentMonth}:${currentYear}`).catch(() => {})
    }

    const statusCode = errors.length > 0
      ? (results.length > 0 ? 207 : 500)
      : 200

    const responseBody = {
      message: errors.length > 0
        ? (results.length > 0 ? 'Sync completed with errors' : 'Sync failed for all accounts')
        : 'Sync completed',
      providerId,
      results,
      errors: errors.length > 0 ? errors : undefined,
    }
    if (statusCode >= 400) {
      responseBody.error = errors.map(e => `Account ${e.accountId}: ${e.error}`).join('; ')
    }
    res.status(statusCode).json(responseBody)
  } catch (error) {
    logger.error('Sync provider error', { requestId: req.requestId, userId, providerId, error: error.message, stack: error.stack })
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
      logger.debug('No services found for baseline calculation', { userId, providerId, accountId })
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

    logger.debug('Calculating baselines', { userId, providerId, accountId, servicesCount: services.length, datesCount: datesToCalculate.length })

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
            logger.error('Error calculating baseline', { userId, providerId, accountId, serviceName, date, error: err.message, stack: err.stack })
          }
          errors++
        }
      }
    }

    logger.info('Baseline calculation completed', { userId, providerId, accountId, calculated, errors })
    
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
          }).catch(err => logger.error('Failed to create anomaly notification', { userId, error: err.message, stack: err.stack }))
          
          // Send email alert (Pro only)
          try {
            const { sendAnomalyAlert } = await import('../services/emailService.js')
            await sendAnomalyAlert(userId, {
              serviceName: topAnomaly.serviceName,
              variancePercent,
              currentCost: topAnomaly.currentCost || 0,
              baselineCost: topAnomaly.baselineCost || 0,
              isIncrease: topAnomaly.isIncrease,
              date: topAnomaly.baselineDate,
              providerId,
            })
          } catch (emailError) {
            // Don't fail sync if email fails
            logger.error('Failed to send anomaly email', { userId, error: emailError.message })
          }
        }
      }
    } catch (anomalyCheckError) {
      // Don't fail sync if anomaly check fails
      logger.error('Error checking anomalies', { userId, providerId, accountId, error: anomalyCheckError.message, stack: anomalyCheckError.stack })
    }
  } catch (error) {
    // Don't fail sync if baseline calculation fails
    logger.error('Error calculating baselines', { userId, providerId, accountId, error: error.message, stack: error.stack })
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
