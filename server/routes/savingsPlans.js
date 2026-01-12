import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { getSavingsPlansForUser, saveSavingsPlan } from '../database.js'

const router = express.Router()

// All routes require authentication
router.use(authenticateToken)

// Get savings plans for current user
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId
    const plans = await getSavingsPlansForUser(userId)

    // Format response
    const formattedPlans = plans.map(plan => ({
      id: plan.id.toString(),
      name: plan.name,
      provider: plan.provider,
      discount: plan.discount_percent,
      status: plan.status,
      expiresAt: plan.expires_at,
    }))

    res.json({ savingsPlans: formattedPlans })
  } catch (error) {
    console.error('Get savings plans error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Save savings plan for current user
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId
    const { name, provider, discount, status, expiresAt } = req.body

    if (!name || !provider || discount === undefined) {
      return res.status(400).json({ error: 'Name, provider, and discount are required' })
    }

    await saveSavingsPlan(userId, {
      name,
      provider,
      discount,
      status: status || 'pending',
      expiresAt,
    })

    res.json({ message: 'Savings plan saved successfully' })
  } catch (error) {
    console.error('Save savings plan error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
