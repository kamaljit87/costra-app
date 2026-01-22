/**
 * Redis cache utility
 * Day 5: Database & Performance optimizations
 */

import { createClient } from 'redis'
import logger from './logger.js'
import { recordCacheOperation } from './metrics.js'

let redisClient = null
let isConnected = false

/**
 * Initialize Redis client
 */
export const initRedis = async () => {
  try {
    // Only initialize if REDIS_URL is provided
    if (!process.env.REDIS_URL) {
      logger.info('Redis URL not provided - caching disabled')
      return null
    }

    redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis reconnection failed after 10 attempts')
            return new Error('Redis connection failed')
          }
          return Math.min(retries * 100, 3000) // Exponential backoff, max 3s
        },
      },
    })

    redisClient.on('error', (err) => {
      logger.error('Redis client error', { error: err.message })
      isConnected = false
    })

    redisClient.on('connect', () => {
      logger.info('Redis client connecting...')
    })

    redisClient.on('ready', () => {
      logger.info('Redis client ready')
      isConnected = true
    })

    redisClient.on('end', () => {
      logger.warn('Redis client connection ended')
      isConnected = false
    })

    await redisClient.connect()
    return redisClient
  } catch (error) {
    logger.error('Failed to initialize Redis', { error: error.message })
    // Don't throw - allow app to continue without Redis
    return null
  }
}

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} Cached value or null
 */
export const get = async (key) => {
  if (!redisClient || !isConnected) {
    return null
  }

  try {
    const startTime = Date.now()
    const value = await redisClient.get(key)
    const duration = Date.now() - startTime
    
    if (value) {
      logger.debug('Cache hit', { key })
      recordCacheOperation('get', 'hit', duration)
      return JSON.parse(value)
    }
    logger.debug('Cache miss', { key })
    recordCacheOperation('get', 'miss', duration)
    return null
  } catch (error) {
    recordCacheOperation('get', 'error', 0)
    logger.error('Redis get error', { error: error.message, key })
    return null
  }
}

/**
 * Set value in cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<boolean>} Success status
 */
export const set = async (key, value, ttl = 3600) => {
  if (!redisClient || !isConnected) {
    return false
  }

  try {
    const startTime = Date.now()
    const serialized = JSON.stringify(value)
    await redisClient.setEx(key, ttl, serialized)
    const duration = Date.now() - startTime
    logger.debug('Cache set', { key, ttl })
    recordCacheOperation('set', 'success', duration)
    return true
  } catch (error) {
    recordCacheOperation('set', 'error', 0)
    logger.error('Redis set error', { error: error.message, key })
    return false
  }
}

/**
 * Delete value from cache
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} Success status
 */
export const del = async (key) => {
  if (!redisClient || !isConnected) {
    return false
  }

  try {
    await redisClient.del(key)
    logger.debug('Cache delete', { key })
    return true
  } catch (error) {
    logger.error('Redis delete error', { error: error.message, key })
    return false
  }
}

/**
 * Delete multiple keys matching a pattern
 * @param {string} pattern - Key pattern (e.g., 'user:123:*')
 * @returns {Promise<number>} Number of keys deleted
 */
export const delPattern = async (pattern) => {
  if (!redisClient || !isConnected) {
    return 0
  }

  try {
    const keys = await redisClient.keys(pattern)
    if (keys.length === 0) {
      return 0
    }
    const deleted = await redisClient.del(keys)
    logger.debug('Cache delete pattern', { pattern, deleted })
    return deleted
  } catch (error) {
    logger.error('Redis delete pattern error', { error: error.message, pattern })
    return 0
  }
}

/**
 * Clear all cache for a user
 * @param {number} userId - User ID
 * @returns {Promise<number>} Number of keys deleted
 */
export const clearUserCache = async (userId) => {
  return delPattern(`user:${userId}:*`)
}

/**
 * Get cache statistics
 * @returns {Promise<Object>} Cache stats
 */
export const getStats = async () => {
  if (!redisClient || !isConnected) {
    return {
      connected: false,
      hits: 0,
      misses: 0,
    }
  }

  try {
    const info = await redisClient.info('stats')
    // Parse Redis INFO stats
    const hits = info.match(/keyspace_hits:(\d+)/)?.[1] || 0
    const misses = info.match(/keyspace_misses:(\d+)/)?.[1] || 0
    const total = parseInt(hits) + parseInt(misses)
    const hitRate = total > 0 ? (parseInt(hits) / total * 100).toFixed(2) : 0

    return {
      connected: true,
      hits: parseInt(hits),
      misses: parseInt(misses),
      hitRate: `${hitRate}%`,
    }
  } catch (error) {
    logger.error('Redis stats error', { error: error.message })
    return {
      connected: false,
      hits: 0,
      misses: 0,
    }
  }
}

/**
 * Close Redis connection
 */
export const closeRedis = async () => {
  if (redisClient && isConnected) {
    try {
      await redisClient.quit()
      logger.info('Redis connection closed')
    } catch (error) {
      logger.error('Error closing Redis connection', { error: error.message })
    }
  }
}

/**
 * Cache wrapper function
 * @param {string} key - Cache key
 * @param {Function} fn - Function to execute if cache miss
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<any>} Cached or fresh value
 */
export const cached = async (key, fn, ttl = 3600) => {
  // Try to get from cache
  const cached = await get(key)
  if (cached !== null) {
    return cached
  }

  // Cache miss - execute function
  const value = await fn()
  
  // Store in cache
  if (value !== null && value !== undefined) {
    await set(key, value, ttl)
  }

  return value
}

// Cache key generators
export const cacheKeys = {
  costData: (userId, providerId, accountId = null) => 
    `cost_data:${userId}:${providerId}:${accountId || 'all'}`,
  userPreferences: (userId) => `user_prefs:${userId}`,
  exchangeRates: () => 'exchange_rates',
  dashboard: (userId) => `dashboard:${userId}`,
}
