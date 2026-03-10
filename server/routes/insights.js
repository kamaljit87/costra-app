import express from 'express'
import {
  getAnomalyEvents, updateAnomalyEventStatus,
} from '../database.js'
import {
  getCostVsUsage,
  getUntaggedResources,
  getAnomalies,
  calculateAnomalyBaseline,
  generateCostExplanation,
  generateCustomDateRangeExplanation,
  getCostExplanation,
  getCostByDimension,
  getAvailableDimensions,
  saveBusinessMetric,
  deleteBusinessMetric,
  getBusinessMetrics,
  getUnitEconomics,
  getCostEfficiencyMetrics,
  getRightsizingRecommendations,
  getCostByProduct,
  getCostByTeam,
  getProductCostTrends,
  getTeamCostTrends,
  getProductServiceBreakdown,
  getTeamServiceBreakdown,
  getOptimizationRecommendations,
  getOptimizationSummary,
  dismissOptimizationRecommendation,
  markRecommendationImplemented,
  getCloudProviderCredentialsByAccountId,
  pool,
} from '../database.js'
import { authenticateToken } from '../middleware/auth.js'
import { runOptimizationForUser } from '../services/optimizationEngine.js'
import {
  fetchAWSRightsizingRecommendations,
  fetchAzureRightsizingRecommendations,
  fetchGCPRightsizingRecommendations,
} from '../services/cloudProviderIntegrations.js'
import { fetchCloudWatchRightsizing } from '../services/rightsizingService.js'
import logger from '../utils/logger.js'
import { cached } from '../utils/cache.js'

const router = express.Router()

/**
 * GET /api/insights/cost-vs-usage
 * Get cost and usage side-by-side for services
 */
router.get('/cost-vs-usage', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { providerId, startDate, endDate, accountId } = req.query
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' })
    }
    
    const data = await getCostVsUsage(
      userId,
      providerId || null,
      startDate,
      endDate,
      accountId ? parseInt(accountId) : null
    )
    
    res.json({ data })
  } catch (error) {
    logger.error('Cost vs usage error', { 
      userId: req.user?.id, 
      providerId, 
      startDate, 
      endDate, 
      accountId, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to fetch cost vs usage data' })
  }
})

/**
 * GET /api/insights/untagged-resources
 * Get untagged resources ranked by cost impact
 */
router.get('/untagged-resources', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { providerId, limit = 50, accountId } = req.query
    
    const resources = await getUntaggedResources(
      userId,
      providerId || null,
      parseInt(limit),
      accountId ? parseInt(accountId) : null
    )
    
    // Calculate total untagged cost
    const totalCost = resources.reduce((sum, r) => sum + r.cost, 0)
    
    res.json({
      resources,
      totalCost,
      count: resources.length,
      message: resources.length > 0 
        ? `Found ${resources.length} untagged resources costing $${totalCost.toFixed(2)} total`
        : 'All resources are tagged'
    })
  } catch (error) {
    logger.error('Untagged resources error', { 
      userId: req.user?.id, 
      providerId, 
      limit, 
      accountId, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to fetch untagged resources' })
  }
})

/**
 * GET /api/insights/anomalies
 * Get cost anomalies vs 30-day baseline
 */
router.get('/anomalies', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { providerId, thresholdPercent = 20, accountId } = req.query
    
    const anomalies = await getAnomalies(
      userId,
      providerId || null,
      parseFloat(thresholdPercent),
      accountId ? parseInt(accountId) : null
    )
    
    res.json({
      anomalies,
      count: anomalies.length,
      thresholdPercent: parseFloat(thresholdPercent)
    })
  } catch (error) {
    logger.error('Anomalies error', { 
      userId: req.user?.id, 
      providerId, 
      limit, 
      accountId, 
      error: error.message, 
      stack: error.stack 
    })
    // Return empty array instead of 500 error if table doesn't exist
    res.json({
      anomalies: [],
      count: 0,
      thresholdPercent: parseFloat(req.query.thresholdPercent || 20)
    })
  }
})

/**
 * POST /api/insights/anomalies/calculate
 * Calculate anomaly baselines for services
 */
router.post('/anomalies/calculate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { providerId, serviceName, baselineDate, accountId } = req.body
    
    if (!providerId || !serviceName || !baselineDate) {
      return res.status(400).json({ 
        error: 'providerId, serviceName, and baselineDate are required' 
      })
    }
    
    const baseline = await calculateAnomalyBaseline(
      userId,
      providerId,
      serviceName,
      baselineDate,
      accountId ? parseInt(accountId) : null
    )
    
    res.json({ baseline })
  } catch (error) {
    logger.error('Anomaly baseline calculation error', { 
      userId: req.user?.id, 
      providerId, 
      accountId, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to calculate anomaly baseline' })
  }
})

/**
 * GET /api/insights/cost-summary/:providerId/:month/:year
 * Get plain-English cost explanation for a month
 */
router.get('/cost-summary/:providerId/:month/:year', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { providerId, month, year } = req.params
    const { accountId } = req.query
    
    // For the current month, always regenerate (data changes daily, same-period comparison shifts)
    const now = new Date()
    const isCurrentMonth = parseInt(month) === (now.getUTCMonth() + 1) && parseInt(year) === now.getUTCFullYear()

    let explanation = null
    if (!isCurrentMonth) {
      // Try to get existing explanation for past months
      explanation = await getCostExplanation(
        userId,
        providerId,
        parseInt(month),
        parseInt(year),
        accountId ? parseInt(accountId) : null
      )
    }

    // If no explanation exists (or current month), generate one
    if (!explanation) {
      explanation = await generateCostExplanation(
        userId,
        providerId,
        parseInt(month),
        parseInt(year),
        accountId ? parseInt(accountId) : null
      )
    }
    
    if (!explanation) {
      // No cost data for this period - return 200 with null (avoids 404 in console)
      return res.json({ explanation: null })
    }
    
    // Return the full explanation object (includes explanation, costChange, contributingFactors)
    res.json(explanation)
  } catch (error) {
    logger.error('Cost summary error', { 
      userId: req.user?.id, 
      providerId, 
      accountId, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to generate cost summary' })
  }
})

