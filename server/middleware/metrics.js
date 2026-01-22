/**
 * Metrics collection middleware
 * Day 7: Monitoring & Health Checks
 */

import { recordHttpRequest, recordError } from '../utils/metrics.js'

/**
 * Middleware to collect HTTP request metrics
 */
export const metricsMiddleware = (req, res, next) => {
  const startTime = Date.now()
  const method = req.method
  const route = req.route?.path || req.path

  // Override res.end to capture response metrics
  const originalEnd = res.end
  res.end = function (chunk, encoding) {
    const duration = Date.now() - startTime
    const status = res.statusCode

    // Record metrics
    recordHttpRequest(method, route, status, duration)

    // Record errors (4xx and 5xx)
    if (status >= 400) {
      const errorType = status >= 500 ? 'ServerError' : 'ClientError'
      recordError(errorType, route)
    }

    // Call original end
    originalEnd.call(this, chunk, encoding)
  }

  next()
}
