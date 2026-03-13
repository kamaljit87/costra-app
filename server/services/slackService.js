/**
 * Slack Integration Service
 * Sends messages, daily digests, and alerts to Slack channels
 */

import logger from '../utils/logger.js'
import { getSlackIntegrationsForAlerts, pool } from '../database.js'

export const sendSlackMessage = async (webhookUrl, payload) => {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      throw new Error(`Slack webhook returned ${response.status}`)
    }
    return true
  } catch (error) {
    logger.error('Failed to send Slack message', { error: error.message })
    return false
  }
}

export const sendSlackTestMessage = async (webhookUrl) => {
  return sendSlackMessage(webhookUrl, {
    text: ':white_check_mark: *Costdoq Connected!*\nSlack integration is working. You will receive cost alerts and digests here.',
  })
}

export const sendDailyDigest = async (integration) => {
  try {
    const userId = integration.user_id
    const result = await pool.query(
      `SELECT COALESCE(SUM(cost), 0)::float AS today_cost
       FROM daily_cost_data WHERE user_id = $1 AND date = CURRENT_DATE`,
      [userId]
    )
    const yesterdayResult = await pool.query(
      `SELECT COALESCE(SUM(cost), 0)::float AS yesterday_cost
       FROM daily_cost_data WHERE user_id = $1 AND date = CURRENT_DATE - 1`,
      [userId]
    )
    const todayCost = result.rows[0]?.today_cost || 0
    const yesterdayCost = yesterdayResult.rows[0]?.yesterday_cost || 0
    const change = yesterdayCost > 0 ? ((todayCost - yesterdayCost) / yesterdayCost * 100).toFixed(1) : '0'
    const arrow = todayCost >= yesterdayCost ? ':chart_with_upwards_trend:' : ':chart_with_downwards_trend:'

    await sendSlackMessage(integration.webhook_url, {
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: ':bar_chart: Costdoq Daily Cost Digest' } },
        { type: 'section', fields: [
          { type: 'mrkdwn', text: `*Today's Spend:*\n$${todayCost.toFixed(2)}` },
          { type: 'mrkdwn', text: `*Yesterday:*\n$${yesterdayCost.toFixed(2)}` },
        ]},
        { type: 'section', text: { type: 'mrkdwn', text: `${arrow} *${change}%* change from yesterday` } },
      ],
    })
  } catch (error) {
    logger.error('Failed to send daily digest', { userId: integration.user_id, error: error.message })
  }
}

export const sendAnomalyAlert = async (integration, anomaly) => {
  const severity = anomaly.severity === 'critical' ? ':rotating_light:' : anomaly.severity === 'high' ? ':warning:' : ':information_source:'
  await sendSlackMessage(integration.webhook_url, {
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: `${severity} Cost Anomaly Detected` } },
      { type: 'section', fields: [
        { type: 'mrkdwn', text: `*Service:*\n${anomaly.service_name || 'Multiple'}` },
        { type: 'mrkdwn', text: `*Severity:*\n${anomaly.severity}` },
      ]},
      { type: 'section', fields: [
        { type: 'mrkdwn', text: `*Expected:*\n$${parseFloat(anomaly.expected_cost).toFixed(2)}` },
        { type: 'mrkdwn', text: `*Actual:*\n$${parseFloat(anomaly.actual_cost).toFixed(2)} (+${parseFloat(anomaly.variance_percent).toFixed(1)}%)` },
      ]},
      ...(anomaly.root_cause ? [{ type: 'section', text: { type: 'mrkdwn', text: `*Root Cause:*\n${anomaly.root_cause.substring(0, 300)}` } }] : []),
    ],
  })
}

export const sendBudgetAlert = async (integration, budget) => {
  await sendSlackMessage(integration.webhook_url, {
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: ':moneybag: Budget Alert' } },
      { type: 'section', fields: [
        { type: 'mrkdwn', text: `*Budget:*\n${budget.name}` },
        { type: 'mrkdwn', text: `*Spent:*\n$${parseFloat(budget.spent).toFixed(2)} / $${parseFloat(budget.limit).toFixed(2)}` },
      ]},
      { type: 'section', text: { type: 'mrkdwn', text: `:warning: Budget is at *${parseFloat(budget.percent).toFixed(0)}%*` } },
    ],
  })
}

export const runDailyDigests = async () => {
  try {
    const integrations = await getSlackIntegrationsForAlerts()
    const digestIntegrations = integrations.filter(i => i.daily_digest)
    logger.info('Running Slack daily digests', { count: digestIntegrations.length })
    for (const integration of digestIntegrations) {
      await sendDailyDigest(integration)
    }
  } catch (error) {
    logger.error('Slack daily digest job failed', { error: error.message })
  }
}
