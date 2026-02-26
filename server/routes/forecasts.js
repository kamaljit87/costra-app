import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { attachOrg } from '../middleware/orgAuth.js'
import {
  createForecastScenario, getForecastScenarios, getForecastScenarioById,
  updateForecastScenario, deleteForecastScenario
} from '../database.js'
import { pool } from '../database.js'
import {
  calculateMultiMonthForecast, applyScenarioAdjustments, computeScenario
} from '../services/forecastService.js'
import logger from '../utils/logger.js'

const router = express.Router()
router.use(authenticateToken, attachOrg)

/**
 * GET /api/forecasts
 * Get multi-month base forecast
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const months = parseInt(req.query.months) || 6
    const providerId = req.query.providerId
    const accountId = req.query.accountId

    // Fetch daily cost data
    const conditions = ['user_id = $1', 'date >= CURRENT_DATE - 365']
    const params = [userId]
    let idx = 2
    if (providerId) { conditions.push(`provider_id = $${idx++}`); params.push(providerId) }
    if (accountId) { conditions.push(`account_id = $${idx++}`); params.push(parseInt(accountId)) }

    const result = await pool.query(
      `SELECT date, SUM(cost)::float AS cost
       FROM daily_cost_data
       WHERE ${conditions.join(' AND ')}
       GROUP BY date ORDER BY date ASC`,
      params
    )

    const dailyData = result.rows.map(r => ({ date: r.date, cost: parseFloat(r.cost) || 0 }))
    const forecast = calculateMultiMonthForecast(dailyData, Math.min(months, 12))

    res.json({ forecast, dataPoints: dailyData.length })
  } catch (error) {
    logger.error('Error generating forecast', { error: error.message })
    res.status(500).json({ error: 'Failed to generate forecast' })
  }
})

/**
 * GET /api/forecasts/scenarios
 * List saved scenarios
 */
router.get('/scenarios', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const scenarios = await getForecastScenarios(userId, req.orgId)
    res.json({ scenarios })
  } catch (error) {
    logger.error('Error listing scenarios', { error: error.message })
    res.status(500).json({ error: 'Failed to list scenarios' })
  }
})

/**
 * POST /api/forecasts/scenarios
 * Create a new forecast scenario
 */
router.post('/scenarios', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { name, description, adjustments, forecastMonths } = req.body

    if (!name) {
      return res.status(400).json({ error: 'Scenario name is required' })
    }

    const scenario = await createForecastScenario(userId, req.orgId, {
      name, description, adjustments: adjustments || [],
      forecastMonths: Math.min(forecastMonths || 6, 12),
    })

    // Compute the forecast immediately
    const computed = await computeScenario(scenario, userId)

    res.status(201).json({
      scenario: computed.scenario,
      baseForecast: computed.baseForecast,
      scenarioForecast: computed.scenarioForecast,
      narrative: computed.narrative,
    })
  } catch (error) {
    logger.error('Error creating scenario', { error: error.message })
    res.status(500).json({ error: 'Failed to create scenario' })
  }
})

/**
 * GET /api/forecasts/scenarios/:id
 * Get a specific scenario with forecast data
 */
router.get('/scenarios/:id', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const scenario = await getForecastScenarioById(parseInt(req.params.id), userId)
    if (!scenario) return res.status(404).json({ error: 'Scenario not found' })
    res.json({ scenario })
  } catch (error) {
    logger.error('Error getting scenario', { error: error.message })
    res.status(500).json({ error: 'Failed to get scenario' })
  }
})

/**
 * PUT /api/forecasts/scenarios/:id
 * Update a scenario and recompute
 */
router.put('/scenarios/:id', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const scenarioId = parseInt(req.params.id)
    const { name, description, adjustments, forecastMonths } = req.body

    const existing = await getForecastScenarioById(scenarioId, userId)
    if (!existing) return res.status(404).json({ error: 'Scenario not found' })

    const updated = await updateForecastScenario(scenarioId, userId, {
      name, description,
      adjustments: adjustments || undefined,
      forecastMonths: forecastMonths ? Math.min(forecastMonths, 12) : undefined,
    })

    // Recompute if adjustments changed
    if (adjustments) {
      const computed = await computeScenario(updated, userId)
      return res.json({
        scenario: computed.scenario,
        baseForecast: computed.baseForecast,
        scenarioForecast: computed.scenarioForecast,
        narrative: computed.narrative,
      })
    }

    res.json({ scenario: updated })
  } catch (error) {
    logger.error('Error updating scenario', { error: error.message })
    res.status(500).json({ error: 'Failed to update scenario' })
  }
})

/**
 * POST /api/forecasts/scenarios/:id/compute
 * Recompute a scenario's forecast
 */
router.post('/scenarios/:id/compute', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const scenario = await getForecastScenarioById(parseInt(req.params.id), userId)
    if (!scenario) return res.status(404).json({ error: 'Scenario not found' })

    const computed = await computeScenario(scenario, userId)
    res.json({
      scenario: computed.scenario,
      baseForecast: computed.baseForecast,
      scenarioForecast: computed.scenarioForecast,
      narrative: computed.narrative,
    })
  } catch (error) {
    logger.error('Error computing scenario', { error: error.message })
    res.status(500).json({ error: 'Failed to compute scenario' })
  }
})

/**
 * DELETE /api/forecasts/scenarios/:id
 * Delete a scenario
 */
router.delete('/scenarios/:id', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    await deleteForecastScenario(parseInt(req.params.id), userId)
    res.json({ success: true })
  } catch (error) {
    logger.error('Error deleting scenario', { error: error.message })
    res.status(500).json({ error: 'Failed to delete scenario' })
  }
})

/**
 * POST /api/forecasts/preview
 * Preview a scenario without saving
 */
router.post('/preview', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { adjustments, forecastMonths = 6 } = req.body

    const result = await pool.query(
      `SELECT date, SUM(cost)::float AS cost
       FROM daily_cost_data
       WHERE user_id = $1 AND date >= CURRENT_DATE - 365
       GROUP BY date ORDER BY date ASC`,
      [userId]
    )

    const dailyData = result.rows.map(r => ({ date: r.date, cost: parseFloat(r.cost) || 0 }))
    const baseForecast = calculateMultiMonthForecast(dailyData, Math.min(forecastMonths, 12))
    const scenarioForecast = applyScenarioAdjustments(baseForecast, adjustments || [])

    res.json({ baseForecast, scenarioForecast })
  } catch (error) {
    logger.error('Error previewing forecast', { error: error.message })
    res.status(500).json({ error: 'Failed to preview forecast' })
  }
})

export default router
