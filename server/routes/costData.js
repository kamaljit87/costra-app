import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { requireFeature, limitHistoricalData } from '../middleware/featureGate.js'
import logger from '../utils/logger.js'
import {
  getCostDataForUser,
  saveCostData,
  getUserPreferences,
  updateUserCurrency,
  updateProviderCredits,
  getDailyCostData,
  getServiceCostsForDateRange,
  getCloudProviderCredentials,
  createNotification,
} from '../database.js'
import { cached, cacheKeys, clearUserCache } from '../utils/cache.js'
import { 
  fetchAWSServiceDetails, 
  fetchAzureServiceDetails,
  fetchGCPServiceDetails,
  fetchDigitalOceanServiceDetails,
  fetchIBMServiceDetails,
  fetchLinodeServiceDetails,
  fetchVultrServiceDetails
} from '../services/cloudProviderIntegrations.js'
import { generateCSVReport, generatePDFReport } from '../utils/reportGenerator.js'
import { 
  getCostByTeam, 
  getCostByProduct, 
  getTeamServiceBreakdown, 
  getProductServiceBreakdown, 
  pool,
  getCostVsUsage,
  getAnomalies,
  getCostEfficiencyMetrics,
  getRightsizingRecommendations,
  getUnitEconomics,
  getCostByDimension,
  getUntaggedResources,
  generateCustomDateRangeExplanation
} from '../database.js'

const router = express.Router()

// All routes require authentication
router.use(authenticateToken)

