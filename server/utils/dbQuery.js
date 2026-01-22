/**
 * Database query utilities with timeout and retry logic
 * Day 5: Database & Performance optimizations
 */

import logger from './logger.js'
import { pool } from '../database.js'
import { recordDbQuery, updatePoolMetrics } from './metrics.js'

/**
 * Execute a database query with timeout and retry logic
 * @param {string} queryText - SQL query text
 * @param {Array} params - Query parameters
 * @param {Object} options - Query options
 * @param {number} options.timeout - Query timeout in milliseconds (default: 30000)
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number} options.retryDelay - Initial retry delay in milliseconds (default: 1000)
 * @returns {Promise<Object>} Query result
 */
export const queryWithTimeout = async (queryText, params = [], options = {}) => {
  const {
    timeout = 30000, // 30 seconds default
    maxRetries = 3,
    retryDelay = 1000,
  } = options

  let lastError
  let attempt = 0

  while (attempt < maxRetries) {
    try {
      const startTime = Date.now()
      
      // Create a promise that rejects after timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Query timeout after ${timeout}ms`))
        }, timeout)
      })

      // Execute query with timeout
      const queryPromise = pool.query({
        text: queryText,
        values: params,
        rowMode: undefined, // Return rows as objects
      })

      const result = await Promise.race([queryPromise, timeoutPromise])
      const duration = Date.now() - startTime

      // Record metrics
      const operation = queryText.trim().split(/\s+/)[0].toLowerCase() // Extract operation (SELECT, INSERT, etc.)
      recordDbQuery(operation, 'success', duration)

      // Log slow queries (> 500ms)
      if (duration > 500) {
        logger.warn('Slow database query detected', {
          duration,
          query: queryText.substring(0, 100), // Log first 100 chars
          params: params.length,
        })
      }

      // Log very slow queries (> 2000ms)
      if (duration > 2000) {
        logger.error('Very slow database query', {
          duration,
          query: queryText,
          params,
        })
      }

      return result
    } catch (error) {
      lastError = error
      attempt++

      // Check if error is retryable
      const isRetryable = 
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        error.code === '57P01' || // Admin shutdown
        error.code === '57P02' || // Crash shutdown
        error.code === '57P03' || // Cannot connect now
        error.message?.includes('timeout') ||
        error.message?.includes('connection')

      if (!isRetryable || attempt >= maxRetries) {
        // Record error metrics
        const operation = queryText.trim().split(/\s+/)[0].toLowerCase()
        recordDbQuery(operation, 'error', Date.now() - startTime)
        
        logger.error('Database query failed', {
          error: error.message,
          code: error.code,
          query: queryText.substring(0, 100),
          attempt,
          maxRetries,
        })
        throw error
      }

      // Exponential backoff
      const delay = retryDelay * Math.pow(2, attempt - 1)
      logger.warn('Database query retry', {
        attempt,
        maxRetries,
        delay,
        error: error.message,
        code: error.code,
      })

      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

/**
 * Get a client from the pool with retry logic
 * @param {Object} options - Connection options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number} options.retryDelay - Initial retry delay in milliseconds (default: 1000)
 * @returns {Promise<Object>} Database client
 */
export const getClientWithRetry = async (options = {}) => {
  const {
    maxRetries = 3,
    retryDelay = 1000,
  } = options

  let attempt = 0
  let lastError

  while (attempt < maxRetries) {
    try {
      const client = await pool.connect()
      return client
    } catch (error) {
      lastError = error
      attempt++

      const isRetryable = 
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        error.message?.includes('timeout') ||
        error.message?.includes('connection')

      if (!isRetryable || attempt >= maxRetries) {
        logger.error('Failed to get database client', {
          error: error.message,
          code: error.code,
          attempt,
          maxRetries,
        })
        throw error
      }

      const delay = retryDelay * Math.pow(2, attempt - 1)
      logger.warn('Retrying database client connection', {
        attempt,
        maxRetries,
        delay,
        error: error.message,
      })

      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

/**
 * Get connection pool statistics
 * @returns {Object} Pool statistics
 */
export const getPoolStats = () => {
  const stats = {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  }
  
  // Update metrics
  updatePoolMetrics(stats)
  
  return stats
}
