import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import {
  getCostDataForUser,
  saveCostData,
  getUserPreferences,
  updateUserCurrency,
  updateProviderCredits,
  getDailyCostData,
  getServiceCostsForDateRange,
  getCloudProviderCredentials,
} from '../database.js'
import { 
  fetchAWSServiceDetails, 
  fetchAzureServiceDetails,
  fetchGCPServiceDetails,
  fetchDigitalOceanServiceDetails,
  fetchIBMServiceDetails,
  fetchLinodeServiceDetails,
  fetchVultrServiceDetails
} from '../services/cloudProviderIntegrations.js'

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

    const costData = await getCostDataForUser(userId, month, year)

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
    console.error('Get cost data error:', error)
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

    const now = new Date()
    const month = now.getMonth() + 1
    const year = now.getFullYear()

    await saveCostData(userId, providerId, month, year, costData)

    res.json({ message: 'Cost data saved successfully' })
  } catch (error) {
    console.error('Save cost data error:', error)
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

    console.log(`[Services API] Fetching services for user ${userId}, provider ${providerId}, range: ${startDate} to ${endDate}`)

    const allServices = await getServiceCostsForDateRange(userId, providerId, startDate, endDate)
    
    // Filter out Tax - it's not a service but a fee
    const services = allServices.filter(s => 
      s.name.toLowerCase() !== 'tax' && 
      !s.name.toLowerCase().includes('tax -') &&
      s.name.toLowerCase() !== 'vat'
    )
    
    // Calculate total for the response (excluding tax)
    const totalCost = services.reduce((sum, s) => sum + s.cost, 0)

    console.log(`[Services API] Found ${services.length} services (filtered from ${allServices.length}), total: $${totalCost.toFixed(2)}`)

    // Include metadata to help frontend detect changes
    res.json({ 
      services,
      period: { startDate, endDate },
      totalCost,
      timestamp: Date.now()
    })
  } catch (error) {
    console.error('Get services error:', error)
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
    console.log(`[Service Details API] Fetching details for ${decodedServiceName} (${providerId})`)

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
          console.error('[AWS Service Details] API failed, using simulated data:', err.message)
          subServices = await getSimulatedSubServices(decodedServiceName, providerId)
        }
        break
      
      case 'azure':
        try {
          const azureResult = await fetchAzureServiceDetails(credentials, decodedServiceName, startDate, endDate)
          subServices = azureResult.subServices || []
        } catch (err) {
          console.error('[Azure Service Details] API failed, using simulated data:', err.message)
          subServices = await getSimulatedSubServices(decodedServiceName, providerId)
        }
        break
      
      case 'gcp':
      case 'google':
        try {
          const gcpResult = await fetchGCPServiceDetails(credentials, decodedServiceName, startDate, endDate)
          subServices = gcpResult.subServices || []
        } catch (err) {
          console.error('[GCP Service Details] API failed, using simulated data:', err.message)
          subServices = await getSimulatedSubServices(decodedServiceName, providerId)
        }
        break
      
      case 'digitalocean':
      case 'do':
        try {
          const doResult = await fetchDigitalOceanServiceDetails(credentials, decodedServiceName, startDate, endDate)
          subServices = doResult.subServices || []
        } catch (err) {
          console.error('[DO Service Details] API failed, using simulated data:', err.message)
          subServices = await getSimulatedSubServices(decodedServiceName, providerId)
        }
        break
      
      case 'ibm':
      case 'ibmcloud':
        try {
          const ibmResult = await fetchIBMServiceDetails(credentials, decodedServiceName, startDate, endDate)
          subServices = ibmResult.subServices || []
        } catch (err) {
          console.error('[IBM Service Details] API failed, using simulated data:', err.message)
          subServices = await getSimulatedSubServices(decodedServiceName, providerId)
        }
        break
      
      case 'linode':
      case 'akamai':
        try {
          const linodeResult = await fetchLinodeServiceDetails(credentials, decodedServiceName, startDate, endDate)
          subServices = linodeResult.subServices || []
        } catch (err) {
          console.error('[Linode Service Details] API failed, using simulated data:', err.message)
          subServices = await getSimulatedSubServices(decodedServiceName, providerId)
        }
        break
      
      case 'vultr':
        try {
          const vultrResult = await fetchVultrServiceDetails(credentials, decodedServiceName, startDate, endDate)
          subServices = vultrResult.subServices || []
        } catch (err) {
          console.error('[Vultr Service Details] API failed, using simulated data:', err.message)
          subServices = await getSimulatedSubServices(decodedServiceName, providerId)
        }
        break
      
      default:
        // For other providers, provide generic sub-service simulation based on service type
        subServices = await getSimulatedSubServices(decodedServiceName, providerId)
    }

    console.log(`[Service Details API] Found ${subServices.length} sub-services`)

    res.json({
      serviceName: decodedServiceName,
      providerId,
      subServices,
      period: { startDate, endDate },
      timestamp: Date.now()
    })
  } catch (error) {
    console.error('Get service details error:', error)
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
    const preferences = await getUserPreferences(userId)
    // Always return preferences, even if null (will use defaults)
    res.json({ 
      preferences: preferences || {
        user_id: userId,
        currency: 'USD'
      }
    })
  } catch (error) {
    console.error('Get preferences error:', error)
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
    res.json({ message: 'Currency preference updated' })
  } catch (error) {
    console.error('Update currency error:', error)
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
    res.json({ message: 'Credits updated successfully', credits })
  } catch (error) {
    console.error('Update credits error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get credits for a provider
router.get('/:providerId/credits', async (req, res) => {
  try {
    const userId = req.user.userId
    const { providerId } = req.params
    const now = new Date()
    const month = req.query.month ? parseInt(req.query.month) : now.getMonth() + 1
    const year = req.query.year ? parseInt(req.query.year) : now.getFullYear()

    const costData = await getCostDataForUser(userId, month, year)
    const providerData = costData.find(cost => cost.provider_code === providerId)

    if (!providerData) {
      return res.json({ credits: 0 })
    }

    res.json({ credits: parseFloat(providerData.credits) || 0 })
  } catch (error) {
    console.error('Get credits error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get daily cost data for a provider within a date range
router.get('/:providerId/daily', async (req, res) => {
  try {
    const userId = req.user.userId
    const { providerId } = req.params
    const { startDate, endDate } = req.query

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate query parameters are required' })
    }

    console.log(`[Daily Cost Data] Fetching data for user ${userId}, provider ${providerId}, range: ${startDate} to ${endDate}`)
    
    const dailyData = await getDailyCostData(userId, providerId, startDate, endDate)
    
    console.log(`[Daily Cost Data] Found ${dailyData.length} data points`)
    
    res.json({ dailyData })
  } catch (error) {
    console.error('Get daily cost data error:', error)
    console.error('Error stack:', error.stack)
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

export default router
