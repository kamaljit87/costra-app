import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { attachOrg } from '../middleware/orgAuth.js'
import {
  getSavingsPlansForUser,
  saveSavingsPlan,
  getSavingsPlansUtilizationSummary,
  getSavingsPlanUtilizationHistory,
  updateSavingsPlan,
  deleteSavingsPlan,
} from '../database.js'
import logger from '../utils/logger.js'

const router = express.Router()

// All routes require authentication
router.use(authenticateToken, attachOrg)

// Get savings plans for current user
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const plans = await getSavingsPlansForUser(userId)

    // Format response
    const formattedPlans = plans.map(plan => ({
      id: plan.id.toString(),
      name: plan.name,
      provider: plan.provider,
      discount: plan.discount_percent,
      status: plan.status,
      expiresAt: plan.expires_at,
      commitmentAmount: plan.commitment_amount ? parseFloat(plan.commitment_amount) : null,
      utilizationPercent: plan.utilization_percent ? parseFloat(plan.utilization_percent) : null,
      coveragePercent: plan.coverage_percent ? parseFloat(plan.coverage_percent) : null,
      unusedValue: plan.unused_value ? parseFloat(plan.unused_value) : null,
      planType: plan.plan_type,
      service: plan.service,
      region: plan.region,
    }))

    res.json({ savingsPlans: formattedPlans })
  } catch (error) {
    logger.error('Get savings plans error', {
      userId: req.user?.userId,
      error: error.message,
      stack: error.stack
    })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Save savings plan for current user
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
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
    logger.error('Save savings plan error', {
      userId: req.user?.userId,
      error: error.message,
      stack: error.stack
    })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/savings-plans/utilization - aggregated utilization metrics
router.get('/utilization', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const plans = await getSavingsPlansUtilizationSummary(userId, req.orgId)
    const formattedPlans = plans.map(p => ({
      id: p.id,
      name: p.name,
      provider: p.provider,
      discount: p.discount_percent ? parseFloat(p.discount_percent) : null,
      status: p.status,
      expiresAt: p.expires_at,
      commitmentAmount: p.commitment_amount ? parseFloat(p.commitment_amount) : null,
      utilizationPercent: p.utilization_percent ? parseFloat(p.utilization_percent) : null,
      coveragePercent: p.coverage_percent ? parseFloat(p.coverage_percent) : null,
      unusedValue: p.unused_value ? parseFloat(p.unused_value) : null,
      planType: p.plan_type,
      service: p.service,
      region: p.region,
      recentHistory: p.recent_history || [],
    }))
    res.json({ plans: formattedPlans })
  } catch (error) {
    logger.error('Get utilization error', { error: error.message })
    res.status(500).json({ error: 'Failed to get utilization data' })
  }
})

// GET /api/savings-plans/:id/history
router.get('/:id/history', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30
    const history = await getSavingsPlanUtilizationHistory(parseInt(req.params.id), days)
    res.json({ history })
  } catch (error) {
    logger.error('Get utilization history error', { error: error.message })
    res.status(500).json({ error: 'Failed to get utilization history' })
  }
})

// PUT /api/savings-plans/:id
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const plan = await updateSavingsPlan(parseInt(req.params.id), userId, req.body)
    if (!plan) return res.status(404).json({ error: 'Savings plan not found' })
    res.json({ plan })
  } catch (error) {
    logger.error('Update savings plan error', { error: error.message })
    res.status(500).json({ error: 'Failed to update savings plan' })
  }
})

// DELETE /api/savings-plans/:id
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const result = await deleteSavingsPlan(parseInt(req.params.id), userId)
    if (!result) return res.status(404).json({ error: 'Savings plan not found' })
    res.json({ message: 'Savings plan deleted' })
  } catch (error) {
    logger.error('Delete savings plan error', { error: error.message })
    res.status(500).json({ error: 'Failed to delete savings plan' })
  }
})

export default router
