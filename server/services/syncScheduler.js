/**
 * Sync Scheduler Service
 * Handles scheduled daily syncs for Starter & Pro users
 */

import cron from 'node-cron'
import logger from '../utils/logger.js'
import { pool } from '../database.js'
import { canAccessFeature } from './subscriptionService.js'

/**
 * Run scheduled syncs for all users with auto-sync enabled
 */
export const runScheduledSyncs = async () => {
  try {
    logger.info('Running scheduled daily syncs')
    
    // Get all users with auto-sync enabled
    const client = await pool.connect()
    try {
      const result = await client.query(
        `SELECT DISTINCT cpc.user_id, cpc.auto_sync_time
         FROM cloud_provider_credentials cpc
         INNER JOIN subscriptions s ON cpc.user_id = s.user_id
         WHERE cpc.auto_sync_enabled = true
           AND cpc.is_active = true
           AND s.status = 'active'
           AND s.plan_type IN ('starter', 'pro')`
      )
      
      const users = result.rows
      logger.info('Found users with auto-sync enabled', { count: users.length })
      
      // For each user, trigger sync
      for (const user of users) {
        try {
          // Check if it's time to sync for this user
          const now = new Date()
          const syncTime = user.auto_sync_time || '02:00:00'
          const [hours, minutes] = syncTime.split(':').map(Number)
          
          // Simple check: if current hour matches sync hour (within 1 hour window)
          // In production, you'd want more sophisticated scheduling per user
          const currentHour = now.getHours()
          if (Math.abs(currentHour - hours) <= 1) {
            await triggerUserSync(user.user_id)
          }
        } catch (error) {
          logger.error('Error syncing user', { userId: user.user_id, error: error.message })
        }
      }
    } finally {
      client.release()
    }
    
    logger.info('Scheduled syncs completed')
  } catch (error) {
    logger.error('Error running scheduled syncs', { error: error.message, stack: error.stack })
  }
}

/**
 * Trigger sync for a specific user
 */
const triggerUserSync = async (userId) => {
  try {
    // Check if user has access to scheduled sync
    const hasAccess = await canAccessFeature(userId, 'scheduled_sync')
    if (!hasAccess) {
      logger.debug('Scheduled sync denied - user does not have access', { userId })
      return
    }
    
    // Call sync API endpoint internally
    // In production, you might want to use a job queue (Bull, Agenda, etc.)
    const syncUrl = `${process.env.API_URL || 'http://localhost:3001'}/api/sync`
    
    // For now, we'll just log - in production, use a proper job queue
    logger.info('Scheduled sync triggered', { userId })
    
    // TODO: Implement actual sync trigger using job queue or internal API call
    // This is a placeholder - in production, use Bull, Agenda, or similar
  } catch (error) {
    logger.error('Error triggering user sync', { userId, error: error.message })
  }
}

/**
 * Initialize scheduled sync cron job
 */
export const initScheduledSyncs = () => {
  // Run daily at 2 AM UTC (adjustable)
  cron.schedule('0 2 * * *', async () => {
    await runScheduledSyncs()
  })

  logger.info('Scheduled sync cron job initialized (runs daily at 2 AM UTC)')
}

/**
 * Initialize CUR polling cron job
 * Polls every 6 hours for new CUR data across all accounts with CUR enabled
 */
export const initCURPolling = () => {
  // Run every 6 hours at minute 30 (offset from sync to avoid overlap)
  cron.schedule('30 */6 * * *', async () => {
    try {
      logger.info('Starting CUR polling cycle')
      const { pollCURDataForAllAccounts } = await import('./curService.js')
      await pollCURDataForAllAccounts()
      logger.info('CUR polling cycle completed')
    } catch (error) {
      logger.error('CUR polling cycle failed', { error: error.message, stack: error.stack })
    }
  })

  logger.info('CUR polling cron job initialized (runs every 6 hours at :30)')
}

/**
 * Initialize daily optimization analysis cron job
 * Runs at 4 AM UTC (after syncs at 2 AM and CUR polling at :30)
 */
export const initOptimizationSchedule = () => {
  cron.schedule('0 4 * * *', async () => {
    try {
      logger.info('Starting daily optimization analysis')
      const { runOptimizationForUser } = await import('./optimizationEngine.js')

      const result = await pool.query(
        `SELECT DISTINCT user_id FROM cloud_provider_credentials WHERE is_active = true`
      )

      for (const row of result.rows) {
        try {
          await runOptimizationForUser(row.user_id)
        } catch (err) {
          logger.error('Daily optimization failed for user', { userId: row.user_id, error: err.message })
        }
      }

      logger.info('Daily optimization analysis completed', { userCount: result.rows.length })
    } catch (error) {
      logger.error('Daily optimization cycle failed', { error: error.message, stack: error.stack })
    }
  })

  logger.info('Optimization analysis cron initialized (daily at 4 AM UTC)')
}

/**
 * Initialize AWS billing/health alert polling
 * Fetches AWS status (e.g. billing issues) and notifies users with AWS connected
 */
export const initAwsHealthPolling = () => {
  cron.schedule('0 */2 * * *', async () => {
    try {
      logger.info('Starting AWS billing health check')
      const { fetchAndNotifyAwsBillingIssues } = await import('./awsHealthService.js')
      const result = await fetchAndNotifyAwsBillingIssues()
      logger.info('AWS billing health check completed', result)
    } catch (error) {
      logger.error('AWS billing health check failed', { error: error.message, stack: error.stack })
    }
  })

  logger.info('AWS health polling cron initialized (runs every 2 hours)')
}
