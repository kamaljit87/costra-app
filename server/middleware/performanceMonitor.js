/**
 * Performance monitoring middleware
 * Day 5: Database & Performance optimizations
 */

import logger from '../utils/logger.js'

/**
 * Middleware to log response times and identify slow endpoints
 */
export const performanceMonitor = (req, res, next) => {
  const startTime = Date.now()
  const requestId = req.requestId

  // Override res.end to capture response time
  const originalEnd = res.end
  res.end = function (chunk, encoding) {
    const duration = Date.now() - startTime
    const { method, path, route } = req
    const statusCode = res.statusCode
    const endpoint = route?.path || path

    // Record metric for analytics
    recordMetric(endpoint, duration)

    // Log slow requests (> 500ms)
    if (duration > 500) {
      logger.warn('Slow request detected', {
        requestId,
        method,
        path: endpoint,
        statusCode,
        duration,
        userId: req.user?.id,
      })
    }

    // Log very slow requests (> 2000ms)
    if (duration > 2000) {
      logger.error('Very slow request', {
        requestId,
        method,
        path: endpoint,
        statusCode,
        duration,
        userId: req.user?.id,
        query: req.query,
        body: req.body ? Object.keys(req.body).length : 0,
      })
    }

    // Log all requests in debug mode
    if (process.env.LOG_LEVEL === 'debug') {
      logger.debug('Request completed', {
        requestId,
        method,
        path: endpoint,
        statusCode,
        duration,
      })
    }

    // Call original end
    originalEnd.call(this, chunk, encoding)
  }

  next()
}

/**
 * Get performance metrics for an endpoint
 * @param {string} endpoint - Endpoint path
 * @param {number} windowMs - Time window in milliseconds (default: 60000 = 1 minute)
 * @returns {Object} Performance metrics
 */
const metrics = new Map()

export const getEndpointMetrics = (endpoint, windowMs = 60000) => {
  const now = Date.now()
  const endpointMetrics = metrics.get(endpoint) || []

  // Filter metrics within time window
  const recentMetrics = endpointMetrics.filter(
    (m) => now - m.timestamp < windowMs
  )

  if (recentMetrics.length === 0) {
    return {
      count: 0,
      avgDuration: 0,
      minDuration: 0,
      maxDuration: 0,
      p95: 0,
      p99: 0,
    }
  }

  const durations = recentMetrics.map((m) => m.duration).sort((a, b) => a - b)
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length
  const p95Index = Math.floor(durations.length * 0.95)
  const p99Index = Math.floor(durations.length * 0.99)

  return {
    count: recentMetrics.length,
    avgDuration: Math.round(avgDuration),
    minDuration: durations[0],
    maxDuration: durations[durations.length - 1],
    p95: durations[p95Index] || 0,
    p99: durations[p99Index] || 0,
  }
}

/**
 * Record endpoint performance metric
 * @param {string} endpoint - Endpoint path
 * @param {number} duration - Request duration in milliseconds
 */
export const recordMetric = (endpoint, duration) => {
  if (!metrics.has(endpoint)) {
    metrics.set(endpoint, [])
  }

  const endpointMetrics = metrics.get(endpoint)
  endpointMetrics.push({
    timestamp: Date.now(),
    duration,
  })

  // Keep only last 1000 metrics per endpoint
  if (endpointMetrics.length > 1000) {
    endpointMetrics.shift()
  }
}
