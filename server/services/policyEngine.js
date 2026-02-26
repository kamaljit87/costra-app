import {
  getEnabledPolicies, createPolicyViolation, createNotification
} from '../database.js'
import { pool } from '../database.js'
import logger from '../utils/logger.js'

/**
 * Evaluate a spend threshold policy.
 * Condition: { metric: "daily_spend", operator: "gt", value: 500, service: "Amazon EC2" }
 */
async function evaluateSpendThreshold(policy, userId) {
  const { conditions } = policy
  const cond = typeof conditions === 'string' ? JSON.parse(conditions) : conditions
  const { value, service, operator = 'gt' } = cond

  let query, params
  if (service) {
    query = `SELECT SUM(cost)::float AS daily_cost
             FROM service_usage_metrics
             WHERE user_id = $1 AND date = CURRENT_DATE - 1
               AND LOWER(service_name) = LOWER($2)
               ${policy.scope_provider_id ? 'AND provider_id = $3' : ''}
               ${policy.scope_account_id ? `AND account_id = $${policy.scope_provider_id ? 4 : 3}` : ''}`
    params = [userId, service]
    if (policy.scope_provider_id) params.push(policy.scope_provider_id)
    if (policy.scope_account_id) params.push(policy.scope_account_id)
  } else {
    query = `SELECT SUM(cost)::float AS daily_cost
             FROM daily_cost_data
             WHERE user_id = $1 AND date = CURRENT_DATE - 1
               ${policy.scope_provider_id ? 'AND provider_id = $2' : ''}
               ${policy.scope_account_id ? `AND account_id = $${policy.scope_provider_id ? 3 : 2}` : ''}`
    params = [userId]
    if (policy.scope_provider_id) params.push(policy.scope_provider_id)
    if (policy.scope_account_id) params.push(policy.scope_account_id)
  }

  const result = await pool.query(query, params)
  const dailyCost = parseFloat(result.rows[0]?.daily_cost) || 0

  const violated = operator === 'gt' ? dailyCost > value
    : operator === 'gte' ? dailyCost >= value
    : operator === 'lt' ? dailyCost < value
    : dailyCost <= value

  if (violated) {
    return {
      violated: true,
      details: {
        metric: 'daily_spend',
        service: service || 'All services',
        actualValue: dailyCost,
        threshold: value,
        operator,
        date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      },
    }
  }
  return { violated: false }
}

/**
 * Evaluate a tag compliance policy.
 * Condition: { metric: "untagged_cost", operator: "gt", value: 50 }
 */
async function evaluateTagCompliance(policy, userId) {
  const cond = typeof policy.conditions === 'string' ? JSON.parse(policy.conditions) : policy.conditions
  const { value } = cond

  const result = await pool.query(
    `SELECT COALESCE(SUM(r.cost), 0)::float AS untagged_cost, COUNT(r.id)::int AS resource_count
     FROM resources r
     WHERE r.user_id = $1
       AND r.cost > 0
       AND NOT EXISTS (SELECT 1 FROM resource_tags rt WHERE rt.resource_id = r.id)
       ${policy.scope_provider_id ? 'AND r.provider_id = $2' : ''}`,
    policy.scope_provider_id ? [userId, policy.scope_provider_id] : [userId]
  )

  const untaggedCost = parseFloat(result.rows[0]?.untagged_cost) || 0

  if (untaggedCost > value) {
    return {
      violated: true,
      details: {
        metric: 'untagged_cost',
        untaggedCost,
        resourceCount: result.rows[0]?.resource_count || 0,
        threshold: value,
      },
    }
  }
  return { violated: false }
}

/**
 * Evaluate a trend alert policy.
 * Condition: { metric: "7day_trend", operator: "gt", value: 20 }
 */
async function evaluateTrendAlert(policy, userId) {
  const cond = typeof policy.conditions === 'string' ? JSON.parse(policy.conditions) : policy.conditions
  const { value } = cond

  const result = await pool.query(
    `WITH periods AS (
       SELECT
         SUM(CASE WHEN date >= CURRENT_DATE - 7 THEN cost ELSE 0 END)::float AS current_week,
         SUM(CASE WHEN date >= CURRENT_DATE - 14 AND date < CURRENT_DATE - 7 THEN cost ELSE 0 END)::float AS previous_week
       FROM daily_cost_data
       WHERE user_id = $1 AND date >= CURRENT_DATE - 14
         ${policy.scope_provider_id ? 'AND provider_id = $2' : ''}
         ${policy.scope_account_id ? `AND account_id = $${policy.scope_provider_id ? 3 : 2}` : ''}
     )
     SELECT current_week, previous_week,
       CASE WHEN previous_week > 0 THEN ((current_week - previous_week) / previous_week * 100) ELSE 0 END AS change_percent
     FROM periods`,
    [userId, ...(policy.scope_provider_id ? [policy.scope_provider_id] : []), ...(policy.scope_account_id ? [policy.scope_account_id] : [])]
  )

  const changePercent = parseFloat(result.rows[0]?.change_percent) || 0

  if (changePercent > value) {
    return {
      violated: true,
      details: {
        metric: '7day_trend',
        currentWeek: parseFloat(result.rows[0]?.current_week) || 0,
        previousWeek: parseFloat(result.rows[0]?.previous_week) || 0,
        changePercent,
        threshold: value,
      },
    }
  }
  return { violated: false }
}

