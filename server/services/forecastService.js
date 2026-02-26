import { callClaude } from '../utils/aiClient.js'
import { pool } from '../database.js'
import { updateForecastScenario } from '../database.js'
import logger from '../utils/logger.js'

/**
 * Calculate a multi-month forecast from daily cost data using exponential smoothing.
 *
 * @param {Array<{date: string, cost: number}>} dailyData - Historical daily costs (sorted oldest first)
 * @param {number} months - Number of months to forecast (1-12)
 * @returns {Array<{month: string, forecast: number, confidenceLow: number, confidenceHigh: number}>}
 */
export function calculateMultiMonthForecast(dailyData, months = 6) {
  if (!dailyData || dailyData.length < 14) {
    return []
  }

  // Calculate monthly aggregates from daily data
  const monthlyTotals = {}
  for (const d of dailyData) {
    const key = d.date.substring(0, 7) // YYYY-MM
    if (!monthlyTotals[key]) monthlyTotals[key] = 0
    monthlyTotals[key] += parseFloat(d.cost) || 0
  }

  const sortedMonths = Object.entries(monthlyTotals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total }))

  if (sortedMonths.length < 2) {
    // Not enough monthly data — use daily average
    const avgDailyCost = dailyData.reduce((sum, d) => sum + (parseFloat(d.cost) || 0), 0) / dailyData.length
    const monthlyAvg = avgDailyCost * 30
    return generateForecastMonths(months, monthlyAvg, 0, monthlyAvg * 0.15)
  }

  // Simple exponential smoothing for monthly totals
  const alpha = 0.4
  let level = sortedMonths[0].total
  let trend = sortedMonths.length >= 2
    ? (sortedMonths[sortedMonths.length - 1].total - sortedMonths[0].total) / (sortedMonths.length - 1)
    : 0

  for (let i = 1; i < sortedMonths.length; i++) {
    const prevLevel = level
    level = alpha * sortedMonths[i].total + (1 - alpha) * (level + trend)
    trend = 0.3 * (level - prevLevel) + 0.7 * trend
  }

  // Calculate residual std dev for confidence interval
  const residuals = sortedMonths.map((m, i) => {
    if (i === 0) return 0
    const predicted = sortedMonths[0].total + trend * i
    return m.total - predicted
  })
  const residualStdDev = Math.sqrt(
    residuals.reduce((sum, r) => sum + r * r, 0) / Math.max(residuals.length - 1, 1)
  )

  return generateForecastMonths(months, level, trend, residualStdDev)
}

/**
 * Generate forecast month entries with widening confidence intervals.
 */
function generateForecastMonths(months, level, trend, stdDev) {
  const results = []
  const now = new Date()

  for (let i = 1; i <= months; i++) {
    const forecastDate = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const monthStr = forecastDate.toISOString().substring(0, 7)
    const forecast = Math.max(0, level + trend * i)
    // Confidence interval widens with time
    const margin = stdDev * Math.sqrt(i) * 1.96
    results.push({
      month: monthStr,
      forecast: Math.round(forecast * 100) / 100,
      confidenceLow: Math.max(0, Math.round((forecast - margin) * 100) / 100),
      confidenceHigh: Math.round((forecast + margin) * 100) / 100,
    })
  }

  return results
}

/**
 * Apply scenario adjustments to a base forecast.
 *
 * @param {Array} baseForecast - Base forecast from calculateMultiMonthForecast
 * @param {Array} adjustments - Scenario adjustments
 * @returns {Array} Adjusted forecast
 */
export function applyScenarioAdjustments(baseForecast, adjustments) {
  if (!adjustments || adjustments.length === 0) return baseForecast

  return baseForecast.map((entry, i) => {
    let adjusted = entry.forecast
    let low = entry.confidenceLow
    let high = entry.confidenceHigh

    for (const adj of adjustments) {
      switch (adj.type) {
        case 'growth_rate': {
          // Apply compound monthly growth
          const monthlyRate = (adj.value || 0) / 100
          const multiplier = Math.pow(1 + monthlyRate, i + 1)
          adjusted *= multiplier
          low *= multiplier
          high *= multiplier
          break
        }
        case 'service_change': {
          if (adj.action === 'add' && adj.monthly_cost) {
            adjusted += adj.monthly_cost
            low += adj.monthly_cost
            high += adj.monthly_cost
          } else if (adj.action === 'remove' && adj.monthly_cost) {
            adjusted -= adj.monthly_cost
            low -= adj.monthly_cost
            high -= adj.monthly_cost
          }
          break
        }
        case 'pricing_change': {
          const changeMultiplier = 1 + (adj.change_percent || 0) / 100
          adjusted *= changeMultiplier
          low *= changeMultiplier
          high *= changeMultiplier
          break
        }
      }
    }

    return {
      ...entry,
      forecast: Math.max(0, Math.round(adjusted * 100) / 100),
      confidenceLow: Math.max(0, Math.round(low * 100) / 100),
      confidenceHigh: Math.max(0, Math.round(high * 100) / 100),
    }
  })
}

