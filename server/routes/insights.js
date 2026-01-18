import express from 'express'
import {
  getCostVsUsage,
  getUntaggedResources,
  getAnomalies,
  calculateAnomalyBaseline,
  generateCostExplanation,
  getCostExplanation,
} from '../database.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

/**
 * GET /api/insights/cost-vs-usage
 * Get cost and usage side-by-side for services
 */
router.get('/cost-vs-usage', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id
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
    console.error('Cost vs usage error:', error)
    res.status(500).json({ error: 'Failed to fetch cost vs usage data' })
  }
})

/**
 * GET /api/insights/untagged-resources
 * Get untagged resources ranked by cost impact
 */
router.get('/untagged-resources', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id
    const { providerId, limit = 50 } = req.query
    
    const resources = await getUntaggedResources(
      userId,
      providerId || null,
      parseInt(limit)
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
    console.error('Untagged resources error:', error)
    res.status(500).json({ error: 'Failed to fetch untagged resources' })
  }
})

/**
 * GET /api/insights/anomalies
 * Get cost anomalies vs 30-day baseline
 */
router.get('/anomalies', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id
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
    console.error('Anomalies error:', error)
    res.status(500).json({ error: 'Failed to fetch anomalies' })
  }
})

/**
 * POST /api/insights/anomalies/calculate
 * Calculate anomaly baselines for services
 */
router.post('/anomalies/calculate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id
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
    console.error('Anomaly baseline calculation error:', error)
    res.status(500).json({ error: 'Failed to calculate anomaly baseline' })
  }
})

/**
 * GET /api/insights/cost-summary/:providerId/:month/:year
 * Get plain-English cost explanation for a month
 */
router.get('/cost-summary/:providerId/:month/:year', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id
    const { providerId, month, year } = req.params
    const { accountId } = req.query
    
    // Try to get existing explanation
    let explanation = await getCostExplanation(
      userId,
      providerId,
      parseInt(month),
      parseInt(year),
      accountId ? parseInt(accountId) : null
    )
    
    // If no explanation exists, generate one
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
      return res.status(404).json({ error: 'No cost data found for this period' })
    }
    
    res.json({ explanation })
  } catch (error) {
    console.error('Cost summary error:', error)
    res.status(500).json({ error: 'Failed to generate cost summary' })
  }
})

/**
 * POST /api/insights/cost-summary/:providerId/:month/:year/regenerate
 * Regenerate cost explanation for a month
 */
router.post('/cost-summary/:providerId/:month/:year/regenerate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id
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
      return res.status(404).json({ error: 'No cost data found for this period' })
    }
    
    res.json({ explanation })
  } catch (error) {
    console.error('Cost summary regeneration error:', error)
    res.status(500).json({ error: 'Failed to regenerate cost summary' })
  }
})

export default router
