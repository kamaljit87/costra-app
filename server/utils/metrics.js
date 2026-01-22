/**
 * Prometheus metrics collection
 * Day 7: Monitoring & Health Checks
 */

import { Registry, Counter, Histogram, Gauge } from 'prom-client'
import logger from './logger.js'

// Create a registry for metrics
export const register = new Registry()

// Add default metrics (CPU, memory, etc.)
// Note: prom-client doesn't have default metrics in v14+, so we'll create our own

/**
 * HTTP Request Metrics
 */
export const httpRequestCounter = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
})

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
})

/**
 * Database Metrics
 */
export const dbQueryCounter = new Counter({
  name: 'db_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'status'],
  registers: [register],
})

export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
})

export const dbConnectionPoolSize = new Gauge({
  name: 'db_connection_pool_size',
  help: 'Database connection pool size',
  labelNames: ['state'], // total, idle, waiting
  registers: [register],
})

/**
 * Cache Metrics
 */
export const cacheOperations = new Counter({
  name: 'cache_operations_total',
  help: 'Total number of cache operations',
  labelNames: ['operation', 'result'], // operation: get, set, del; result: hit, miss, error
  registers: [register],
})

export const cacheOperationDuration = new Histogram({
  name: 'cache_operation_duration_seconds',
  help: 'Duration of cache operations in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1],
  registers: [register],
})

/**
 * Error Metrics
 */
export const errorCounter = new Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'endpoint'],
  registers: [register],
})

/**
 * Business Metrics
 */
export const activeUsers = new Gauge({
  name: 'active_users_total',
  help: 'Number of active users',
  registers: [register],
})

export const costDataSyncs = new Counter({
  name: 'cost_data_syncs_total',
  help: 'Total number of cost data synchronizations',
  labelNames: ['provider', 'status'],
  registers: [register],
})

/**
 * System Metrics
 */
export const memoryUsage = new Gauge({
  name: 'nodejs_memory_usage_bytes',
  help: 'Node.js memory usage in bytes',
  labelNames: ['type'], // heapUsed, heapTotal, rss, external
  registers: [register],
})

/**
 * Update system metrics periodically
 */
export const updateSystemMetrics = () => {
  const memUsage = process.memoryUsage()
  memoryUsage.set({ type: 'heapUsed' }, memUsage.heapUsed)
  memoryUsage.set({ type: 'heapTotal' }, memUsage.heapTotal)
  memoryUsage.set({ type: 'rss' }, memUsage.rss)
  memoryUsage.set({ type: 'external' }, memUsage.external)
}

// Update system metrics every 5 seconds
if (typeof setInterval !== 'undefined') {
  setInterval(updateSystemMetrics, 5000)
  updateSystemMetrics() // Initial update
}

/**
 * Record HTTP request metrics
 * @param {string} method - HTTP method
 * @param {string} route - Route path
 * @param {number} status - HTTP status code
 * @param {number} duration - Request duration in milliseconds
 */
export const recordHttpRequest = (method, route, status, duration) => {
  const durationSeconds = duration / 1000
  
  httpRequestCounter.inc({ method, route, status })
  httpRequestDuration.observe({ method, route, status }, durationSeconds)
}

/**
 * Record database query metrics
 * @param {string} operation - Operation name (e.g., 'select', 'insert')
 * @param {string} status - Query status ('success', 'error')
 * @param {number} duration - Query duration in milliseconds
 */
export const recordDbQuery = (operation, status, duration) => {
  const durationSeconds = duration / 1000
  
  dbQueryCounter.inc({ operation, status })
  dbQueryDuration.observe({ operation }, durationSeconds)
}

/**
 * Record cache operation metrics
 * @param {string} operation - Operation type ('get', 'set', 'del')
 * @param {string} result - Operation result ('hit', 'miss', 'error')
 * @param {number} duration - Operation duration in milliseconds
 */
export const recordCacheOperation = (operation, result, duration) => {
  const durationSeconds = duration / 1000
  
  cacheOperations.inc({ operation, result })
  cacheOperationDuration.observe({ operation }, durationSeconds)
}

/**
 * Record error metrics
 * @param {string} type - Error type (e.g., 'ValidationError', 'DatabaseError')
 * @param {string} endpoint - Endpoint where error occurred
 */
export const recordError = (type, endpoint) => {
  errorCounter.inc({ type, endpoint })
}

/**
 * Update connection pool metrics
 * @param {Object} stats - Pool statistics
 * @param {number} stats.totalCount - Total connections
 * @param {number} stats.idleCount - Idle connections
 * @param {number} stats.waitingCount - Waiting requests
 */
export const updatePoolMetrics = (stats) => {
  dbConnectionPoolSize.set({ state: 'total' }, stats.totalCount)
  dbConnectionPoolSize.set({ state: 'idle' }, stats.idleCount)
  dbConnectionPoolSize.set({ state: 'waiting' }, stats.waitingCount)
}

/**
 * Get metrics in Prometheus format
 * @returns {Promise<string>} Metrics in Prometheus text format
 */
export const getMetrics = async () => {
  return register.metrics()
}
