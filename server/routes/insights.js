import express from 'express'
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
  getBusinessMetrics,
  getUnitEconomics,
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
    const userId = req.user.userId || req.user.id
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
      return res.status(404).json({ explanation: null })
    }
    
    // Return the full explanation object (includes explanation, costChange, contributingFactors)
    res.json(explanation)
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
      return res.status(404).json({ explanation: null })
    }
    
    // Return the full explanation object (includes explanation, costChange, contributingFactors)
    res.json(explanation)
  } catch (error) {
    console.error('Cost summary regeneration error:', error)
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
      return res.status(404).json({ explanation: null })
    }
    
    res.json(explanation)
  } catch (error) {
    console.error('Custom date range summary error:', error)
    res.status(500).json({ error: 'Failed to generate cost summary for date range' })
  }
})

/**
 * GET /api/insights/dimensions
 * Get available dimensions (tag keys) and their values
 */
router.get('/dimensions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id
    const { providerId } = req.query
    
    const dimensions = await getAvailableDimensions(
      userId,
      providerId || null
    )
    
    res.json({ dimensions })
  } catch (error) {
    console.error('Get dimensions error:', error)
    // Return empty array if table doesn't exist
    res.json({ dimensions: [] })
  }
})

/**
 * GET /api/insights/cost-by-dimension
 * Get costs grouped by dimension (tag)
 */
router.get('/cost-by-dimension', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id
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
    console.error('Cost by dimension error:', error)
    res.status(500).json({ error: 'Failed to fetch cost by dimension' })
  }
})

/**
 * POST /api/insights/business-metrics
 * Save or update a business metric
 */
router.post('/business-metrics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id
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
    console.error('Save business metric error:', error)
    res.status(500).json({ error: 'Failed to save business metric' })
  }
})

/**
 * GET /api/insights/business-metrics
 * Get business metrics for a date range
 */
router.get('/business-metrics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id
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
    console.error('Get business metrics error:', error)
    res.status(500).json({ error: 'Failed to fetch business metrics' })
  }
})

/**
 * GET /api/insights/unit-economics
 * Get unit economics (cost per business metric)
 */
router.get('/unit-economics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id
    const { startDate, endDate, providerId, accountId } = req.query
    
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
    console.error('Unit economics error:', error)
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

export default router