/**
 * POST /api/insights/cost-summary/:providerId/:month/:year/regenerate
 * Regenerate cost explanation for a month
 */
router.post('/cost-summary/:providerId/:month/:year/regenerate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { providerId, month, year } = req.params
    const { accountId } = req.body
    
    const explanation = await generateCostExplanation(
      userId,
      providerId,
      parseInt(month),
      parseInt(year),
      accountId ? parseInt(accountId) : null
    )
    
    if (!explanation) {
      return res.json({ explanation: null })
    }
    
    // Return the full explanation object (includes explanation, costChange, contributingFactors)
    res.json(explanation)
  } catch (error) {
    logger.error('Cost summary regeneration error', { 
      userId: req.user?.id, 
      providerId, 
      accountId, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to regenerate cost summary' })
  }
})

/**
 * POST /api/insights/cost-summary-range/:providerId
 * Generate cost explanation for a custom date range
 */
router.post('/cost-summary-range/:providerId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { providerId } = req.params
    const { startDate, endDate, accountId, forceRegenerate } = req.body
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' })
    }
    
    // Validate dates
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' })
    }
    
    if (start > end) {
      return res.status(400).json({ error: 'startDate must be before endDate' })
    }
    
    // If forceRegenerate is true, delete cached explanation first
    if (forceRegenerate) {
      const { pool } = await import('../database.js')
      const client = await pool.connect()
      try {
        await client.query(
          `DELETE FROM cost_explanations_range
           WHERE user_id = $1 AND provider_id = $2 AND start_date = $3::date AND end_date = $4::date
             ${accountId ? 'AND account_id = $5' : 'AND account_id IS NULL'}`,
          accountId 
            ? [userId, providerId, startDate, endDate, accountId]
            : [userId, providerId, startDate, endDate]
        )
      } finally {
        client.release()
      }
    }
    
    const explanation = await generateCustomDateRangeExplanation(
      userId,
      providerId,
      startDate,
      endDate,
      accountId ? parseInt(accountId) : null
    )
    
    if (!explanation) {
      return res.json({ explanation: null })
    }
    
    res.json(explanation)
  } catch (error) {
    logger.error('Custom date range summary error', { 
      userId: req.user?.id, 
      providerId, 
      startDate, 
      endDate, 
      accountId, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to generate cost summary for date range' })
  }
})

/**
 * GET /api/insights/dimensions
 * Get available dimensions (tag keys) and their values
 */
router.get('/dimensions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { providerId, accountId } = req.query
    
    const dimensions = await getAvailableDimensions(
      userId,
      providerId || null,
      accountId ? parseInt(accountId) : null
    )
    
    res.json({ dimensions })
  } catch (error) {
    logger.error('Get dimensions error', { 
      userId: req.user?.id, 
      error: error.message, 
      stack: error.stack 
    })
    // Return empty object if table doesn't exist
    res.json({ dimensions: {} })
  }
})

/**
 * GET /api/insights/cost-by-dimension
 * Get costs grouped by dimension (tag)
 */
router.get('/cost-by-dimension', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { dimensionKey, dimensionValue, providerId, accountId } = req.query
    
    if (!dimensionKey) {
      return res.status(400).json({ error: 'dimensionKey is required' })
    }
    
    const data = await getCostByDimension(
      userId,
      dimensionKey,
      dimensionValue || null,
      providerId || null,
      accountId ? parseInt(accountId) : null
    )
    
    res.json({ data })
  } catch (error) {
    logger.error('Cost by dimension error', { 
      userId: req.user?.id, 
      dimension, 
      startDate, 
      endDate, 
      providerId, 
      accountId, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to fetch cost by dimension' })
  }
})

/**
 * POST /api/insights/business-metrics
 * Save or update a business metric
 */
router.post('/business-metrics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { metricType, metricName, date, metricValue, unit, notes, providerId, accountId } = req.body
    
    if (!metricType || !metricName || !date || metricValue === undefined) {
      return res.status(400).json({ error: 'metricType, metricName, date, and metricValue are required' })
    }
    
    const metricId = await saveBusinessMetric(userId, {
      metricType,
      metricName,
      date,
      metricValue: parseFloat(metricValue),
      unit: unit || null,
      notes: notes || null,
      providerId: providerId || null,
      accountId: accountId ? parseInt(accountId) : null
    })
    
    res.json({ id: metricId, message: 'Business metric saved successfully' })
  } catch (error) {
    logger.error('Save business metric error', { 
      userId: req.user?.id, 
      metricName, 
      metricValue, 
      date, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to save business metric' })
  }
})

/**
 * DELETE /api/insights/business-metrics/:id
 * Delete a business metric
 */
router.delete('/business-metrics/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const metricId = parseInt(req.params.id)

    if (!metricId || isNaN(metricId)) {
      return res.status(400).json({ error: 'Valid metric ID is required' })
    }

    const deleted = await deleteBusinessMetric(userId, metricId)

    if (!deleted) {
      return res.status(404).json({ error: 'Metric not found' })
    }

    res.json({ message: 'Business metric deleted successfully' })
  } catch (error) {
    logger.error('Delete business metric error', {
      userId: req.user?.id,
      metricId: req.params.id,
      error: error.message,
      stack: error.stack
    })
    res.status(500).json({ error: 'Failed to delete business metric' })
  }
})

/**
 * GET /api/insights/business-metrics
 * Get business metrics for a date range
 */
router.get('/business-metrics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { startDate, endDate, metricType, metricName, providerId } = req.query
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' })
    }
    
    const metrics = await getBusinessMetrics(
      userId,
      startDate,
      endDate,
      metricType || null,
      metricName || null,
      providerId || null
    )
    
    res.json({ metrics })
  } catch (error) {
    logger.error('Get business metrics error', { 
      userId: req.user?.id, 
      startDate, 
      endDate, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to fetch business metrics' })
  }
})

/**
 * GET /api/insights/unit-economics
 * Get unit economics (cost per business metric) - Pro only
 */
