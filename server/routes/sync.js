import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { syncLimiter } from '../middleware/rateLimiter.js'
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

    // Handle automated AWS connections (role-based)
    let credentialsToUse = accountData.credentials || {}
    if (account.provider_id === 'aws' && accountData.connectionType?.startsWith('automated')) {
      logger.info('Automated AWS connection detected', { requestId, userId, accountId: account.id, accountLabel })

      if (!accountData.roleArn || !accountData.externalId) {
        logger.warn('Missing roleArn or externalId for automated connection', { requestId, userId, accountId: account.id, accountLabel })
        return { error: { accountId: account.id, accountAlias: account.account_alias, providerId: account.provider_id, error: 'Automated connection missing role ARN or external ID' } }
      }

      try {
        const { STSClient, AssumeRoleCommand } = await import('@aws-sdk/client-sts')
        const stsClient = new STSClient({ region: 'us-east-1' })
        const assumeRoleCommand = new AssumeRoleCommand({
          RoleArn: accountData.roleArn,
          RoleSessionName: `costra-sync-${account.id}-${Date.now()}`,
          ExternalId: accountData.externalId,
          DurationSeconds: 3600,
        })

        logger.info('Assuming role for automated connection', { requestId, userId, accountId: account.id, accountLabel, roleArn: accountData.roleArn })
        const assumeRoleResponse = await stsClient.send(assumeRoleCommand)

        if (!assumeRoleResponse.Credentials) {
          throw new Error('Failed to assume role: No credentials returned')
        }

        credentialsToUse = {
          accessKeyId: assumeRoleResponse.Credentials.AccessKeyId,
          secretAccessKey: assumeRoleResponse.Credentials.SecretAccessKey,
          sessionToken: assumeRoleResponse.Credentials.SessionToken,
          region: 'us-east-1',
        }
        logger.info('Successfully assumed role', { requestId, userId, accountId: account.id, accountLabel })
      } catch (assumeError) {
        logger.error('Failed to assume role for automated connection', { requestId, userId, accountId: account.id, accountLabel, error: assumeError.message, stack: assumeError.stack, code: assumeError.code })
        let errorMessage = assumeError.message || assumeError.code || 'Unknown error'
        if (assumeError.message?.includes('Could not load credentials') || assumeError.code === 'CredentialsError') {
          errorMessage = 'Server AWS credentials not configured. The server needs AWS credentials (from AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY environment variables or IAM instance profile) to assume the role in your AWS account. Please configure server-side AWS credentials.'
        } else if (assumeError.code === 'AccessDenied') {
          errorMessage = 'Access denied when assuming role. Please verify: 1) The CloudFormation stack was created successfully, 2) The role ARN is correct, 3) The external ID matches, 4) Costra\'s AWS account has permission to assume the role.'
        } else if (assumeError.code === 'InvalidClientTokenId') {
          errorMessage = 'Invalid AWS credentials. Please check that the server\'s AWS credentials are valid and have permission to assume roles.'
        }
        return { error: { accountId: account.id, accountAlias: account.account_alias, providerId: account.provider_id, error: errorMessage } }
      }
    } else if (!credentialsToUse || Object.keys(credentialsToUse).length === 0) {
      logger.warn('No credentials found', { requestId, userId, accountId: account.id, accountLabel })
      return { error: { accountId: account.id, accountAlias: account.account_alias, providerId: account.provider_id, error: 'Credentials not found' } }
    } else if (account.provider_id === 'aws' && (!credentialsToUse.accessKeyId || !credentialsToUse.secretAccessKey)) {
      logger.warn('AWS credentials incomplete (missing accessKeyId or secretAccessKey)', { requestId, userId, accountId: account.id, accountLabel })
      return { error: { accountId: account.id, accountAlias: account.account_alias, providerId: account.provider_id, error: 'AWS credentials invalid (missing Access Key ID or Secret Access Key)' } }
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
      costData = await fetchProviderCostData(account.provider_id, credentialsToUse, startDate, endDate)

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
      message: `Successfully synced cost data. Current month: $${costData.currentMonth.toFixed(2)}`,
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
    
    // Handle automated AWS connections (role-based)
    let credentialsToUse = accountData.credentials || {}
    if (providerId === 'aws' && accountData.connectionType?.startsWith('automated')) {
      logger.info('Automated AWS connection detected (account sync)', { requestId: req.requestId, userId, accountId, accountLabel })
      
      if (!accountData.roleArn || !accountData.externalId) {
        return res.status(400).json({ 
          error: 'Automated connection missing role ARN or external ID',
          details: 'Please verify the connection was set up correctly.'
        })
      }
      
      try {
        // Assume the role to get temporary credentials
        // Note: The server needs AWS credentials (from environment variables, IAM instance profile, etc.)
        // to assume the role in the user's account
        const { STSClient, AssumeRoleCommand } = await import('@aws-sdk/client-sts')
        
        // Check if we have AWS credentials available
        // AWS SDK will automatically check: environment variables, IAM instance profile, etc.
        const stsClient = new STSClient({ 
          region: 'us-east-1',
          // Don't specify credentials - let SDK use default credential chain
        })
        
        const assumeRoleCommand = new AssumeRoleCommand({
          RoleArn: accountData.roleArn,
          RoleSessionName: `costra-sync-${accountId}-${Date.now()}`,
          ExternalId: accountData.externalId,
          DurationSeconds: 3600, // 1 hour
        })
        
        logger.info('Assuming role for automated connection (account sync)', { requestId: req.requestId, userId, accountId, accountLabel, roleArn: accountData.roleArn })
        const assumeRoleResponse = await stsClient.send(assumeRoleCommand)
        
        if (!assumeRoleResponse.Credentials) {
          throw new Error('Failed to assume role: No credentials returned')
        }
        
        // Use temporary credentials from role assumption
        credentialsToUse = {
          accessKeyId: assumeRoleResponse.Credentials.AccessKeyId,
          secretAccessKey: assumeRoleResponse.Credentials.SecretAccessKey,
          sessionToken: assumeRoleResponse.Credentials.SessionToken,
          region: 'us-east-1',
        }
        
        logger.info('Successfully assumed role (account sync)', { requestId: req.requestId, userId, accountId, accountLabel })
      } catch (assumeError) {
        logger.error('Failed to assume role for automated connection (account sync)', { requestId: req.requestId, userId, accountId, accountLabel, error: assumeError.message, stack: assumeError.stack, code: assumeError.code })
        
        // Provide helpful error message
        let errorMessage = assumeError.message || assumeError.code || 'Unknown error'
        let errorDetails = ''
        
        if (assumeError.message?.includes('Could not load credentials') || 
            assumeError.code === 'CredentialsError') {
          errorMessage = 'Server AWS credentials not configured'
          errorDetails = 'The server needs AWS credentials (from AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY environment variables or IAM instance profile) to assume the role in your AWS account. Please configure server-side AWS credentials in the server/.env file or as environment variables.'
        } else if (assumeError.code === 'AccessDenied') {
          errorMessage = 'Access denied when assuming role'
          errorDetails = 'Please verify: 1) The CloudFormation stack was created successfully, 2) The role ARN is correct, 3) The external ID matches, 4) Costra\'s AWS account has permission to assume the role.'
        } else if (assumeError.code === 'InvalidClientTokenId') {
          errorMessage = 'Invalid AWS credentials'
          errorDetails = 'Please check that the server\'s AWS credentials are valid and have permission to assume roles.'
        }
        
        return res.status(500).json({ 
          error: errorMessage,
          details: errorDetails || assumeError.message || assumeError.code || 'Unknown error'
        })
      }
    } else if (!credentialsToUse || Object.keys(credentialsToUse).length === 0 || 
               !credentialsToUse.accessKeyId || !credentialsToUse.secretAccessKey) {
      // For non-automated connections, validate credentials exist
      return res.status(404).json({ error: 'Account credentials not found or invalid' })
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
      costData = await fetchProviderCostData(providerId, credentialsToUse, startDate, endDate)
      
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

    // Get all accounts for this provider type
    const allAccounts = await getUserCloudProviders(userId)
    const providerAccounts = allAccounts.filter(a => a.provider_id === providerId && a.is_active)

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
          costData = await fetchProviderCostData(providerId, accountData.credentials, startDate, endDate)
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
