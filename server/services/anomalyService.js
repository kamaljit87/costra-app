import { detectAnomaliesHW } from '../utils/holtWinters.js'
import { callClaude } from '../utils/aiClient.js'
import {
  createAnomalyEvent, getRecentAnomalyForService,
  createNotification
} from '../database.js'
import { pool } from '../database.js'
import logger from '../utils/logger.js'

/**
 * Get daily costs per service for the last N days.
 */
async function getServiceDailyCosts(userId, providerId, accountId, days = 45) {
  const result = await pool.query(
    `SELECT service_name, date, SUM(cost)::float AS cost
     FROM service_usage_metrics
     WHERE user_id = $1 AND provider_id = $2
       ${accountId ? 'AND account_id = $4' : ''}
       AND date >= CURRENT_DATE - $3::integer
     GROUP BY service_name, date
     ORDER BY service_name, date ASC`,
    accountId ? [userId, providerId, days, accountId] : [userId, providerId, days]
  )
  // Group by service
  const services = {}
  for (const row of result.rows) {
    if (!services[row.service_name]) services[row.service_name] = []
    services[row.service_name].push({ date: row.date, cost: parseFloat(row.cost) || 0 })
  }
  return services
}

/**
 * Get aggregate daily costs for the last N days.
 */
async function getAggregateDailyCosts(userId, providerId, accountId, days = 45) {
  const result = await pool.query(
    `SELECT date, SUM(cost)::float AS cost
     FROM daily_cost_data
     WHERE user_id = $1
       ${providerId ? 'AND provider_id = $2' : ''}
       ${accountId ? `AND account_id = $${providerId ? 3 : 2}` : ''}
       AND date >= CURRENT_DATE - $${providerId ? (accountId ? 4 : 3) : (accountId ? 3 : 2)}::integer
     GROUP BY date ORDER BY date ASC`,
    [userId, ...(providerId ? [providerId] : []), ...(accountId ? [accountId] : []), days]
  )
  return result.rows.map(r => ({ date: r.date, cost: parseFloat(r.cost) || 0 }))
}

/**
 * Generate root cause analysis for an anomaly using Claude.
 */
async function generateRootCause(anomalyContext) {
  const { serviceName, date, actualCost, expectedCost, variance, contributingServices } = anomalyContext

  const prompt = `You are a FinOps analyst. A cost anomaly was detected. Provide a concise 2-3 sentence root cause analysis.

Service: ${serviceName || 'Overall spend'}
Date: ${date}
Expected cost: $${expectedCost.toFixed(2)}/day
Actual cost: $${actualCost.toFixed(2)}/day
Variance: ${variance > 0 ? '+' : ''}${variance.toFixed(1)}%

${contributingServices && contributingServices.length > 0 ? `Top contributing services:\n${contributingServices.map(s => `- ${s.name}: $${s.cost.toFixed(2)} (${s.change > 0 ? '+' : ''}${s.change.toFixed(1)}% vs expected)`).join('\n')}` : ''}

Provide a brief, actionable root cause analysis. Focus on likely causes (scaling events, new deployments, configuration changes, data transfer spikes). Do not use markdown formatting.`

  try {
    const response = await callClaude(
      'You are a concise FinOps cost analyst. Respond with 2-3 sentences only.',
      prompt,
      256
    )
    return response
  } catch (error) {
    logger.error('Error generating anomaly root cause', { error: error.message })
    return `Cost ${variance > 0 ? 'increased' : 'decreased'} by ${Math.abs(variance).toFixed(1)}% from the expected baseline of $${expectedCost.toFixed(2)}/day to $${actualCost.toFixed(2)}/day.`
  }
}

/**
 * Calculate severity based on variance and cost magnitude.
 */
function calculateSeverity(variancePercent, actualCost) {
  const absVariance = Math.abs(variancePercent)
  if (absVariance > 100 || actualCost > 1000) return 'critical'
  if (absVariance > 50 || actualCost > 500) return 'high'
  if (absVariance > 25) return 'medium'
  return 'low'
}

/**
 * Run anomaly detection for a user across all providers/accounts.
 * Called after sync completes.
 *
 * @param {number} userId
 * @param {number|null} orgId
 * @param {string|null} providerId - If set, only check this provider
 * @param {number|null} accountId - If set, only check this account
 * @returns {Array} Detected anomaly events
 */
export async function detectAnomalies(userId, orgId = null, providerId = null, accountId = null) {
  const detectedEvents = []

  try {
    // Get service-level daily costs
    const serviceCosts = await getServiceDailyCosts(userId, providerId, accountId, 45)

    for (const [serviceName, dailyData] of Object.entries(serviceCosts)) {
      if (dailyData.length < 10) continue // Need minimum data

      const values = dailyData.map(d => d.cost)
      const dates = dailyData.map(d => d.date)

      const { anomalies } = detectAnomaliesHW(values, { sensitivityMultiplier: 2.5 })

      for (const anomaly of anomalies) {
        const date = dates[anomaly.index]

        // Skip if already detected for this service/date
        const existing = await getRecentAnomalyForService(userId, providerId, serviceName, date)
        if (existing) continue

        // Get contributing services context for root cause
        const contributingServices = []
        for (const [svcName, svcData] of Object.entries(serviceCosts)) {
          if (svcName === serviceName) continue
          const matchingDay = svcData.find(d => d.date === date)
          const prevDay = svcData.find(d => {
            const dDate = new Date(d.date)
            const targetDate = new Date(date)
            targetDate.setDate(targetDate.getDate() - 1)
            return dDate.toISOString().split('T')[0] === targetDate.toISOString().split('T')[0]
          })
          if (matchingDay && prevDay && prevDay.cost > 0) {
            const change = ((matchingDay.cost - prevDay.cost) / prevDay.cost) * 100
            if (Math.abs(change) > 10) {
              contributingServices.push({ name: svcName, cost: matchingDay.cost, change })
            }
          }
        }
        contributingServices.sort((a, b) => Math.abs(b.change) - Math.abs(a.change))

        const severity = calculateSeverity(anomaly.variance, anomaly.value)

        // Generate root cause via Claude
        const rootCause = await generateRootCause({
          serviceName,
          date,
          actualCost: anomaly.value,
          expectedCost: anomaly.expected,
          variance: anomaly.variance,
          contributingServices: contributingServices.slice(0, 5),
        })

        const event = await createAnomalyEvent({
          userId,
          organizationId: orgId,
          accountId,
          providerId,
          serviceName,
          detectedDate: date,
          anomalyType: anomaly.type,
          severity,
          expectedCost: anomaly.expected,
          actualCost: anomaly.value,
          variancePercent: anomaly.variance,
          rootCause,
          contributingServices: contributingServices.slice(0, 10),
        })

        // Create in-app notification
        await createNotification(userId, {
          type: 'anomaly',
          title: `Cost ${anomaly.type} detected: ${serviceName}`,
          message: rootCause,
          link: '/anomalies',
          linkText: 'View anomaly details',
          metadata: { anomalyEventId: event.id, severity, variance: anomaly.variance },
        })

        detectedEvents.push(event)
        logger.info('Anomaly detected', {
          userId, serviceName, date, severity, variance: anomaly.variance,
        })
      }
    }
  } catch (error) {
    logger.error('Error in anomaly detection', { userId, error: error.message })
  }

  return detectedEvents
}