router.get('/unit-economics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { startDate, endDate, providerId, accountId } = req.query
    
    // Check if user has access to unit economics (Pro only)
    const { canAccessFeature } = await import('../services/subscriptionService.js')
    const hasAccess = await canAccessFeature(userId, 'unit_economics')
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Feature not available',
        message: 'Unit economics requires a Pro subscription',
        feature: 'unit_economics',
        requiredPlan: 'Pro',
        upgradeUrl: '/settings/billing',
      })
    }
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' })
    }
    
    const data = await getUnitEconomics(
      userId,
      startDate,
      endDate,
      providerId || null,
      accountId ? parseInt(accountId) : null
    )
    
    res.json({ data })
  } catch (error) {
    logger.error('Unit economics error', { 
      userId: req.user?.id, 
      startDate, 
      endDate, 
      providerId, 
      accountId, 
      error: error.message, 
      stack: error.stack 
    })
    // Return empty data if table doesn't exist
    res.json({ 
      data: {
        totalCost: 0,
        unitEconomics: [],
        period: {
          startDate: req.query.startDate,
          endDate: req.query.endDate
        }
      }
    })
  }
})

/**
 * GET /api/insights/cost-efficiency
 * Get cost efficiency metrics (cost per unit of usage)
 */
router.get('/cost-efficiency', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { startDate, endDate, providerId, accountId } = req.query
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' })
    }
    
    const data = await getCostEfficiencyMetrics(
      userId,
      startDate,
      endDate,
      providerId || null,
      accountId ? parseInt(accountId) : null
    )
    
    res.json({ data })
  } catch (error) {
    logger.error('Cost efficiency error', { 
      userId: req.user?.id, 
      startDate, 
      endDate, 
      providerId, 
      accountId, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to fetch cost efficiency metrics' })
  }
})

/**
 * GET /api/insights/rightsizing-recommendations
 * Get rightsizing recommendations based on resource utilization.
 * For AWS: uses GetRightsizingRecommendation API with actual CPU/RAM history.
 * For others: falls back to database-based heuristics.
 */
router.get('/rightsizing-recommendations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { providerId, accountId } = req.query
    const parsedAccountId = accountId ? parseInt(accountId, 10) : null

    // For AWS, try Cost Explorer GetRightsizingRecommendation API (uses actual CPU/RAM metrics)
    if (providerId?.toLowerCase() === 'aws') {
      try {
        const accountsToProcess = []

        if (parsedAccountId) {
          const accountData = await getCloudProviderCredentialsByAccountId(userId, parsedAccountId)
          if (accountData) accountsToProcess.push({ id: accountData.accountId, ...accountData })
        } else {
          const result = await pool.query(
            'SELECT id FROM cloud_provider_credentials WHERE user_id = $1 AND provider_id = $2 AND is_active = true ORDER BY created_at ASC',
            [userId, 'aws']
          )
          for (const row of result.rows || []) {
            const accountData = await getCloudProviderCredentialsByAccountId(userId, row.id)
            if (accountData) accountsToProcess.push({ id: accountData.accountId, ...accountData })
          }
        }

        const allRecs = []
        let totalPotentialSavings = 0

        for (const account of accountsToProcess) {
          let credentials = account.credentials || {}
          if (account.connectionType?.startsWith('automated') && account.roleArn && account.externalId) {
            try {
              const { STSClient, AssumeRoleCommand } = await import('@aws-sdk/client-sts')
              const stsClient = new STSClient({ region: 'us-east-1' })
              const assumeRes = await stsClient.send(new AssumeRoleCommand({
                RoleArn: account.roleArn,
                RoleSessionName: `costra-rightsizing-${account.id}-${Date.now()}`,
                ExternalId: account.externalId,
                DurationSeconds: 3600,
              }))
              if (assumeRes.Credentials) {
                credentials = {
                  accessKeyId: assumeRes.Credentials.AccessKeyId,
                  secretAccessKey: assumeRes.Credentials.SecretAccessKey,
                  sessionToken: assumeRes.Credentials.SessionToken,
                  region: 'us-east-1',
                }
              }
            } catch (assumeErr) {
              logger.warn('Failed to assume role for rightsizing', { accountId: account.id, error: assumeErr.message })
              continue
            }
          }

          if (!credentials?.accessKeyId || !credentials?.secretAccessKey) {
            logger.debug('Skipping account without valid credentials', { accountId: account.id })
            continue
          }

          // Primary: CloudWatch-based rightsizing (no opt-in required)
          let awsResult = null
          try {
            awsResult = await fetchCloudWatchRightsizing(credentials, { lookbackDays: 14 })
          } catch (cwErr) {
            logger.warn('CloudWatch rightsizing failed, trying Cost Explorer', { accountId: account.id, error: cwErr.message })
          }
          // Fallback: Cost Explorer API (requires opt-in)
          if (!awsResult?.recommendations?.length) {
            try {
              awsResult = await fetchAWSRightsizingRecommendations(credentials, {
                linkedAccountId: account.awsAccountId || undefined,
              })
            } catch (ceErr) {
              logger.warn('Cost Explorer rightsizing also failed', { accountId: account.id, error: ceErr.message })
            }
          }
          if (awsResult) {
            allRecs.push(...(awsResult.recommendations || []))
            totalPotentialSavings += awsResult.totalPotentialSavings || 0
          }
        }

        if (allRecs.length > 0) {
          const merged = [...allRecs].sort((a, b) => b.potentialSavings - a.potentialSavings)
          return res.json({
            data: {
              recommendations: merged.slice(0, 50),
              totalPotentialSavings,
              recommendationCount: merged.length,
              source: 'aws',
            },
          })
        }
      } catch (awsErr) {
        logger.warn('AWS rightsizing API failed, falling back to database', {
          userId,
          providerId,
          error: awsErr.message,
        })
      }
    }

    if (providerId?.toLowerCase() === 'azure') {
      try {
        let accountData = null
        if (parsedAccountId) {
          accountData = await getCloudProviderCredentialsByAccountId(userId, parsedAccountId)
        } else {
          const rows = (await pool.query(
            'SELECT id FROM cloud_provider_credentials WHERE user_id = $1 AND provider_id = $2 AND is_active = true ORDER BY created_at ASC LIMIT 1',
            [userId, 'azure']
          )).rows
          if (rows[0]) accountData = await getCloudProviderCredentialsByAccountId(userId, rows[0].id)
        }
        const creds = accountData?.credentials
        if (creds?.tenantId && creds?.clientId && creds?.clientSecret && creds?.subscriptionId) {
          const azureResult = await fetchAzureRightsizingRecommendations(creds)
          if (azureResult.recommendations?.length > 0) {
            return res.json({
              data: {
                recommendations: azureResult.recommendations,
                totalPotentialSavings: azureResult.totalPotentialSavings,
                recommendationCount: azureResult.recommendationCount,
                source: 'azure',
              },
            })
          }
        }
      } catch (azureErr) {
        logger.warn('Azure rightsizing API failed, falling back to database', { userId, providerId, error: azureErr.message })
      }
    }

    if (providerId?.toLowerCase() === 'gcp' || providerId?.toLowerCase() === 'google') {
      try {
        let accountData = null
        if (parsedAccountId) {
          accountData = await getCloudProviderCredentialsByAccountId(userId, parsedAccountId)
        } else {
          const rows = (await pool.query(
            'SELECT id FROM cloud_provider_credentials WHERE user_id = $1 AND provider_id IN ($2, $3) AND is_active = true ORDER BY created_at ASC LIMIT 1',
            [userId, 'gcp', 'google']
          )).rows
          if (rows[0]) accountData = await getCloudProviderCredentialsByAccountId(userId, rows[0].id)
        }
        const creds = accountData?.credentials
        if (creds && (creds.projectId || creds.serviceAccountKey)) {
          const gcpResult = await fetchGCPRightsizingRecommendations(creds)
          if (gcpResult.recommendations?.length > 0) {
            return res.json({
              data: {
                recommendations: gcpResult.recommendations,
                totalPotentialSavings: gcpResult.totalPotentialSavings,
                recommendationCount: gcpResult.recommendationCount,
                source: 'gcp',
              },
            })
          }
        }
      } catch (gcpErr) {
        logger.warn('GCP rightsizing API failed, falling back to database', { userId, providerId, error: gcpErr.message })
      }
    }

    // Fallback: database-based recommendations (works for all providers including DigitalOcean, Linode, Vultr, IBM Cloud)
    const data = await getRightsizingRecommendations(
      userId,
      providerId || null,
      parsedAccountId
    )

    res.json({ data })
  } catch (error) {
    logger.error('Rightsizing recommendations error', {
      userId: req.user?.userId || req.user?.id,
      providerId,
      accountId,
      error: error.message,
      stack: error.stack,
    })
    res.status(500).json({ error: 'Failed to fetch rightsizing recommendations' })
  }
})

