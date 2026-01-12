import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import {
  getCostDataForUser,
  saveCostData,
  getUserPreferences,
  updateUserCurrency,
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
    res.status(500).json({ error: 'Internal server error' })
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

export default router
