import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { attachOrg } from '../middleware/orgAuth.js'
import logger from '../utils/logger.js'
import { saveTerraformEstimate, getTerraformEstimates, deleteTerraformEstimate } from '../database.js'
import { estimatePlanCost } from '../services/terraformService.js'

const router = express.Router()
router.use(authenticateToken, attachOrg)

// POST /api/terraform/estimate
router.post('/estimate', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { planName, planJson } = req.body
    if (!planJson) return res.status(400).json({ error: 'planJson is required' })

    let parsed
    try {
      parsed = typeof planJson === 'string' ? JSON.parse(planJson) : planJson
    } catch {
      return res.status(400).json({ error: 'Invalid JSON in planJson' })
    }

    const estimate = estimatePlanCost(parsed)
    const saved = await saveTerraformEstimate(userId, req.orgId, {
      planName: planName || `Plan ${new Date().toISOString().split('T')[0]}`,
      planData: parsed,
      estimatedMonthlyCost: estimate.totalMonthlyCost,
      resourceBreakdown: estimate.breakdown,
    })

    res.json({ estimate: { ...estimate, id: saved.id } })
  } catch (error) {
    logger.error('Error estimating terraform plan', { error: error.message })
    res.status(500).json({ error: 'Failed to estimate terraform plan' })
  }
})

// GET /api/terraform/estimates
router.get('/estimates', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const estimates = await getTerraformEstimates(userId, req.orgId)
    res.json({ estimates })
  } catch (error) {
    logger.error('Error listing terraform estimates', { error: error.message })
    res.status(500).json({ error: 'Failed to list estimates' })
  }
})

// DELETE /api/terraform/estimates/:id
router.delete('/estimates/:id', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const result = await deleteTerraformEstimate(parseInt(req.params.id), userId)
    if (!result) return res.status(404).json({ error: 'Estimate not found' })
    res.json({ message: 'Estimate deleted' })
  } catch (error) {
    logger.error('Error deleting terraform estimate', { error: error.message })
    res.status(500).json({ error: 'Failed to delete estimate' })
  }
})

export default router