/**
 * GET /api/insights/cost-by-product
 * Get costs grouped by product
 */
router.get('/cost-by-product', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { startDate, endDate, providerId, accountId } = req.query
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' })
    }
    
    const products = await getCostByProduct(
      userId,
      startDate,
      endDate,
      providerId || null,
      accountId ? parseInt(accountId) : null
    )
    
    res.json({ products })
  } catch (error) {
    logger.error('Cost by product error', { 
      userId: req.user?.id, 
      startDate, 
      endDate, 
      providerId, 
      accountId, 
      error: error.message, 
      stack: error.stack 
    })
    res.json({ products: [] })
  }
})

/**
 * GET /api/insights/cost-by-team
 * Get costs grouped by team
 */
router.get('/cost-by-team', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { startDate, endDate, providerId, accountId } = req.query
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' })
    }
    
    const teams = await getCostByTeam(
      userId,
      startDate,
      endDate,
      providerId || null,
      accountId ? parseInt(accountId) : null
    )
    
    res.json({ teams })
  } catch (error) {
    logger.error('Cost by team error', { 
      userId: req.user?.id, 
      startDate, 
      endDate, 
      providerId, 
      accountId, 
      error: error.message, 
      stack: error.stack 
    })
    res.json({ teams: [] })
  }
})

/**
 * GET /api/insights/product/:productName/trends
 * Get product cost trends over time
 */
router.get('/product/:productName/trends', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { productName } = req.params
    const { startDate, endDate, providerId, accountId } = req.query
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' })
    }
    
    const trends = await getProductCostTrends(
      userId,
      productName,
      startDate,
      endDate,
      providerId || null,
      accountId ? parseInt(accountId) : null
    )
    
    res.json({ trends })
  } catch (error) {
    logger.error('Product trends error', { 
      userId: req.user?.id, 
      productName, 
      startDate, 
      endDate, 
      providerId, 
      accountId, 
      error: error.message, 
      stack: error.stack 
    })
    res.json({ trends: [] })
  }
})

/**
 * GET /api/insights/team/:teamName/trends
 * Get team cost trends over time
 */
router.get('/team/:teamName/trends', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { teamName } = req.params
    const { startDate, endDate, providerId, accountId } = req.query
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' })
    }
    
    const trends = await getTeamCostTrends(
      userId,
      teamName,
      startDate,
      endDate,
      providerId || null,
      accountId ? parseInt(accountId) : null
    )
    
    res.json({ trends })
  } catch (error) {
    logger.error('Team trends error', { 
      userId: req.user?.id, 
      teamName, 
      startDate, 
      endDate, 
      providerId, 
      accountId, 
      error: error.message, 
      stack: error.stack 
    })
    res.json({ trends: [] })
  }
})

/**
 * GET /api/insights/product/:productName/services
 * Get service breakdown for a product
 */
router.get('/product/:productName/services', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { productName } = req.params
    const { startDate, endDate, providerId, accountId } = req.query
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' })
    }
    
    const services = await getProductServiceBreakdown(
      userId,
      productName,
      startDate,
      endDate,
      providerId || null,
      accountId ? parseInt(accountId) : null
    )
    
    res.json({ services })
  } catch (error) {
    logger.error('Product service breakdown error', { 
      userId: req.user?.id, 
      productName, 
      startDate, 
      endDate, 
      providerId, 
      accountId, 
      error: error.message, 
      stack: error.stack 
    })
    res.json({ services: [] })
  }
})