/**
 * Generate an AI narrative comparing base vs scenario forecast.
 */
export async function generateForecastNarrative(baseForecast, scenarioForecast, adjustments, scenarioName) {
  const baseTotal = baseForecast.reduce((sum, m) => sum + m.forecast, 0)
  const scenarioTotal = scenarioForecast.reduce((sum, m) => sum + m.forecast, 0)
  const difference = scenarioTotal - baseTotal
  const diffPercent = baseTotal > 0 ? (difference / baseTotal) * 100 : 0

  const adjustmentDescriptions = adjustments.map(a => {
    if (a.type === 'growth_rate') return `${a.value}% monthly growth rate`
    if (a.type === 'service_change') return `${a.action} ${a.service}${a.monthly_cost ? ` ($${a.monthly_cost}/mo)` : ''}`
    if (a.type === 'pricing_change') return `${a.change_percent > 0 ? '+' : ''}${a.change_percent}% pricing change for ${a.service}`
    return JSON.stringify(a)
  }).join(', ')

  const prompt = `You are a FinOps analyst. Compare two cloud cost forecasts and provide a concise 2-3 sentence summary.

Scenario: "${scenarioName}"
Adjustments: ${adjustmentDescriptions}

Base forecast (${baseForecast.length} months): $${baseTotal.toFixed(2)} total
- First month: $${baseForecast[0]?.forecast.toFixed(2)}
- Last month: $${baseForecast[baseForecast.length - 1]?.forecast.toFixed(2)}

Scenario forecast: $${scenarioTotal.toFixed(2)} total (${diffPercent > 0 ? '+' : ''}${diffPercent.toFixed(1)}%)
- First month: $${scenarioForecast[0]?.forecast.toFixed(2)}
- Last month: $${scenarioForecast[scenarioForecast.length - 1]?.forecast.toFixed(2)}

Provide a clear, actionable summary. No markdown.`

  try {
    const narrative = await callClaude(
      'You are a concise FinOps cost analyst. Respond with 2-3 sentences only.',
      prompt,
      256
    )
    return narrative
  } catch (error) {
    logger.error('Error generating forecast narrative', { error: error.message })
    return `Under the "${scenarioName}" scenario, projected ${baseForecast.length}-month spend is $${scenarioTotal.toFixed(2)}, ${difference >= 0 ? 'an increase' : 'a decrease'} of $${Math.abs(difference).toFixed(2)} (${Math.abs(diffPercent).toFixed(1)}%) compared to the base forecast of $${baseTotal.toFixed(2)}.`
  }
}

/**
 * Compute and persist a scenario's forecast data and narrative.
 */
export async function computeScenario(scenario, userId) {
  try {
    // Fetch daily cost data for this user
    const result = await pool.query(
      `SELECT date, SUM(cost)::float AS cost
       FROM daily_cost_data
       WHERE user_id = $1 AND date >= CURRENT_DATE - 365
       GROUP BY date ORDER BY date ASC`,
      [userId]
    )
    const dailyData = result.rows.map(r => ({ date: r.date, cost: parseFloat(r.cost) || 0 }))

    const forecastMonths = scenario.forecast_months || 6
    const adjustments = typeof scenario.adjustments === 'string'
      ? JSON.parse(scenario.adjustments) : (scenario.adjustments || [])

    const baseForecast = calculateMultiMonthForecast(dailyData, forecastMonths)
    const scenarioForecast = applyScenarioAdjustments(baseForecast, adjustments)

    const narrative = await generateForecastNarrative(
      baseForecast, scenarioForecast, adjustments, scenario.name
    )

    const currentMonthCost = dailyData.length > 0
      ? dailyData.filter(d => d.date.substring(0, 7) === new Date().toISOString().substring(0, 7))
          .reduce((sum, d) => sum + d.cost, 0)
      : 0

    const updated = await updateForecastScenario(scenario.id, userId, {
      forecastData: { base: baseForecast, scenario: scenarioForecast },
      aiNarrative: narrative,
    })

    return { baseForecast, scenarioForecast, narrative, scenario: updated }
  } catch (error) {
    logger.error('Error computing scenario', { scenarioId: scenario.id, error: error.message })
    throw error
  }
}