// Get cost data for current user (tenant-scoped)
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId // Tenant isolation: only get data for this user
    const now = new Date()
    const month = now.getMonth() + 1 // 1-12
    const year = now.getFullYear()

    // Use cache with 5-minute TTL for cost data
    const cacheKey = `cost_data:${userId}:${month}:${year}`
    const costData = await cached(
      cacheKey,
      async () => await getCostDataForUser(userId, month, year),
      300 // 5 minutes TTL
    )

    // Format response to match frontend expectations
    const formattedData = costData.map(cost => ({
      provider: {
        id: cost.provider_code,
        name: cost.provider_name,
        icon: cost.icon || '☁️',
      },
      currentMonth: parseFloat(cost.current_month_cost) || 0,
      lastMonth: parseFloat(cost.last_month_cost) || 0,
      forecast: parseFloat(cost.forecast_cost) || 0,
      credits: parseFloat(cost.credits) || 0,
      savings: parseFloat(cost.savings) || 0,
      // Transform service_name to name and change_percent to change for frontend compatibility
      // Filter out Tax entries - they are not services
      services: (cost.services || [])
        .filter(service => {
          const name = (service.service_name || '').toLowerCase()
          return name !== 'tax' && !name.includes('tax -') && name !== 'vat'
        })
        .map(service => ({
          name: service.service_name,
          cost: parseFloat(service.cost) || 0,
          change: parseFloat(service.change_percent) || 0,
        })),
    }))

    res.json({ costData: formattedData })
  } catch (error) {
    logger.error('Get cost data error', { 
      userId: req.user?.userId, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Save cost data for current user
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId
    const { providerId, costData } = req.body

    if (!providerId || !costData) {
      return res.status(400).json({ error: 'Provider ID and cost data are required' })
    }

    // Clear cache after saving new cost data
    await clearUserCache(userId)

    const now = new Date()
    const month = now.getMonth() + 1
    const year = now.getFullYear()

    await saveCostData(userId, providerId, month, year, costData)

    res.json({ message: 'Cost data saved successfully' })
  } catch (error) {
    logger.error('Save cost data error', { 
      userId: req.user?.userId, 
      providerId, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get aggregated service costs for a date range
router.get('/services/:providerId', async (req, res) => {
  try {
    const userId = req.user.userId
    const { providerId } = req.params
    const { startDate, endDate } = req.query

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' })
    }

    logger.debug('Services API: Fetching services', { userId, providerId, startDate, endDate })

    const allServices = await getServiceCostsForDateRange(userId, providerId, startDate, endDate)
    
    // Filter out Tax - it's not a service but a fee
    const services = allServices.filter(s => 
      s.name.toLowerCase() !== 'tax' && 
      !s.name.toLowerCase().includes('tax -') &&
      s.name.toLowerCase() !== 'vat'
    )
    
    // Calculate total for the response (excluding tax)
    const totalCost = services.reduce((sum, s) => sum + s.cost, 0)

    logger.debug('Services API: Found services', { 
      servicesCount: services.length, 
      allServicesCount: allServices.length, 
      totalCost: totalCost.toFixed(2) 
    })

    // Include metadata to help frontend detect changes
    res.json({ 
      services,
      period: { startDate, endDate },
      totalCost,
      timestamp: Date.now()
    })
  } catch (error) {
    logger.error('Get services error', { 
      userId, 
      providerId, 
      startDate, 
      endDate, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get sub-service details for a specific service (e.g., EC2 -> compute, storage, etc.)
router.get('/services/:providerId/:serviceName/details', async (req, res) => {
  try {
    const userId = req.user.userId
    const { providerId, serviceName } = req.params
    const { startDate, endDate } = req.query

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' })
    }

    const decodedServiceName = decodeURIComponent(serviceName)
    logger.debug('Service Details API: Fetching details', { 
      serviceName: decodedServiceName, 
      providerId, 
      startDate, 
      endDate 
    })

    // Skip tax - it doesn't have sub-services
    if (decodedServiceName.toLowerCase() === 'tax') {
      return res.json({
        serviceName: decodedServiceName,
        providerId,
        subServices: [],
        message: 'Tax charges do not have sub-service breakdown',
        period: { startDate, endDate },
        timestamp: Date.now()
      })
    }

    // Get provider credentials (returns the decrypted credentials object directly)
    const credentials = await getCloudProviderCredentials(userId, providerId)
    
    if (!credentials) {
      return res.status(404).json({ error: 'Provider not configured' })
    }

    let subServices = []

    // Fetch sub-service details based on provider
    switch (providerId) {
      case 'aws':
        try {
          const awsResult = await fetchAWSServiceDetails(credentials, decodedServiceName, startDate, endDate)
          subServices = awsResult.subServices || []
        } catch (err) {
          logger.warn('AWS Service Details: API failed, using simulated data', { 
            serviceName: decodedServiceName, 
            error: err.message 
          })
          subServices = await getSimulatedSubServices(decodedServiceName, providerId)
        }
        break
      
      case 'azure':
        try {
          const azureResult = await fetchAzureServiceDetails(credentials, decodedServiceName, startDate, endDate)
          subServices = azureResult.subServices || []
        } catch (err) {
          logger.warn('Azure Service Details: API failed, using simulated data', { 
            serviceName: decodedServiceName, 
            error: err.message 
          })
          subServices = await getSimulatedSubServices(decodedServiceName, providerId)
        }
        break
      
      case 'gcp':
      case 'google':
        try {
          const gcpResult = await fetchGCPServiceDetails(credentials, decodedServiceName, startDate, endDate)
          subServices = gcpResult.subServices || []
        } catch (err) {
          logger.warn('GCP Service Details: API failed, using simulated data', { 
            serviceName: decodedServiceName, 
            error: err.message 
          })
          subServices = await getSimulatedSubServices(decodedServiceName, providerId)
        }
        break
      
      case 'digitalocean':
      case 'do':
        try {
          const doResult = await fetchDigitalOceanServiceDetails(credentials, decodedServiceName, startDate, endDate)
          subServices = doResult.subServices || []
        } catch (err) {
          logger.warn('DO Service Details: API failed, using simulated data', { 
            serviceName: decodedServiceName, 
            error: err.message 
          })
          subServices = await getSimulatedSubServices(decodedServiceName, providerId)
        }
        break
      
      case 'ibm':
      case 'ibmcloud':
        try {
          const ibmResult = await fetchIBMServiceDetails(credentials, decodedServiceName, startDate, endDate)
          subServices = ibmResult.subServices || []
        } catch (err) {
          logger.warn('IBM Service Details: API failed, using simulated data', { 
            serviceName: decodedServiceName, 
            error: err.message 
          })
          subServices = await getSimulatedSubServices(decodedServiceName, providerId)
        }
        break
      
      case 'linode':
      case 'akamai':
        try {
          const linodeResult = await fetchLinodeServiceDetails(credentials, decodedServiceName, startDate, endDate)
          subServices = linodeResult.subServices || []
        } catch (err) {
          logger.warn('Linode Service Details: API failed, using simulated data', { 
            serviceName: decodedServiceName, 
            error: err.message 
          })
          subServices = await getSimulatedSubServices(decodedServiceName, providerId)
        }
        break
      
      case 'vultr':
        try {
          const vultrResult = await fetchVultrServiceDetails(credentials, decodedServiceName, startDate, endDate)
          subServices = vultrResult.subServices || []
        } catch (err) {
          logger.warn('Vultr Service Details: API failed, using simulated data', { 
            serviceName: decodedServiceName, 
            error: err.message 
          })
          subServices = await getSimulatedSubServices(decodedServiceName, providerId)
        }
        break
      
      default:
        // For other providers, provide generic sub-service simulation based on service type
        subServices = await getSimulatedSubServices(decodedServiceName, providerId)
    }

    logger.debug('Service Details API: Found sub-services', { 
      serviceName: decodedServiceName, 
      providerId, 
      count: subServices.length 
    })

    res.json({
      serviceName: decodedServiceName,
      providerId,
      subServices,
      period: { startDate, endDate },
      timestamp: Date.now()
    })
  } catch (error) {
    logger.error('Get service details error', { 
      userId, 
      providerId, 
      serviceName: decodedServiceName, 
      startDate, 
      endDate, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

// Helper function to generate simulated sub-services for providers without detailed API
async function getSimulatedSubServices(serviceName, providerId) {
  const serviceNameLower = serviceName.toLowerCase()
  
  // Define common sub-service patterns
  const subServicePatterns = {
    // Compute services
    compute: [
      { name: 'Compute Hours', category: 'Compute', percentage: 60 },
      { name: 'Storage (Attached Disks)', category: 'Storage', percentage: 25 },
      { name: 'Data Transfer', category: 'Data Transfer', percentage: 10 },
      { name: 'Snapshots', category: 'Storage', percentage: 5 },
    ],
    // Storage services
    storage: [
      { name: 'Standard Storage', category: 'Storage', percentage: 50 },
      { name: 'Premium Storage', category: 'Storage', percentage: 30 },
      { name: 'Operations', category: 'Requests', percentage: 15 },
      { name: 'Data Retrieval', category: 'Data Transfer', percentage: 5 },
    ],
    // Database services
    database: [
      { name: 'Instance Hours', category: 'Compute', percentage: 55 },
      { name: 'Storage', category: 'Storage', percentage: 25 },
      { name: 'I/O Operations', category: 'Requests', percentage: 10 },
      { name: 'Backup Storage', category: 'Storage', percentage: 10 },
    ],
    // Network services
    network: [
      { name: 'Data Processing', category: 'Compute', percentage: 40 },
      { name: 'Data Transfer Out', category: 'Data Transfer', percentage: 35 },
      { name: 'Data Transfer In', category: 'Data Transfer', percentage: 15 },
      { name: 'Connection Hours', category: 'Compute', percentage: 10 },
    ],
  }

  // Detect service type
  let serviceType = 'compute' // default
  if (serviceNameLower.includes('storage') || serviceNameLower.includes('s3') || serviceNameLower.includes('blob')) {
    serviceType = 'storage'
  } else if (serviceNameLower.includes('database') || serviceNameLower.includes('sql') || serviceNameLower.includes('rds') || serviceNameLower.includes('dynamo')) {
    serviceType = 'database'
  } else if (serviceNameLower.includes('vpc') || serviceNameLower.includes('network') || serviceNameLower.includes('load') || serviceNameLower.includes('cdn') || serviceNameLower.includes('cloudfront')) {
    serviceType = 'network'
  }

  return subServicePatterns[serviceType].map(sub => ({
    ...sub,
    cost: 0, // Will be calculated on frontend based on parent service cost
    usageType: `${providerId}-${sub.name.replace(/\s+/g, '')}`,
  }))
}

// Get user preferences (currency)
router.get('/preferences', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' })
    }
    
    // Cache user preferences with 1-hour TTL
    const preferences = await cached(
      cacheKeys.userPreferences(userId),
      async () => await getUserPreferences(userId),
      3600 // 1 hour TTL
    )
    
    // Always return preferences, even if null (will use defaults)
    res.json({ 
      preferences: preferences || {
        user_id: userId,
        currency: 'USD'
      }
    })
  } catch (error) {
    logger.error('Get preferences error', { 
      userId: req.user?.userId || req.user?.id, 
      error: error.message, 
      stack: error.stack 
    })
    // Return default preferences instead of 500 error
    res.json({ 
      preferences: {
        user_id: req.user.userId || req.user.id,
        currency: 'USD'
      }
    })
  }
})

// Update user currency preference
router.put('/preferences/currency', async (req, res) => {
  try {
    const userId = req.user.userId
    const { currency } = req.body

    if (!currency) {
      return res.status(400).json({ error: 'Currency is required' })
    }

    await updateUserCurrency(userId, currency)
    
    // Clear user preferences cache
    await cacheDel(cacheKeys.userPreferences(userId))
    
    // Create notification for currency change
    try {
      await createNotification(userId, {
        type: 'info',
        title: 'Currency Preference Updated',
        message: `Your default currency has been changed to ${currency}`,
        link: '/settings',
        linkText: 'View Settings'
      })
    } catch (notifError) {
      logger.error('CostData: Failed to create notification', { 
        userId, 
        currency, 
        error: notifError.message 
      })
    }
    
    res.json({ message: 'Currency preference updated' })
  } catch (error) {
    logger.error('Update currency error', { 
      userId, 
      currency, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update credits for a provider
router.put('/:providerId/credits', async (req, res) => {
  try {
    const userId = req.user.userId
    const { providerId } = req.params
    const { credits, month, year } = req.body

    if (credits === undefined || credits === null) {
      return res.status(400).json({ error: 'Credits amount is required' })
    }

    if (typeof credits !== 'number' || credits < 0) {
      return res.status(400).json({ error: 'Credits must be a non-negative number' })
    }

    await updateProviderCredits(userId, providerId, month, year, credits)
    
    // Clear cost data cache for this user
    await clearUserCache(userId)
    
    res.json({ message: 'Credits updated successfully', credits })
  } catch (error) {
    logger.error('Update credits error', { 
      userId, 
      providerId, 
      month, 
      year, 
      credits, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get credits for a provider
router.get('/:providerId/credits', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { providerId } = req.params
    const { startDate, endDate, accountId } = req.query
    const now = new Date()
    
    // Get date range
    let start, end
    if (startDate && endDate) {
      start = startDate
      end = endDate
    } else {
      // Default to current month
      const month = req.query.month ? parseInt(req.query.month) : now.getMonth() + 1
      const year = req.query.year ? parseInt(req.query.year) : now.getFullYear()
      start = `${year}-${String(month).padStart(2, '0')}-01`
      const lastDay = new Date(year, month, 0).getDate()
      end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    }

    // Get cost data to extract credits
    const costData = await getCostDataForUser(userId, now.getMonth() + 1, now.getFullYear())
    const providerData = costData.find(cost => cost.provider_code === providerId)

    if (!providerData) {
      return res.json({ 
        credits: 0,
        creditsDetail: [],
        summary: {
          totalRemaining: 0,
          totalUsed: 0,
          activeCredits: 0
        }
      })
    }

    const totalCredits = Math.abs(parseFloat(providerData.credits) || 0)

    // For detailed credit information, we'll structure it similar to AWS console
    // Note: AWS Cost Explorer API doesn't provide detailed credit breakdown like the console
    // This is a simplified version - in production, you'd want to use AWS Billing API or store credit details separately
    const creditsDetail = []
    
    if (totalCredits > 0) {
      // Create a summary credit entry
      creditsDetail.push({
        creditName: 'Applied Credits',
        amountUsed: totalCredits,
        creditType: 'Applied',
        date: end
      })
    }

    // Calculate summary
    const totalUsed = creditsDetail.reduce((sum, c) => sum + (c.amountUsed || 0), 0)
    const totalRemaining = creditsDetail.reduce((sum, c) => sum + (c.amountRemaining || 0), 0)

    res.json({ 
      credits: totalCredits,
      creditsDetail,
      summary: {
        totalRemaining,
        totalUsed,
        activeCredits: creditsDetail.length
      }
    })
  } catch (error) {
    logger.error('Get credits error', { 
      userId, 
      providerId, 
      startDate, 
      endDate, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get daily cost data for a provider within a date range
router.get('/:providerId/daily', limitHistoricalData, async (req, res) => {
  try {
    const userId = req.user.userId
    const { providerId } = req.params
    let { startDate, endDate } = req.query

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate query parameters are required' })
    }

    // Apply historical data limit if set
    const monthsLimit = req.subscriptionDataLimit
    if (monthsLimit && monthsLimit > 0) {
      const limitDate = new Date()
      limitDate.setMonth(limitDate.getMonth() - monthsLimit)
      limitDate.setHours(0, 0, 0, 0)
      const limitDateStr = limitDate.toISOString().split('T')[0]
      
      // Adjust startDate if it's before the limit
      if (startDate < limitDateStr) {
        startDate = limitDateStr
        logger.debug('Historical data limit applied', { userId, monthsLimit, adjustedStartDate: startDate })
      }
    }

    logger.debug('Daily Cost Data: Fetching data', { userId, providerId, startDate, endDate })
    
    const dailyData = await getDailyCostData(userId, providerId, startDate, endDate)
    
    logger.debug('Daily Cost Data: Found data points', { 
      userId, 
      providerId, 
      count: dailyData.length 
    })
    
    res.json({ dailyData })
  } catch (error) {
    logger.error('Get daily cost data error', { 
      userId, 
      providerId, 
      startDate, 
      endDate, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

/**
 * POST /api/cost-data/:providerId/report
 * Generate comprehensive provider report with all analysis
 */
router.post('/:providerId/report', async (req, res) => {
  // Note: authenticateToken is applied globally via router.use() above
  try {
    logger.info('Provider Report: Starting report generation', {
      providerId: req.params.providerId,
      timestamp: new Date().toISOString(),
      hasUser: !!req.user
    })
    
    if (!req.user) {
      logger.error('Provider Report: No user object - authentication middleware may have failed')
      return res.status(401).json({ error: 'Authentication required' })
    }
    
    const userId = req.user.userId || req.user.id
    if (!userId) {
      logger.error('Provider Report: User object exists but no ID found', { 
        userObject: req.user 
      })
      return res.status(401).json({ error: 'User ID not found' })
    }
    
    logger.debug('Provider Report: Authenticated user', { userId })
    
    const { providerId } = req.params
    const { startDate, endDate, format = 'pdf', accountId } = req.body

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' })
    }

    if (!['json', 'pdf'].includes(format)) {
      return res.status(400).json({ error: 'format must be json or pdf' })
    }

    // Get all cost data for the period
    logger.debug('Provider Report: Generating report', { 
      userId, 
      providerId, 
      startDate, 
      endDate, 
      accountId: accountId || 'all' 
    })
    
    // First, get daily cost data to calculate total
    const dailyCostData = await getDailyCostData(userId, providerId, startDate, endDate, accountId).catch((err) => {
      logger.error('Provider Report: Error fetching daily cost data', { 
        userId, 
        providerId, 
        startDate, 
        endDate, 
        error: err.message 
      })
      return []
    })
    
    const totalDailyCost = dailyCostData.reduce((sum, d) => sum + (parseFloat(d.cost) || 0), 0)
    logger.debug('Provider Report: Daily cost data retrieved', { 
      days: dailyCostData.length, 
      total: totalDailyCost.toFixed(2) 
    })
    
    // Get services breakdown
    logger.debug('Provider Report: Fetching services breakdown')
    let servicesResult = []
    try {
      servicesResult = await getServiceCostsForDateRange(userId, providerId, startDate, endDate)
      logger.debug('Provider Report: Services fetched', { count: servicesResult.length })
    } catch (err) {
      logger.error('Provider Report: Error fetching services', { 
        userId, 
        providerId, 
        startDate, 
        endDate, 
        error: err.message, 
        stack: err.stack 
      })
      servicesResult = []
    }
    
    // If no services found, try to get from cost_data table for months in the period
    let fallbackServices = []
    let fallbackTotal = 0
    if (servicesResult.length === 0 && totalDailyCost === 0) {
      logger.debug('Provider Report: No daily data found, trying to aggregate from cost_data table')
      const client = await pool.connect()
      try {
        // Get months in the date range
        const start = new Date(startDate)
        const end = new Date(endDate)
        const months = []
        let current = new Date(start.getFullYear(), start.getMonth(), 1)
        while (current <= end) {
          months.push({
            year: current.getFullYear(),
            month: current.getMonth() + 1
          })
          current.setMonth(current.getMonth() + 1)
        }
        
        // Aggregate cost_data for these months
        for (const { year, month } of months) {
          const costDataResult = await client.query(
            `SELECT cd.id, cd.current_month_cost, cd.account_id
             FROM cost_data cd
             WHERE cd.user_id = $1 AND cd.provider_id = $2 AND cd.year = $3 AND cd.month = $4
             ${accountId ? 'AND cd.account_id = $5' : ''}
             ORDER BY cd.year DESC, cd.month DESC
             LIMIT 1`,
            accountId ? [userId, providerId, year, month, accountId] : [userId, providerId, year, month]
          )
          
          if (costDataResult.rows.length > 0) {
            const costDataId = costDataResult.rows[0].id
            const monthCost = parseFloat(costDataResult.rows[0].current_month_cost) || 0
            fallbackTotal += monthCost
            
            // Get services for this month
            const servicesResult = await client.query(
              `SELECT service_name, cost
               FROM service_costs 
               WHERE cost_data_id = $1
               ORDER BY cost DESC`,
              [costDataId]
            )
            
            // Aggregate services
            servicesResult.rows.forEach(row => {
              const existing = fallbackServices.find(s => s.name === row.service_name)
              if (existing) {
                existing.cost += parseFloat(row.cost) || 0
              } else {
                fallbackServices.push({
                  name: row.service_name,
                  cost: parseFloat(row.cost) || 0,
                  change: 0
                })
              }
            })
          }
        }
        logger.debug('Provider Report: Fallback services found', { 
          count: fallbackServices.length, 
          total: fallbackTotal.toFixed(2) 
        })
      } catch (err) {
        logger.error('Provider Report: Error in fallback', { 
          userId, 
          providerId, 
          error: err.message 
        })
      } finally {
        client.release()
      }
    }
    
    // Use fallback if no daily data
    const finalServices = servicesResult.length > 0 ? servicesResult : fallbackServices
    const servicesTotal = finalServices.reduce((sum, s) => sum + (s.cost || 0), 0)
    
    // Format services result to match expected structure
    const services = {
      services: finalServices.map(s => ({
        serviceName: s.name,
        cost: s.cost || 0,
        resourceCount: 0,
        change: s.change || 0
      })),
      totalCost: servicesTotal || fallbackTotal || totalDailyCost
    }
    
    // Use the highest total available
    const finalTotalCost = Math.max(totalDailyCost, services.totalCost, fallbackTotal)
    
    logger.info('Provider Report: Cost totals calculated', {
      servicesCount: services.services.length,
      servicesTotal: services.totalCost.toFixed(2),
      dailyTotal: totalDailyCost.toFixed(2),
      finalTotal: finalTotalCost.toFixed(2)
    })
    
    const [teams, products] = await Promise.all([
      getCostByTeam(userId, startDate, endDate, providerId, accountId).catch((err) => {
        logger.error('Provider Report: Error fetching teams', { 
          userId, 
          providerId, 
          error: err.message 
        })
        return []
      }),
      getCostByProduct(userId, startDate, endDate, providerId, accountId).catch((err) => {
        logger.error('Provider Report: Error fetching products', { 
          userId, 
          providerId, 
          error: err.message 
        })
        return []
      })
    ])
    
    logger.debug('Provider Report: Teams and products fetched', { 
      teamsCount: teams.length, 
      productsCount: products.length 
    })

    // Get team and product breakdowns
    const teamBreakdowns = await Promise.all(
      teams.map(async (team) => {
        const breakdown = await getTeamServiceBreakdown(userId, team.teamName, startDate, endDate, providerId, accountId).catch(() => [])
        return { ...team, services: breakdown }
      })
    )

    const productBreakdowns = await Promise.all(
      products.map(async (product) => {
        const breakdown = await getProductServiceBreakdown(userId, product.productName, startDate, endDate, providerId, accountId).catch(() => [])
        return { ...product, services: breakdown }
      })
    )

    // Fetch all cost analysis data
    logger.debug('Provider Report: Fetching cost analysis data')
    // Fetch all cost analysis data (use same userId as above)
    let costVsUsage, anomalies, efficiencyMetrics, rightsizingRecommendations, unitEconomics, untaggedResources
    
    try {
      const results = await Promise.all([
        getCostVsUsage(userId, providerId, startDate, endDate, accountId).catch((err) => {
          logger.error('Provider Report: Error fetching costVsUsage', { 
            userId, 
            providerId, 
            error: err.message 
          })
          return []
        }),
        getAnomalies(userId, providerId, 20, accountId).catch((err) => {
          logger.error('Provider Report: Error fetching anomalies', { 
            userId, 
            providerId, 
            error: err.message 
          })
          return []
        }),
        getCostEfficiencyMetrics(userId, startDate, endDate, providerId, accountId).catch((err) => {
          logger.error('Provider Report: Error fetching efficiencyMetrics', { 
            userId, 
            providerId, 
            error: err.message 
          })
          return []
        }),
        getRightsizingRecommendations(userId, providerId, accountId).catch((err) => {
          logger.error('Provider Report: Error fetching rightsizingRecommendations', { 
            userId, 
            providerId, 
            error: err.message 
          })
          return []
        }),
        getUnitEconomics(userId, startDate, endDate, providerId, accountId).catch((err) => {
          logger.error('Provider Report: Error fetching unitEconomics', { 
            userId, 
            providerId, 
            error: err.message 
          })
          return []
        }),
        getUntaggedResources(userId, providerId, 50, accountId).catch((err) => {
          logger.error('Provider Report: Error fetching untaggedResources', { 
            userId, 
            providerId, 
            error: err.message 
          })
          return []
        })
      ])
      
      // Ensure all are arrays - some functions might return objects or null
      costVsUsage = Array.isArray(results[0]) ? results[0] : []
      anomalies = Array.isArray(results[1]) ? results[1] : []
      efficiencyMetrics = Array.isArray(results[2]) ? results[2] : []
      rightsizingRecommendations = Array.isArray(results[3]) ? results[3] : []
      unitEconomics = Array.isArray(results[4]) ? results[4] : []
      untaggedResources = Array.isArray(results[5]) ? results[5] : []
      
      logger.debug('Provider Report: Analysis data fetched', {
        costVsUsage: costVsUsage.length,
        anomalies: anomalies.length,
        efficiencyMetrics: efficiencyMetrics.length,
        rightsizingRecommendations: rightsizingRecommendations.length,
        unitEconomics: unitEconomics.length,
        untaggedResources: untaggedResources.length
      })
    } catch (err) {
      logger.error('Provider Report: Error fetching analysis data', { 
        userId, 
        providerId, 
        error: err.message, 
        stack: err.stack 
      })
      costVsUsage = []
      anomalies = []
      efficiencyMetrics = []
      rightsizingRecommendations = []
      unitEconomics = []
      untaggedResources = []
    }

    // Fetch Cost Summary (AI-generated explanation)
    logger.debug('Provider Report: Fetching cost summary')
    let costSummary = null
    try {
      costSummary = await generateCustomDateRangeExplanation(userId, providerId, startDate, endDate, accountId)
      logger.debug('Provider Report: Cost summary fetched successfully')
    } catch (err) {
      logger.error('Provider Report: Error fetching cost summary', { 
        userId, 
        providerId, 
        startDate, 
        endDate, 
        error: err.message, 
        stack: err.stack 
      })
      // Continue without cost summary - it's optional
      costSummary = null
    }

    // Prepare comprehensive report data
    const reportData = {
      reportType: 'provider_analysis',
      summary: {
        totalCost: finalTotalCost,
        resourceCount: services.services?.reduce((sum, s) => sum + (s.resourceCount || 0), 0) || 0,
        serviceCount: services.services?.length || 0,
        period: { startDate, endDate },
        providerId,
        accountId,
        dailyDataPoints: dailyCostData.length
      },
      costData: [
        // Services
        ...(Array.isArray(services.services) ? services.services.map(s => ({
          category: 'Service',
          name: s.serviceName,
          cost: s.cost || 0,
          resourceCount: s.resourceCount || 0,
          serviceCount: 1
        })) : []),
        // Teams
        ...(Array.isArray(teamBreakdowns) ? teamBreakdowns.map(t => ({
          category: 'Team',
          name: t.teamName,
          cost: t.totalCost || 0,
          resourceCount: t.resourceCount || 0,
          serviceCount: t.serviceCount || 0
        })) : []),
        // Products
        ...(Array.isArray(productBreakdowns) ? productBreakdowns.map(p => ({
          category: 'Product',
          name: p.productName,
          cost: p.totalCost || 0,
          resourceCount: p.resourceCount || 0,
          serviceCount: p.serviceCount || 0
        })) : [])
      ],
      teams: (teamBreakdowns || []).map(t => ({
        teamName: t.teamName,
        totalCost: t.totalCost || 0,
        resourceCount: t.resourceCount || 0,
        serviceCount: t.serviceCount || 0,
        services: (t.services || []).map(s => ({
          serviceName: s.serviceName,
          cost: s.cost || 0
        }))
      })),
      products: (productBreakdowns || []).map(p => ({
        productName: p.productName,
        totalCost: p.totalCost || 0,
        resourceCount: p.resourceCount || 0,
        serviceCount: p.serviceCount || 0,
        services: (p.services || []).map(s => ({
          serviceName: s.serviceName,
          cost: s.cost || 0
        }))
      })),
      services: (services.services || []).map(s => ({
        serviceName: s.serviceName,
        cost: s.cost || 0,
        resourceCount: s.resourceCount || 0,
        change: s.change || 0
      })),
      // Cost Analysis Features - ensure all are serializable
      costVsUsage: Array.isArray(costVsUsage) ? costVsUsage.map(item => ({
        serviceName: item.serviceName || null,
        cost: item.cost || 0,
        usage: item.usage || 0,
        usageUnit: item.usageUnit || null,
        unitCost: item.unitCost || null
      })) : [],
      anomalies: Array.isArray(anomalies) ? anomalies.map(anomaly => ({
        serviceName: anomaly.serviceName || null,
        currentCost: anomaly.currentCost || 0,
        baselineCost: anomaly.baselineCost || 0,
        changePercent: anomaly.changePercent || 0
      })) : [],
      efficiencyMetrics: Array.isArray(efficiencyMetrics) ? efficiencyMetrics.map(metric => ({
        serviceName: metric.serviceName || null,
        cost: metric.cost || 0,
        efficiency: metric.efficiency || null,
        efficiencyUnit: metric.efficiencyUnit || null,
        trend: metric.trend || null
      })) : [],
      rightsizingRecommendations: Array.isArray(rightsizingRecommendations) ? rightsizingRecommendations.map(rec => ({
        resourceName: rec.resourceName || null,
        currentSize: rec.currentSize || null,
        recommendedSize: rec.recommendedSize || null,
        utilization: rec.utilization || 0,
        estimatedSavings: rec.estimatedSavings || 0,
        priority: rec.priority || null
      })) : [],
      unitEconomics: Array.isArray(unitEconomics) ? unitEconomics.map(econ => ({
        metricName: econ.metricName || null,
        totalCost: econ.totalCost || 0,
        metricValue: econ.metricValue || 0,
        unitCost: econ.unitCost || null
      })) : [],
      untaggedResources: Array.isArray(untaggedResources) ? untaggedResources.map(resource => ({
        resourceId: resource.resourceId || null,
        serviceName: resource.serviceName || null,
        cost: resource.cost || 0
      })) : [],
      costSummary: costSummary ? {
        explanation: costSummary.explanation || null,
        costChange: costSummary.costChange || 0,
        contributingFactors: Array.isArray(costSummary.contributingFactors) ? costSummary.contributingFactors : [],
        startDate: costSummary.startDate || null,
        endDate: costSummary.endDate || null,
        startCost: costSummary.startCost || 0,
        endCost: costSummary.endCost || 0,
        aiEnhanced: costSummary.aiEnhanced || false
      } : null,
      generatedAt: new Date().toISOString(),
      options: {
        reportName: `${providerId.toUpperCase()} Analysis Report`,
        providerId,
        accountId
      }
    }

    // Generate report file
    try {
      if (format === 'json') {
        logger.debug('Provider Report: Generating JSON report')
        // Clean up reportData to ensure it's JSON-serializable
        const cleanReportData = {
          ...reportData,
          costSummary: reportData.costSummary ? {
            explanation: reportData.costSummary.explanation || null,
            costChange: reportData.costSummary.costChange || 0,
            contributingFactors: reportData.costSummary.contributingFactors || [],
            startDate: reportData.costSummary.startDate || null,
            endDate: reportData.costSummary.endDate || null,
            startCost: reportData.costSummary.startCost || 0,
            endCost: reportData.costSummary.endCost || 0,
            aiEnhanced: reportData.costSummary.aiEnhanced || false
          } : null
        }
        
        const jsonData = JSON.stringify(cleanReportData, null, 2)
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Content-Disposition', `attachment; filename="${providerId}_analysis_${startDate}_to_${endDate}.json"`)
        res.send(jsonData)
        logger.info('Provider Report: JSON report generated successfully', { 
          providerId, 
          startDate, 
          endDate 
        })
      } else {
        logger.debug('Provider Report: Generating PDF report')
        const pdfBuffer = await generatePDFReportBuffer(reportData)
        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Disposition', `attachment; filename="${providerId}_analysis_${startDate}_to_${endDate}.pdf"`)
        res.send(pdfBuffer)
        logger.info('Provider Report: PDF report generated successfully', { 
          providerId, 
          startDate, 
          endDate 
        })
      }
    } catch (genError) {
      logger.error('Provider Report: Error generating report file', { 
        providerId, 
        format, 
        error: genError.message, 
        stack: genError.stack 
      })
      throw genError
    }
  } catch (error) {
    logger.error('Provider Report: Generate provider report error', { 
      providerId: req.params.providerId, 
      userId: req.user?.userId, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ 
      error: 'Failed to generate provider report',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// CSV generation removed - now using JSON format
// Helper to generate CSV buffer (deprecated - not used)
async function generateCSVReportBuffer_DEPRECATED(reportData) {
  const createCsvWriter = (await import('csv-writer')).default.createObjectCsvWriter
  const fs = await import('fs/promises')
  const path = await import('path')
  const os = await import('os')
  
  const tempFile = path.join(os.tmpdir(), `report_${Date.now()}.csv`)
  const csvWriter = createCsvWriter({
    path: tempFile,
    header: [
      { id: 'category', title: 'Category' },
      { id: 'name', title: 'Name' },
      { id: 'cost', title: 'Cost ($)' },
      { id: 'resourceCount', title: 'Resource Count' },
      { id: 'serviceCount', title: 'Service Count' }
    ]
  })

  // Write all data including summary
  const allRecords = [
    ...reportData.costData,
    {
      category: 'SUMMARY',
      name: 'Total',
      cost: reportData.summary.totalCost.toFixed(2),
      resourceCount: reportData.summary.resourceCount,
      serviceCount: reportData.summary.serviceCount
    }
  ]
  
  // Add analysis data as additional rows with different categories
  if (reportData.costVsUsage && reportData.costVsUsage.length > 0) {
    allRecords.push(
      ...reportData.costVsUsage.map(item => ({
        category: 'COST_VS_USAGE',
        name: item.serviceName || 'N/A',
        cost: (item.cost || 0).toFixed(2),
        resourceCount: item.usage || 0,
        serviceCount: item.unitCost ? item.unitCost.toFixed(4) : 0
      }))
    )
  }
  
  if (reportData.anomalies && reportData.anomalies.length > 0) {
    allRecords.push(
      ...reportData.anomalies.map(anomaly => ({
        category: 'ANOMALY',
        name: anomaly.serviceName || 'N/A',
        cost: (anomaly.currentCost || 0).toFixed(2),
        resourceCount: (anomaly.baselineCost || 0).toFixed(2),
        serviceCount: (anomaly.changePercent || 0).toFixed(1)
      }))
    )
  }
  
  if (reportData.rightsizingRecommendations && reportData.rightsizingRecommendations.length > 0) {
    allRecords.push(
      ...reportData.rightsizingRecommendations.map(rec => ({
        category: 'RIGHTSIZING',
        name: rec.resourceName || 'N/A',
        cost: (rec.estimatedSavings || 0).toFixed(2),
        resourceCount: (rec.utilization || 0).toFixed(1),
        serviceCount: rec.recommendedSize || 'N/A'
      }))
    )
  }
  
  if (reportData.efficiencyMetrics && reportData.efficiencyMetrics.length > 0) {
    allRecords.push(
      ...reportData.efficiencyMetrics.map(metric => ({
        category: 'EFFICIENCY',
        name: metric.serviceName || 'N/A',
        cost: (metric.cost || 0).toFixed(2),
        resourceCount: metric.efficiency ? metric.efficiency.toFixed(4) : 0,
        serviceCount: metric.efficiencyUnit || 'N/A'
      }))
    )
  }
  
  if (reportData.unitEconomics && reportData.unitEconomics.length > 0) {
    allRecords.push(
      ...reportData.unitEconomics.map(econ => ({
        category: 'UNIT_ECONOMICS',
        name: econ.metricName || 'N/A',
        cost: (econ.totalCost || 0).toFixed(2),
        resourceCount: econ.metricValue || 0,
        serviceCount: econ.unitCost ? econ.unitCost.toFixed(4) : 0
      }))
    )
  }
  
  if (reportData.untaggedResources && reportData.untaggedResources.length > 0) {
    allRecords.push(
      ...reportData.untaggedResources.map(resource => ({
        category: 'UNTAGGED',
        name: resource.resourceId || 'N/A',
        cost: (resource.cost || 0).toFixed(2),
        resourceCount: 0,
        serviceCount: resource.serviceName || 'N/A'
      }))
    )
  }
  
  await csvWriter.writeRecords(allRecords)
  const buffer = await fs.readFile(tempFile)
  await fs.unlink(tempFile)
  return buffer
}

// Helper to generate PDF buffer
async function generatePDFReportBuffer(reportData) {
  const PDFDocument = (await import('pdfkit')).default
  
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 })
    const chunks = []
    
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    
    // Header with better styling
    doc.fontSize(24).font('Helvetica-Bold').text(
      `${reportData.options.providerId.toUpperCase()} Cost Analysis Report`,
      { align: 'center' }
    )
    doc.moveDown(0.5)
    doc.fontSize(11).font('Helvetica').fillColor('gray')
    doc.text(`Period: ${reportData.summary.period.startDate} to ${reportData.summary.period.endDate}`, { align: 'center' })
    doc.moveDown(1)
    doc.fillColor('black')
    
    // Executive Summary Box
    doc.rect(50, doc.y, 495, 80).stroke()
    doc.fontSize(14).font('Helvetica-Bold').text('Executive Summary', 60, doc.y + 10)
    doc.fontSize(11).font('Helvetica')
    let summaryY = doc.y + 30
    doc.text(`Total Cost: $${reportData.summary.totalCost.toFixed(2)}`, 60, summaryY)
    doc.text(`Total Services: ${reportData.summary.serviceCount}`, 250, summaryY)
    summaryY += 15
    doc.text(`Total Resources: ${reportData.summary.resourceCount}`, 60, summaryY)
    if (reportData.summary.dailyDataPoints !== undefined) {
      doc.text(`Data Points: ${reportData.summary.dailyDataPoints} days`, 250, summaryY)
    }
    doc.y = doc.y + 90
    doc.moveDown(0.5)
    
    // Cost Summary (AI-generated explanation)
    if (reportData.costSummary && reportData.costSummary.explanation) {
      doc.addPage()
      doc.fontSize(16).font('Helvetica-Bold').text('Cost Summary', { underline: true })
      doc.moveDown(0.5)
      doc.fontSize(11).font('Helvetica')
      
      // Wrap text properly
      const explanation = reportData.costSummary.explanation
      const lines = doc.heightOfString(explanation, { width: 495 })
      if (lines > 20) {
        // Split into paragraphs if too long
        const paragraphs = explanation.split('\n').filter(p => p.trim())
        paragraphs.forEach(para => {
          if (doc.y > 700) {
            doc.addPage()
          }
          doc.text(para.trim(), { width: 495, align: 'left' })
          doc.moveDown(0.3)
        })
      } else {
        doc.text(explanation, { width: 495, align: 'left' })
      }
      
      if (reportData.costSummary.costChange !== undefined) {
        doc.moveDown(0.5)
        const change = reportData.costSummary.costChange
        const changeText = change > 0 ? `increased by ${change.toFixed(1)}%` : change < 0 ? `decreased by ${Math.abs(change).toFixed(1)}%` : 'remained stable'
        doc.font('Helvetica-Bold').text(`Cost ${changeText} compared to previous period.`, { width: 495 })
        doc.font('Helvetica')
      }
      
      doc.moveDown(1)
    }
    
    // Show message if no data
    if (reportData.summary.totalCost === 0 && reportData.services.length === 0) {
      doc.fontSize(14).text('No Cost Data Available', { underline: true })
      doc.fontSize(11)
      doc.text('No cost data was found for the selected period.')
      doc.text('This could mean:')
      doc.text('• No data has been synced for this period yet')
      doc.text('• The provider has no costs for this time range')
      doc.text('• Please sync your cloud provider data to generate reports')
      doc.moveDown()
    }
    
    // Services breakdown with better formatting
    if (reportData.services.length > 0) {
      if (doc.y > 650) {
        doc.addPage()
      }
      doc.fontSize(16).font('Helvetica-Bold').text('Services Breakdown', { underline: true })
      doc.moveDown(0.5)
      doc.fontSize(10).font('Helvetica-Bold')
      let y = doc.y
      // Table header with background
      doc.rect(50, y - 5, 495, 20).fillAndStroke('gray', 'black')
      doc.fillColor('white')
      doc.text('Service Name', 55, y)
      doc.text('Cost ($)', 380, y, { width: 80, align: 'right' })
      doc.text('Change %', 470, y, { width: 70, align: 'right' })
      doc.fillColor('black')
      y += 25
      doc.font('Helvetica')
      
      // Alternating row colors
      let rowIndex = 0
      reportData.services.slice(0, 50).forEach(service => {
        if (y > 700) {
          doc.addPage()
          y = 50
          // Redraw header on new page
          doc.font('Helvetica-Bold')
          doc.rect(50, y - 5, 495, 20).fillAndStroke('gray', 'black')
          doc.fillColor('white')
          doc.text('Service Name', 55, y)
          doc.text('Cost ($)', 380, y, { width: 80, align: 'right' })
          doc.text('Change %', 470, y, { width: 70, align: 'right' })
          doc.fillColor('black')
          doc.font('Helvetica')
          y += 25
        }
        
        // Alternating row background
        if (rowIndex % 2 === 0) {
          doc.rect(50, y - 3, 495, 14).fillColor('#f5f5f5').fill()
          doc.fillColor('black')
        }
        
        doc.text(service.serviceName || 'N/A', 55, y, { width: 320 })
        doc.text(`$${(service.cost || 0).toFixed(2)}`, 380, y, { width: 80, align: 'right' })
        const change = service.change || 0
        if (change !== 0) {
          doc.fillColor(change > 0 ? 'red' : 'green')
          doc.text(`${change > 0 ? '+' : ''}${change.toFixed(1)}%`, 470, y, { width: 70, align: 'right' })
          doc.fillColor('black')
        } else {
          doc.text('-', 470, y, { width: 70, align: 'right' })
        }
        y += 15
        rowIndex++
      })
      doc.moveDown(0.5)
    }
    
    // Teams breakdown
    if (reportData.teams.length > 0) {
      doc.fontSize(16).text('Teams Breakdown', { underline: true })
      doc.moveDown(0.5)
      doc.fontSize(10)
      let y = doc.y
      doc.text('Team Name', 50, y)
      doc.text('Cost ($)', 350, y, { width: 100, align: 'right' })
      doc.text('Resources', 450, y, { width: 80, align: 'right' })
      y += 20
      
      reportData.teams.slice(0, 30).forEach(team => {
        if (y > 700) {
          doc.addPage()
          y = 50
        }
        doc.text(team.teamName || 'N/A', 50, y, { width: 280 })
        doc.text(`$${(team.totalCost || 0).toFixed(2)}`, 350, y, { width: 100, align: 'right' })
        doc.text((team.resourceCount || 0).toString(), 450, y, { width: 80, align: 'right' })
        y += 15
      })
      doc.moveDown()
    }
    
    // Products breakdown
    if (reportData.products.length > 0) {
      doc.fontSize(16).text('Products Breakdown', { underline: true })
      doc.moveDown(0.5)
      doc.fontSize(10)
      let y = doc.y
      doc.text('Product Name', 50, y)
      doc.text('Cost ($)', 350, y, { width: 100, align: 'right' })
      doc.text('Resources', 450, y, { width: 80, align: 'right' })
      y += 20
      
      reportData.products.slice(0, 30).forEach(product => {
        if (y > 700) {
          doc.addPage()
          y = 50
        }
        doc.text(product.productName || 'N/A', 50, y, { width: 280 })
        doc.text(`$${(product.totalCost || 0).toFixed(2)}`, 350, y, { width: 100, align: 'right' })
        doc.text((product.resourceCount || 0).toString(), 450, y, { width: 80, align: 'right' })
        y += 15
      })
      doc.moveDown()
    }

    // Cost Analysis Sections
    let y = doc.y
    
    // Cost vs Usage Analysis with better formatting
    if (reportData.costVsUsage && reportData.costVsUsage.length > 0) {
      if (doc.y > 650) {
        doc.addPage()
      }
      doc.fontSize(16).font('Helvetica-Bold').text('Cost vs Usage Analysis', { underline: true })
      doc.moveDown(0.5)
      doc.fontSize(10).font('Helvetica-Bold')
      y = doc.y
      // Table header
      doc.rect(50, y - 5, 495, 20).fillAndStroke('gray', 'black')
      doc.fillColor('white')
      doc.text('Service', 55, y)
      doc.text('Cost ($)', 280, y, { width: 80, align: 'right' })
      doc.text('Usage', 370, y, { width: 100 })
      doc.text('Unit Cost', 480, y, { width: 65, align: 'right' })
      doc.fillColor('black')
      y += 25
      doc.font('Helvetica')
      
      let rowIndex = 0
      reportData.costVsUsage.slice(0, 30).forEach(item => {
        if (y > 700) {
          doc.addPage()
          y = 50
          // Redraw header
          doc.font('Helvetica-Bold')
          doc.rect(50, y - 5, 495, 20).fillAndStroke('gray', 'black')
          doc.fillColor('white')
          doc.text('Service', 55, y)
          doc.text('Cost ($)', 280, y, { width: 80, align: 'right' })
          doc.text('Usage', 370, y, { width: 100 })
          doc.text('Unit Cost', 480, y, { width: 65, align: 'right' })
          doc.fillColor('black')
          doc.font('Helvetica')
          y += 25
        }
        
        // Alternating row background
        if (rowIndex % 2 === 0) {
          doc.rect(50, y - 3, 495, 14).fillColor('#f5f5f5').fill()
          doc.fillColor('black')
        }
        
        doc.text(item.serviceName || 'N/A', 55, y, { width: 220 })
        doc.text(`$${(item.cost || 0).toFixed(2)}`, 280, y, { width: 80, align: 'right' })
        const usageText = item.usage && item.usage > 0 ? `${(item.usage || 0).toFixed(2)} ${item.usageUnit || ''}`.trim() : '-'
        doc.text(usageText, 370, y, { width: 100 })
        const unitCost = item.unitCost && item.unitCost > 0 ? `$${item.unitCost.toFixed(4)}` : '-'
        doc.text(unitCost, 480, y, { width: 65, align: 'right' })
        y += 15
        rowIndex++
      })
      doc.moveDown(0.5)
      y = doc.y
    }

    // Cost Anomalies with better formatting
    if (reportData.anomalies && reportData.anomalies.length > 0) {
      if (doc.y > 650) {
        doc.addPage()
      }
      doc.fontSize(16).font('Helvetica-Bold').text('Cost Anomalies Detected', { underline: true })
      doc.moveDown(0.5)
      doc.fontSize(10).font('Helvetica-Bold')
      y = doc.y
      doc.rect(50, y - 5, 495, 20).fillAndStroke('gray', 'black')
      doc.fillColor('white')
      doc.text('Service', 55, y)
      doc.text('Current Cost', 280, y, { width: 90, align: 'right' })
      doc.text('Baseline', 380, y, { width: 90, align: 'right' })
      doc.text('Change %', 480, y, { width: 65, align: 'right' })
      doc.fillColor('black')
      y += 25
      doc.font('Helvetica')
      
      let rowIndex = 0
      reportData.anomalies.slice(0, 20).forEach(anomaly => {
        if (y > 700) {
          doc.addPage()
          y = 50
          doc.font('Helvetica-Bold')
          doc.rect(50, y - 5, 495, 20).fillAndStroke('gray', 'black')
          doc.fillColor('white')
          doc.text('Service', 55, y)
          doc.text('Current Cost', 280, y, { width: 90, align: 'right' })
          doc.text('Baseline', 380, y, { width: 90, align: 'right' })
          doc.text('Change %', 480, y, { width: 65, align: 'right' })
          doc.fillColor('black')
          doc.font('Helvetica')
          y += 25
        }
        
        if (rowIndex % 2 === 0) {
          doc.rect(50, y - 3, 495, 14).fillColor('#f5f5f5').fill()
          doc.fillColor('black')
        }
        
        doc.text(anomaly.serviceName || 'N/A', 55, y, { width: 220 })
        doc.text(`$${(anomaly.currentCost || 0).toFixed(2)}`, 280, y, { width: 90, align: 'right' })
        doc.text(`$${(anomaly.baselineCost || 0).toFixed(2)}`, 380, y, { width: 90, align: 'right' })
        const changeColor = anomaly.changePercent > 0 ? 'red' : 'green'
        doc.fillColor(changeColor)
        doc.text(`${anomaly.changePercent > 0 ? '+' : ''}${(anomaly.changePercent || 0).toFixed(1)}%`, 480, y, { width: 65, align: 'right' })
        doc.fillColor('black')
        y += 15
        rowIndex++
      })
      doc.moveDown(0.5)
      y = doc.y
    }

    // Cost Efficiency Metrics
    if (reportData.efficiencyMetrics && reportData.efficiencyMetrics.length > 0) {
      if (y > 650) {
        doc.addPage()
        y = 50
      }
      doc.fontSize(16).text('Cost Efficiency Metrics', { underline: true })
      doc.moveDown(0.5)
      doc.fontSize(10)
      y = doc.y
      doc.text('Service', 50, y)
      doc.text('Cost ($)', 200, y, { width: 100, align: 'right' })
      doc.text('Efficiency', 310, y, { width: 120 })
      doc.text('Trend', 440, y, { width: 60 })
      y += 20
      
      reportData.efficiencyMetrics.slice(0, 25).forEach(metric => {
        if (y > 700) {
          doc.addPage()
          y = 50
        }
        doc.text(metric.serviceName || 'N/A', 50, y, { width: 140 })
        doc.text(`$${(metric.cost || 0).toFixed(2)}`, 200, y, { width: 100, align: 'right' })
        const efficiency = metric.efficiency ? `${metric.efficiency.toFixed(4)} ${metric.efficiencyUnit || ''}` : 'N/A'
        doc.text(efficiency, 310, y, { width: 120 })
        const trend = metric.trend === 'improving' ? '↓' : metric.trend === 'degrading' ? '↑' : '→'
        doc.text(trend, 440, y, { width: 60 })
        y += 15
      })
      doc.moveDown()
      y = doc.y
    }

    // Rightsizing Recommendations
    if (reportData.rightsizingRecommendations && reportData.rightsizingRecommendations.length > 0) {
      if (y > 650) {
        doc.addPage()
        y = 50
      }
      doc.fontSize(16).text('Rightsizing Recommendations', { underline: true })
      doc.moveDown(0.5)
      doc.fontSize(10)
      y = doc.y
      doc.text('Resource', 50, y)
      doc.text('Current Size', 200, y, { width: 100 })
      doc.text('Utilization', 310, y, { width: 80, align: 'right' })
      doc.text('Savings', 400, y, { width: 100, align: 'right' })
      y += 20
      
      reportData.rightsizingRecommendations.slice(0, 20).forEach(rec => {
        if (y > 700) {
          doc.addPage()
          y = 50
        }
        doc.text(rec.resourceName || 'N/A', 50, y, { width: 140 })
        doc.text(rec.currentSize || 'N/A', 200, y, { width: 100 })
        doc.text(`${(rec.utilization || 0).toFixed(1)}%`, 310, y, { width: 80, align: 'right' })
        doc.text(`$${(rec.estimatedSavings || 0).toFixed(2)}/mo`, 400, y, { width: 100, align: 'right' })
        y += 15
      })
      doc.moveDown()
      y = doc.y
    }

    // Unit Economics
    if (reportData.unitEconomics && reportData.unitEconomics.length > 0) {
      if (y > 650) {
        doc.addPage()
        y = 50
      }
      doc.fontSize(16).text('Unit Economics', { underline: true })
      doc.moveDown(0.5)
      doc.fontSize(10)
      y = doc.y
      doc.text('Metric', 50, y)
      doc.text('Cost ($)', 200, y, { width: 100, align: 'right' })
      doc.text('Value', 310, y, { width: 100, align: 'right' })
      doc.text('Unit Cost', 420, y, { width: 80, align: 'right' })
      y += 20
      
      reportData.unitEconomics.slice(0, 20).forEach(econ => {
        if (y > 700) {
          doc.addPage()
          y = 50
        }
        doc.text(econ.metricName || 'N/A', 50, y, { width: 140 })
        doc.text(`$${(econ.totalCost || 0).toFixed(2)}`, 200, y, { width: 100, align: 'right' })
        doc.text((econ.metricValue || 0).toFixed(0), 310, y, { width: 100, align: 'right' })
        doc.text(`$${(econ.unitCost || 0).toFixed(4)}`, 420, y, { width: 80, align: 'right' })
        y += 15
      })
      doc.moveDown()
      y = doc.y
    }

    // Untagged Resources
    if (reportData.untaggedResources && reportData.untaggedResources.length > 0) {
      if (y > 650) {
        doc.addPage()
        y = 50
      }
      doc.fontSize(16).text('Untagged Resources', { underline: true })
      doc.moveDown(0.5)
      doc.fontSize(11)
      doc.text(`Found ${reportData.untaggedResources.length} untagged resources that may need cost allocation tags.`, 50, doc.y)
      doc.moveDown(0.5)
      doc.fontSize(10)
      y = doc.y
      doc.text('Resource ID', 50, y)
      doc.text('Service', 200, y, { width: 120 })
      doc.text('Cost ($)', 330, y, { width: 100, align: 'right' })
      y += 20
      
      reportData.untaggedResources.slice(0, 25).forEach(resource => {
        if (y > 700) {
          doc.addPage()
          y = 50
        }
        doc.text(resource.resourceId || 'N/A', 50, y, { width: 140 })
        doc.text(resource.serviceName || 'N/A', 200, y, { width: 120 })
        doc.text(`$${(resource.cost || 0).toFixed(2)}`, 330, y, { width: 100, align: 'right' })
        y += 15
      })
      doc.moveDown()
    }
    
    // Add footer to the last page before ending
    // Note: We can't easily add footers to all pages with pdfkit without buffering,
    // so we'll just add it to the last page
    doc.fontSize(8).font('Helvetica').fillColor('gray')
    doc.text(
      `Generated on ${new Date(reportData.generatedAt).toLocaleString()}`,
      50,
      doc.page.height - 30,
      { align: 'center', width: 495 }
    )
    doc.fillColor('black')
    
    doc.end()
  })
}

export default router