/**
 * Evaluate a budget forecast policy.
 * Condition: { metric: "forecast_vs_budget", operator: "gt", value: 100 }
 */
async function evaluateBudgetForecast(policy, userId) {
  const cond = typeof policy.conditions === 'string' ? JSON.parse(policy.conditions) : policy.conditions
  const { value } = cond

  const result = await pool.query(
    `SELECT b.budget_name, b.budget_amount, cd.forecast_cost
     FROM budgets b
     INNER JOIN cost_data cd ON b.user_id = cd.user_id
       AND (b.provider_id IS NULL OR b.provider_id = cd.provider_id)
       AND cd.month = EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
       AND cd.year = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
     WHERE b.user_id = $1 AND b.status = 'active'`,
    [userId]
  )

  for (const row of result.rows) {
    const budgetAmount = parseFloat(row.budget_amount) || 0
    const forecastCost = parseFloat(row.forecast_cost) || 0
    if (budgetAmount > 0) {
      const forecastPercent = (forecastCost / budgetAmount) * 100
      if (forecastPercent > value) {
        return {
          violated: true,
          details: {
            metric: 'forecast_vs_budget',
            budgetName: row.budget_name,
            budgetAmount,
            forecastCost,
            forecastPercent,
            threshold: value,
          },
        }
      }
    }
  }
  return { violated: false }
}

/**
 * Evaluate all enabled policies for a user.
 * Called after sync completes.
 *
 * @param {number} userId
 * @param {number|null} orgId
 * @returns {Array} Created violations
 */
export async function evaluatePolicies(userId, orgId = null) {
  const violations = []

  try {
    const policies = await getEnabledPolicies(userId, orgId)

    for (const policy of policies) {
      let result = { violated: false }

      switch (policy.policy_type) {
        case 'spend_threshold':
          result = await evaluateSpendThreshold(policy, userId)
          break
        case 'tag_compliance':
          result = await evaluateTagCompliance(policy, userId)
          break
        case 'trend_alert':
          result = await evaluateTrendAlert(policy, userId)
          break
        case 'budget_forecast':
          result = await evaluateBudgetForecast(policy, userId)
          break
      }

      if (result.violated) {
        const severity = policy.policy_type === 'budget_forecast' ? 'high'
          : policy.policy_type === 'spend_threshold' ? 'high'
          : 'medium'

        const violation = await createPolicyViolation({
          policyId: policy.id,
          userId,
          organizationId: orgId,
          violationType: policy.policy_type,
          violationDetails: result.details,
          severity,
        })

        // Create notification
        await createNotification(userId, {
          type: 'warning',
          title: `Policy violation: ${policy.name}`,
          message: formatViolationMessage(policy, result.details),
          link: '/policies',
          linkText: 'View policy details',
          metadata: { policyId: policy.id, violationId: violation.id },
        })

        violations.push(violation)
        logger.info('Policy violation detected', {
          userId, policyId: policy.id, policyName: policy.name, type: policy.policy_type,
        })
      }
    }
  } catch (error) {
    logger.error('Error evaluating policies', { userId, error: error.message })
  }

  return violations
}

function formatViolationMessage(policy, details) {
  switch (policy.policy_type) {
    case 'spend_threshold':
      return `${details.service} daily spend ($${details.actualValue.toFixed(2)}) exceeded threshold ($${details.threshold.toFixed(2)}).`
    case 'tag_compliance':
      return `${details.resourceCount} untagged resources costing $${details.untaggedCost.toFixed(2)}/month exceed the $${details.threshold.toFixed(2)} threshold.`
    case 'trend_alert':
      return `7-day spend increased ${details.changePercent.toFixed(1)}% week-over-week, exceeding the ${details.threshold}% threshold.`
    case 'budget_forecast':
      return `Forecast for "${details.budgetName}" ($${details.forecastCost.toFixed(2)}) is at ${details.forecastPercent.toFixed(0)}% of budget ($${details.budgetAmount.toFixed(2)}).`
    default:
      return `Policy "${policy.name}" was violated.`
  }
}
