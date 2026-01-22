/**
 * Alerting system
 * Day 7: Monitoring & Health Checks
 */

import logger from './logger.js'
import { errorCounter, httpRequestDuration } from './metrics.js'

/**
 * Alert thresholds
 */
const ALERT_THRESHOLDS = {
  ERROR_RATE: 10, // errors per minute
  HIGH_LATENCY_P95: 1000, // milliseconds
  HIGH_LATENCY_P99: 2000, // milliseconds
  DATABASE_ERRORS: 5, // database errors per minute
  CACHE_ERRORS: 10, // cache errors per minute
}

/**
 * Alert state (to prevent spam)
 */
const alertState = {
  lastErrorAlert: 0,
  lastLatencyAlert: 0,
  lastDatabaseAlert: 0,
  lastCacheAlert: 0,
}

/**
 * Alert cooldown period (5 minutes)
 */
const ALERT_COOLDOWN = 5 * 60 * 1000

/**
 * Send alert (placeholder - integrate with your alerting system)
 * @param {string} type - Alert type
 * @param {string} message - Alert message
 * @param {Object} metadata - Additional metadata
 */
const sendAlert = async (type, message, metadata = {}) => {
  // In production, integrate with:
  // - Email (SendGrid, AWS SES)
  // - Slack webhook
  // - PagerDuty
  // - Custom webhook
  
  logger.error('ALERT', {
    type,
    message,
    ...metadata,
    timestamp: new Date().toISOString(),
  })

  // Example: Send to Slack webhook
  if (process.env.SLACK_WEBHOOK_URL) {
    try {
      const response = await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 *${type}*: ${message}`,
          attachments: [
            {
              color: 'danger',
              fields: Object.entries(metadata).map(([key, value]) => ({
                title: key,
                value: String(value),
                short: true,
              })),
            },
          ],
        }),
      })
      
      if (!response.ok) {
        logger.warn('Failed to send Slack alert', { status: response.status })
      }
    } catch (error) {
      logger.error('Error sending Slack alert', { error: error.message })
    }
  }

  // Example: Send email alert
  if (process.env.ALERT_EMAIL) {
    // Integrate with your email service
    logger.info('Email alert would be sent', { to: process.env.ALERT_EMAIL, type, message })
  }
}

/**
 * Check error rate and alert if threshold exceeded
 */
export const checkErrorRate = async () => {
  const now = Date.now()
  
  // Get error count from metrics (this is a simplified check)
  // In production, you'd query Prometheus or your metrics store
  const errorCount = errorCounter.hashMap['errors_total']?.value || 0
  
  if (errorCount > ALERT_THRESHOLDS.ERROR_RATE && now - alertState.lastErrorAlert > ALERT_COOLDOWN) {
    alertState.lastErrorAlert = now
    await sendAlert(
      'HighErrorRate',
      `Error rate exceeded threshold: ${errorCount} errors/minute`,
      {
        threshold: ALERT_THRESHOLDS.ERROR_RATE,
        current: errorCount,
      }
    )
  }
}

/**
 * Check latency and alert if threshold exceeded
 */
export const checkLatency = async () => {
  const now = Date.now()
  
  // In production, query Prometheus for p95/p99 latency
  // For now, we'll use a simplified check
  // You would query: http_request_duration_seconds{quantile="0.95"}
  
  // Placeholder: Check if we should alert
  // In real implementation, query metrics store
  const shouldAlert = false // Replace with actual metric query
  
  if (shouldAlert && now - alertState.lastLatencyAlert > ALERT_COOLDOWN) {
    alertState.lastLatencyAlert = now
    await sendAlert(
      'HighLatency',
      'P95 latency exceeded threshold',
      {
        threshold: ALERT_THRESHOLDS.HIGH_LATENCY_P95,
      }
    )
  }
}

/**
 * Check database health and alert on failures
 */
export const checkDatabaseHealth = async (errorCount) => {
  const now = Date.now()
  
  if (errorCount > ALERT_THRESHOLDS.DATABASE_ERRORS && now - alertState.lastDatabaseAlert > ALERT_COOLDOWN) {
    alertState.lastDatabaseAlert = now
    await sendAlert(
      'DatabaseErrors',
      `Database error rate exceeded: ${errorCount} errors/minute`,
      {
        threshold: ALERT_THRESHOLDS.DATABASE_ERRORS,
        current: errorCount,
      }
    )
  }
}

/**
 * Check cache health and alert on failures
 */
export const checkCacheHealth = async (errorCount) => {
  const now = Date.now()
  
  if (errorCount > ALERT_THRESHOLDS.CACHE_ERRORS && now - alertState.lastCacheAlert > ALERT_COOLDOWN) {
    alertState.lastCacheAlert = now
    await sendAlert(
      'CacheErrors',
      `Cache error rate exceeded: ${errorCount} errors/minute`,
      {
        threshold: ALERT_THRESHOLDS.CACHE_ERRORS,
        current: errorCount,
      }
    )
  }
}

/**
 * Initialize alerting checks (run periodically)
 */
export const initAlerting = () => {
  // Run health checks every minute
  setInterval(async () => {
    await checkErrorRate()
    await checkLatency()
  }, 60000) // 1 minute

  logger.info('Alerting system initialized')
}

/**
 * Manual alert trigger (for testing)
 */
export const triggerAlert = async (type, message, metadata) => {
  await sendAlert(type, message, metadata)
}
