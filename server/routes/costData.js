import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import {
  getCostDataForUser,
  saveCostData,
  getUserPreferences,
  updateUserCurrency,
  updateProviderCredits,
  getDailyCostData,
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

    const costData = await getCostDataForUser(userId, month, year)

    // Format response to match frontend expectations
    const formattedData = costData.map(cost => ({
      provider: {
        id: cost.provider_code,
        name: cost.provider_name,
        icon: cost.icon || '☁️',
      },
      currentMonth: cost.current_month_cost,
      lastMonth: cost.last_month_cost,
      forecast: cost.forecast_cost,
      credits: cost.credits,
      savings: cost.savings,
      services: cost.services || [],
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

// Get user preferences (currency)
router.get('/preferences', async (req, res) => {
  try {
    const userId = req.user.userId
    const preferences = await getUserPreferences(userId)
    res.json({ preferences })
  } catch (error) {
    console.error('Get preferences error:', error)
    console.error('Get preferences error stack:', error.stack)
    res.status(500).json({ error: error.message || 'Internal server error' })
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