/**
 * GET /api/insights/team/:teamName/services
 * Get service breakdown for a team
 */
router.get('/team/:teamName/services', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { teamName } = req.params
    const { startDate, endDate, providerId, accountId } = req.query
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' })
    }
    
    const services = await getTeamServiceBreakdown(
      userId,
      teamName,
      startDate,
      endDate,
      providerId || null,
      accountId ? parseInt(accountId) : null
    )
    
    res.json({ services })
  } catch (error) {
    logger.error('Team service breakdown error', { 
      userId: req.user?.id, 
      teamName, 
      startDate, 
      endDate, 
      providerId, 
      accountId, 
      error: error.message, 
      stack: error.stack 
    })
    res.json({ services: [] })
  }
})

// ─── Optimization Recommendations ────────────────────────────────────

/**
 * GET /api/insights/recommendations
 * Get optimization recommendations with filters
 */
router.get('/recommendations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' })
    }
    const { category, provider_id, account_id, accountId, priority, status, limit, offset, sort_by } = req.query

    const filters = {
      category: category || undefined,
      provider_id: provider_id || undefined,
      account_id: (account_id || accountId) ? parseInt(account_id || accountId, 10) : undefined,
      priority: priority || undefined,
      status: status || 'active',
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
      sort_by: sort_by || 'savings',
    }

    const cacheKey = `user:${userId}:recommendations:${JSON.stringify(filters)}`
    const result = await cached(cacheKey, () => getOptimizationRecommendations(userId, filters), 900)
    const summary = await cached(`user:${userId}:opt_summary`, () => getOptimizationSummary(userId), 900)

    res.json({ ...result, summary })
  } catch (error) {
    logger.error('Get recommendations error', { userId: req.user?.userId, error: error.message, stack: error.stack })
    res.status(500).json({ error: 'Failed to get recommendations' })
  }
})

/**
 * GET /api/insights/optimization-summary
 * Dashboard widget data
 */
router.get('/optimization-summary', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const summary = await cached(`user:${userId}:opt_summary`, () => getOptimizationSummary(userId), 900)
    res.json(summary)
  } catch (error) {
    logger.error('Get optimization summary error', { userId: req.user?.userId, error: error.message, stack: error.stack })
    res.status(500).json({ error: 'Failed to get optimization summary' })
  }
})

/**
 * POST /api/insights/recommendations/:id/dismiss
 */
router.post('/recommendations/:id/dismiss', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { id } = req.params
    const { reason } = req.body

    const result = await dismissOptimizationRecommendation(userId, parseInt(id), reason || null)
    if (!result) {
      return res.status(404).json({ error: 'Recommendation not found or already dismissed' })
    }
    res.json({ success: true })
  } catch (error) {
    logger.error('Dismiss recommendation error', { userId: req.user?.userId, id: req.params.id, error: error.message })
    res.status(500).json({ error: 'Failed to dismiss recommendation' })
  }
})

/**
 * POST /api/insights/recommendations/:id/implemented
 */
router.post('/recommendations/:id/implemented', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { id } = req.params

    const result = await markRecommendationImplemented(userId, parseInt(id))
    if (!result) {
      return res.status(404).json({ error: 'Recommendation not found or already handled' })
    }
    res.json({ success: true })
  } catch (error) {
    logger.error('Mark implemented error', { userId: req.user?.userId, id: req.params.id, error: error.message })
    res.status(500).json({ error: 'Failed to mark recommendation as implemented' })
  }
})

/**
 * POST /api/insights/recommendations/refresh
 * Trigger re-computation of optimization recommendations
 */
router.post('/recommendations/refresh', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id

    // Fire-and-forget
    runOptimizationForUser(userId)
      .catch(err => logger.error('Manual optimization refresh failed', { userId, error: err.message }))

    res.json({ success: true, message: 'Optimization analysis started' })
  } catch (error) {
    logger.error('Refresh recommendations error', { userId: req.user?.userId, error: error.message })
    res.status(500).json({ error: 'Failed to start optimization analysis' })
  }
})

// ============================================================
// Anomaly Events (ML-powered anomaly detection)
// ============================================================

/**
 * GET /api/insights/anomalies/events
 * Get ML-detected anomaly events with root cause analysis
 */
router.get('/anomalies/events', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { status, severity, providerId, limit = 50, offset = 0 } = req.query
    const result = await getAnomalyEvents(userId, {
      status, severity, providerId,
      limit: parseInt(limit), offset: parseInt(offset),
    })
    res.json(result)
  } catch (error) {
    logger.error('Get anomaly events error', { userId: req.user?.userId, error: error.message })
    res.status(500).json({ error: 'Failed to get anomaly events' })
  }
})

/**
 * PUT /api/insights/anomalies/events/:id/status
 * Update anomaly event resolution status
 */
