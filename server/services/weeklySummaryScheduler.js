/**
 * Weekly summary email scheduler
 * Sends weekly cost summary to Pro users who have email_weekly_summary enabled
 */

import cron from 'node-cron'
import logger from '../utils/logger.js'
import { pool, getWeeklyCostSummary } from '../database.js'
import { sendWeeklySummary, getUserEmailPreferences } from './emailService.js'
import { canAccessFeature } from './subscriptionService.js'

export const runScheduledWeeklySummaries = async () => {
  try {
    logger.info('Running scheduled weekly summary emails')
    const client = await pool.connect()
    let userIds = []
    try {
      const result = await client.query(
        `SELECT up.user_id
         FROM user_preferences up
         INNER JOIN subscriptions s ON s.user_id = up.user_id
         WHERE up.email_weekly_summary = true
           AND s.status = 'active'
           AND s.plan_type = 'pro'`
      )
      userIds = result.rows.map((r) => r.user_id)
    } finally {
      client.release()
    }

    logger.info('Weekly summary: users opted in', { count: userIds.length })
    for (const userId of userIds) {
      try {
        const hasAccess = await canAccessFeature(userId, 'email_alerts')
        if (!hasAccess) continue
        const prefs = await getUserEmailPreferences(userId)
        if (!prefs.emailWeeklySummary) continue
        const summary = await getWeeklyCostSummary(userId)
        await sendWeeklySummary(userId, {
          totalCost: summary.totalCost,
          topServices: summary.topServices,
          costChange: summary.costChange ?? undefined,
        })
      } catch (err) {
        logger.error('Weekly summary send failed for user', { userId, error: err.message })
      }
    }
    logger.info('Scheduled weekly summaries completed')
  } catch (error) {
    logger.error('Weekly summary job failed', { error: error.message, stack: error.stack })
  }
}

export const initWeeklySummarySchedule = () => {
  cron.schedule('0 9 * * 1', async () => {
    await runScheduledWeeklySummaries()
  })
  logger.info('Weekly summary cron initialized (Mondays at 9:00 UTC)')
}