router.put('/anomalies/events/:id/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const eventId = parseInt(req.params.id)
    const { status } = req.body
    const validStatuses = ['open', 'acknowledged', 'investigating', 'resolved', 'false_positive']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` })
    }
    const event = await updateAnomalyEventStatus(eventId, userId, status)
    if (!event) return res.status(404).json({ error: 'Anomaly event not found' })
    res.json({ event })
  } catch (error) {
    logger.error('Update anomaly status error', { userId: req.user?.userId, error: error.message })
    res.status(500).json({ error: 'Failed to update anomaly status' })
  }
})

/**
 * GET /api/insights/rightsizing-explorer
 * Returns resources grouped by service with detailed metadata for the
 * Rightsizing Explorer page.  Each resource includes instance/storage
 * recommendations and (where available) utilization time-series data.
 */
router.get('/rightsizing-explorer', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { providerId, accountId, service } = req.query
    const parsedAccountId = accountId ? parseInt(accountId, 10) : null

    // ── 1. Fetch cloud accounts for this user + provider ────────────
    const accountQuery = `
      SELECT id, provider_id, account_alias, aws_account_id
      FROM cloud_provider_credentials
      WHERE user_id = $1 AND is_active = true
      ${providerId ? "AND provider_id = $2" : ''}
      ORDER BY created_at ASC
    `
    const accountParams = [userId]
    if (providerId) accountParams.push(providerId.toLowerCase())
    const accountsResult = await pool.query(accountQuery, accountParams)
    const accounts = accountsResult.rows

    // ── 2. Fetch resources with cost / usage data ───────────────────
    let resourceQuery = `
      SELECT
        r.id, r.resource_id, r.resource_name, r.resource_type,
        r.service_name, r.region, r.cost, r.usage_quantity, r.usage_unit,
        r.usage_type, r.last_seen_date, r.provider_id, r.account_id
      FROM resources r
      WHERE r.user_id = $1
        AND r.cost > 0
      ${providerId ? `AND r.provider_id = $${accountParams.length}` : ''}
      ${parsedAccountId ? `AND r.account_id = $${accountParams.length + 1}` : ''}
      ${service ? `AND LOWER(r.service_name) LIKE $${accountParams.length + (parsedAccountId ? 2 : 1)}` : ''}
      ORDER BY r.cost DESC
      LIMIT 500
    `
    const rParams = [userId]
    if (providerId) rParams.push(providerId.toLowerCase())
    if (parsedAccountId) rParams.push(parsedAccountId)
    if (service) rParams.push(`%${service.toLowerCase()}%`)
    const resourcesResult = await pool.query(resourceQuery, rParams)

    // ── 3. Fetch existing optimization recommendations for these resources
    const recQuery = `
      SELECT resource_id, title, description, action, priority,
             estimated_monthly_savings, estimated_savings_percent,
             confidence, current_cost, evidence, category, subcategory,
             service_name, resource_type
      FROM optimization_recommendations
      WHERE user_id = $1 AND status = 'active'
        AND category IN ('rightsizing', 'idle_resources', 'storage_optimization')
      ${providerId ? `AND provider_id = $2` : ''}
      ORDER BY estimated_monthly_savings DESC
    `
    const recParams = [userId]
    if (providerId) recParams.push(providerId.toLowerCase())
    const recsResult = await pool.query(recQuery, recParams)

    // Index recommendations by resource_id for fast lookup
    const recsByResource = {}
    for (const rec of recsResult.rows) {
      const rid = rec.resource_id
      if (!recsByResource[rid]) recsByResource[rid] = []
      recsByResource[rid].push({
        title: rec.title,
        description: rec.description,
        action: rec.action,
        priority: rec.priority,
        savings: parseFloat(rec.estimated_monthly_savings) || 0,
        savingsPercent: parseFloat(rec.estimated_savings_percent) || 0,
        confidence: rec.confidence,
        category: rec.category,
        subcategory: rec.subcategory,
        evidence: rec.evidence || {},
      })
    }

    // ── 4. Group resources by service ───────────────────────────────
    const serviceMap = {}
    let totalSpend = 0

    for (const row of resourcesResult.rows) {
      const svc = row.service_name || 'Other'
      const cost = parseFloat(row.cost) || 0
      totalSpend += cost

      if (!serviceMap[svc]) {
        serviceMap[svc] = { serviceName: svc, totalSpend: 0, resourceCount: 0, resources: [] }
      }
      serviceMap[svc].totalSpend += cost
      serviceMap[svc].resourceCount += 1

      const recs = recsByResource[row.resource_id] || []
      // Extract metadata from recommendation evidence if available
      const firstEvidence = recs.length > 0 ? (recs[0].evidence || {}) : {}

      // Build instance recommendation options from evidence
      const instanceOptions = []
      const storageOptions = []
      for (const rec of recs) {
        const ev = rec.evidence || {}
        if (rec.category === 'storage_optimization') {
          storageOptions.push({
            label: 'RECOMMENDED',
            savings: rec.savingsPercent,
            costSavings: rec.savings,
            type: ev.suggested_type || ev.recommended_type || 'gp3',
            sizeGib: ev.suggested_size || ev.size_gb || null,
            iops: ev.suggested_iops || null,
            action: rec.action || 'Rightsize',
            risk: rec.confidence === 'high' ? 1 : rec.confidence === 'medium' ? 3 : 4,
          })
        } else {
          instanceOptions.push({
            label: recs.indexOf(rec) === 0 ? 'RECOMMENDED' : null,
            savings: rec.savingsPercent,
            costSavings: rec.savings,
            type: ev.suggested_instance_type || ev.recommendedType || null,
            action: rec.action || 'Rightsize',
            risk: rec.confidence === 'high' ? 1 : rec.confidence === 'medium' ? 3 : 4,
          })
        }
      }

      const totalSavings = recs.reduce((s, r) => s + r.savings, 0)
      const estimatedNewCost = cost - totalSavings

      serviceMap[svc].resources.push({
        id: row.id,
        resourceId: row.resource_id,
        resourceName: row.resource_name || row.resource_id,
        resourceType: row.resource_type,
        serviceName: svc,
        region: row.region,
        providerId: row.provider_id,
        accountId: row.account_id,
        cost,
        estimatedNewCost: Math.max(0, estimatedNewCost),
        savingsPercent: cost > 0 ? Math.round((totalSavings / cost) * 100) : 0,
        metadata: {
          instanceType: firstEvidence.instance_type || row.resource_type || null,
          memory: firstEvidence.memory_gb ? `${firstEvidence.memory_gb} GiB` : null,
          vcpus: firstEvidence.vcpus || null,
          storageType: firstEvidence.storage_type || firstEvidence.volume_type || null,
          sizeGib: firstEvidence.size_gb || null,
          iops: firstEvidence.iops || null,
          engine: firstEvidence.engine || null,
          clusterId: firstEvidence.cluster_id || null,
          accountName: accounts.find(a => a.id === row.account_id)?.account_alias || null,
          awsAccountId: accounts.find(a => a.id === row.account_id)?.aws_account_id || null,
        },
        usageQuantity: parseFloat(row.usage_quantity) || 0,
        usageUnit: row.usage_unit,
        lastSeen: row.last_seen_date,
        recommendations: recs,
        instanceOptions,
        storageOptions,
      })
    }

    // Sort services by total spend descending
    let services = Object.values(serviceMap).sort((a, b) => b.totalSpend - a.totalSpend)

    // ── 5. If no resources from DB, try live cloud provider APIs ────
    const setupHints = []
    if (resourcesResult.rows.length === 0 && accounts.length > 0) {
      try {
        const liveRecs = []

        // AWS: CloudWatch-based rightsizing (no opt-in needed), falls back to Cost Explorer API
        const awsAccounts = accounts.filter(a => a.provider_id === 'aws')
        if (awsAccounts.length > 0 && (!providerId || providerId.toLowerCase() === 'aws')) {
          for (const account of awsAccounts) {
            try {
              const accountData = await getCloudProviderCredentialsByAccountId(userId, account.id)
              if (!accountData) continue
              let credentials = accountData.credentials || {}
              if (accountData.connectionType?.startsWith('automated') && accountData.roleArn && accountData.externalId) {
                const { STSClient, AssumeRoleCommand } = await import('@aws-sdk/client-sts')
                const stsClient = new STSClient({ region: 'us-east-1' })
                const assumeRes = await stsClient.send(new AssumeRoleCommand({
                  RoleArn: accountData.roleArn,
                  RoleSessionName: `costra-explorer-${account.id}-${Date.now()}`,
                  ExternalId: accountData.externalId,
                  DurationSeconds: 3600,
                }))
                if (assumeRes.Credentials) {
                  credentials = {
                    accessKeyId: assumeRes.Credentials.AccessKeyId,
                    secretAccessKey: assumeRes.Credentials.SecretAccessKey,
                    sessionToken: assumeRes.Credentials.SessionToken,
                    region: 'us-east-1',
                  }
                }
              }
              if (!credentials?.accessKeyId || !credentials?.secretAccessKey) continue

              // Primary: CloudWatch + EC2 DescribeInstances (no opt-in required)
              let gotRecs = false
              try {
                const cwResult = await fetchCloudWatchRightsizing(credentials, { lookbackDays: 14 })
                if (cwResult.recommendations?.length > 0) {
                  for (const rec of cwResult.recommendations) {
                    liveRecs.push({ ...rec, providerId: 'aws', accountId: account.id, accountAlias: account.account_alias, awsAccountId: account.aws_account_id })
                  }
                  gotRecs = true
                }
              } catch (cwErr) {
                logger.warn('Rightsizing explorer: CloudWatch approach failed, trying Cost Explorer', { accountId: account.id, error: cwErr.message })
                // If DescribeInstances permission missing, add a helpful hint
                if (cwErr.message?.includes('UnauthorizedOperation') || cwErr.message?.includes('AccessDenied')) {
                  setupHints.push({
                    provider: 'aws',
                    type: 'permission_required',
                    title: 'EC2 Read Permission Needed',
                    message: 'The CloudFormation stack needs updating to include EC2 read permissions for rightsizing analysis.',
                    steps: [
                      'Go to AWS CloudFormation in your AWS Console',
                      'Find the Costra stack and click Update',
                      'Choose "Replace current template" and re-enter the Costra template URL',
                      'Complete the update wizard to add the new ec2:DescribeInstances permission',
                    ],
                  })
                }
              }

              // Fallback: Cost Explorer GetRightsizingRecommendation (requires opt-in)
              if (!gotRecs) {
                try {
                  const awsResult = await fetchAWSRightsizingRecommendations(credentials, {
                    linkedAccountId: account.aws_account_id || undefined,
                  })
                  for (const rec of (awsResult.recommendations || [])) {
                    liveRecs.push({ ...rec, providerId: 'aws', accountId: account.id, accountAlias: account.account_alias, awsAccountId: account.aws_account_id })
                  }
                } catch (ceErr) {
                  logger.warn('Rightsizing explorer: Cost Explorer API also failed', { accountId: account.id, error: ceErr.message })
                  // Don't show opt-in hint if CloudWatch just found no instances (that's fine)
                }
              }
            } catch (accErr) {
              logger.warn('Rightsizing explorer: failed to fetch AWS recs for account', { accountId: account.id, error: accErr.message })
              if (accErr.message) {
                setupHints.push({ provider: 'aws', type: 'error', title: 'AWS Rightsizing Error', message: accErr.message, steps: [] })
              }
            }
          }
        }

        // Azure: Advisor Cost Recommendations API
        const azureAccounts = accounts.filter(a => a.provider_id === 'azure')
        if (azureAccounts.length > 0 && (!providerId || providerId.toLowerCase() === 'azure')) {
          for (const account of azureAccounts) {
            try {
              const accountData = await getCloudProviderCredentialsByAccountId(userId, account.id)
              const creds = accountData?.credentials
              if (creds?.tenantId && creds?.clientId && creds?.clientSecret && creds?.subscriptionId) {
                const azureResult = await fetchAzureRightsizingRecommendations(creds)
                for (const rec of (azureResult.recommendations || [])) {
                  liveRecs.push({ ...rec, providerId: 'azure', accountId: account.id, accountAlias: account.account_alias })
                }
              }
            } catch (accErr) {
              logger.warn('Rightsizing explorer: failed to fetch Azure recs for account', { accountId: account.id, error: accErr.message })
              if (accErr.message) {
                setupHints.push({ provider: 'azure', type: 'error', title: 'Azure Advisor Error', message: accErr.message, steps: [] })
              }
            }
          }
        }

        // GCP: Recommender API
        const gcpAccounts = accounts.filter(a => a.provider_id === 'gcp' || a.provider_id === 'google')
        if (gcpAccounts.length > 0 && (!providerId || providerId.toLowerCase() === 'gcp' || providerId.toLowerCase() === 'google')) {
          for (const account of gcpAccounts) {
            try {
              const accountData = await getCloudProviderCredentialsByAccountId(userId, account.id)
              const creds = accountData?.credentials
              if (creds && (creds.projectId || creds.serviceAccountKey)) {
                const gcpResult = await fetchGCPRightsizingRecommendations(creds)
                for (const rec of (gcpResult.recommendations || [])) {
                  liveRecs.push({ ...rec, providerId: account.provider_id, accountId: account.id, accountAlias: account.account_alias })
                }
              }
            } catch (accErr) {
              logger.warn('Rightsizing explorer: failed to fetch GCP recs for account', { accountId: account.id, error: accErr.message })
              if (accErr.message) {
                setupHints.push({ provider: 'gcp', type: 'error', title: 'GCP Recommender Error', message: accErr.message, steps: [] })
              }
            }
          }
        }

        // Convert live API recs into explorer format
        if (liveRecs.length > 0) {
          const liveServiceMap = {}
          totalSpend = 0
          for (const rec of liveRecs) {
            const svc = rec.serviceName || 'Compute'
            const cost = rec.currentCost || 0
            totalSpend += cost
            if (!liveServiceMap[svc]) {
              liveServiceMap[svc] = { serviceName: svc, totalSpend: 0, resourceCount: 0, resources: [] }
            }
            liveServiceMap[svc].totalSpend += cost
            liveServiceMap[svc].resourceCount += 1

            const savings = rec.potentialSavings || 0
            const newCost = Math.max(0, cost - savings)

            liveServiceMap[svc].resources.push({
              id: rec.resourceId,
              resourceId: rec.resourceId,
              resourceName: rec.resourceName || rec.resourceId,
              resourceType: rec.resourceType || 'Instance',
              serviceName: svc,
              region: rec.region,
              providerId: rec.providerId,
              accountId: rec.accountId,
              cost,
              estimatedNewCost: newCost,
              savingsPercent: rec.savingsPercent ? Math.round(rec.savingsPercent) : 0,
              metadata: {
                instanceType: rec.resourceType || null,
                memory: null,
                vcpus: null,
                storageType: null,
                sizeGib: null,
                iops: null,
                engine: null,
                clusterId: null,
                accountName: rec.accountAlias || null,
                awsAccountId: rec.awsAccountId || null,
              },
              usageQuantity: rec.utilization?.cpuUtilization || 0,
              usageUnit: '%',
              lastSeen: new Date().toISOString().split('T')[0],
              recommendations: [{
                title: rec.recommendation === 'terminate'
                  ? 'Terminate Instance'
                  : `Downsize to ${rec.suggestedInstanceType || 'smaller instance'}`,
                description: rec.reason,
                action: rec.recommendation === 'terminate' ? 'Terminate' : 'Rightsize',
                priority: rec.priority,
                savings,
                savingsPercent: rec.savingsPercent || 0,
                confidence: rec.priority === 'high' ? 'high' : 'medium',
                category: rec.recommendation === 'terminate' ? 'idle_resources' : 'rightsizing',
                subcategory: rec.source || rec.providerId,
                evidence: {
                  instance_type: rec.resourceType,
                  suggested_instance_type: rec.suggestedInstanceType,
                  cpuUtilization: rec.utilization?.cpuUtilization,
                  memoryUtilization: rec.utilization?.memoryUtilization,
                },
              }],
              instanceOptions: rec.suggestedInstanceType ? [{
                label: 'RECOMMENDED',
                savings: rec.savingsPercent || 0,
                costSavings: savings,
                type: rec.suggestedInstanceType,
                action: rec.recommendation === 'terminate' ? 'Terminate' : 'Rightsize',
                risk: rec.priority === 'high' ? 1 : rec.priority === 'medium' ? 3 : 4,
              }] : [],
              storageOptions: [],
            })
          }
          services = Object.values(liveServiceMap).sort((a, b) => b.totalSpend - a.totalSpend)
        }
      } catch (liveErr) {
        logger.warn('Rightsizing explorer: live API fallback failed', { error: liveErr.message })
      }
    }

    // ── 6. Provider-level summary ───────────────────────────────────
    const providerSummary = {}
    for (const acct of accounts) {
      const pid = acct.provider_id
      if (!providerSummary[pid]) {
        providerSummary[pid] = { providerId: pid, accountCount: 0, totalSpend: 0, resourceCount: 0 }
      }
      providerSummary[pid].accountCount += 1
    }
    for (const svc of services) {
      for (const r of svc.resources) {
        if (providerSummary[r.providerId]) {
          providerSummary[r.providerId].totalSpend += r.cost
          providerSummary[r.providerId].resourceCount += 1
        }
      }
    }

    const totalResources = services.reduce((sum, s) => sum + s.resourceCount, 0)

    res.json({
      data: {
        services,
        totalSpend,
        totalResources,
        providers: Object.values(providerSummary),
        setupHints: setupHints.length > 0 ? setupHints : undefined,
      },
    })
  } catch (error) {
    logger.error('Rightsizing explorer error', {
      userId: req.user?.userId || req.user?.id,
      error: error.message,
      stack: error.stack,
    })
    res.status(500).json({ error: 'Failed to fetch rightsizing explorer data' })
  }
})

/**
 * GET /api/insights/resource-utilization/:resourceId
 * Returns utilization time-series for a specific resource (CPU, Memory, Storage, IOPS).
 * Currently returns empty series - resource-level metrics collection can be added later
 * via CloudWatch / Azure Monitor / Cloud Monitoring integration.
 */
router.get('/resource-utilization/:resourceId', authenticateToken, async (req, res) => {
  try {
    const { resourceId } = req.params
    const { days = 10 } = req.query
    const lookbackDays = Math.min(parseInt(days, 10) || 10, 90)

    // Resource-level utilization metrics are not yet collected.
    // Return empty series so the frontend renders "No data" gracefully.
    res.json({
      data: {
        resourceId,
        lookbackDays,
        cpu: [],
        memory: [],
        storage: [],
        iops: [],
      },
    })
  } catch (error) {
    logger.error('Resource utilization error', {
      userId: req.user?.userId || req.user?.id,
      resourceId: req.params.resourceId,
      error: error.message,
    })
    res.status(500).json({ error: 'Failed to fetch resource utilization data' })
  }
})

export default router
