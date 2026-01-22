/**
 * Health check endpoint
 * Day 7: Monitoring & Health Checks
 */

import express from 'express'
import { pool } from '../database.js'
import { getStats as getCacheStats } from '../utils/cache.js'
import { getPoolStats } from '../utils/dbQuery.js'
import logger from '../utils/logger.js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const router = express.Router()

// Get application version (from package.json)
let appVersion = '1.0.0'
try {
  const packageJson = JSON.parse(
    readFileSync(join(__dirname, '../package.json'), 'utf-8')
  )
  appVersion = packageJson.version || '1.0.0'
} catch (error) {
  logger.warn('Could not read package.json for version', { error: error.message })
}

// Track server start time for uptime calculation
const serverStartTime = Date.now()

/**
 * Check database connectivity
 */
const checkDatabase = async () => {
  try {
    const client = await pool.connect()
    const startTime = Date.now()
    await client.query('SELECT 1')
    const duration = Date.now() - startTime
    client.release()
    
    return {
      status: 'healthy',
      responseTime: duration,
      message: 'Database connection successful',
    }
  } catch (error) {
    logger.error('Database health check failed', { error: error.message })
    return {
      status: 'unhealthy',
      responseTime: null,
      message: `Database connection failed: ${error.message}`,
    }
  }
}

/**
 * Check Redis connectivity
 */
const checkRedis = async () => {
  try {
    const { getStats } = await import('../utils/cache.js')
    const stats = await getStats()
    
    if (stats.connected) {
      return {
        status: 'healthy',
        message: 'Redis connection successful',
        stats: {
          hits: stats.hits,
          misses: stats.misses,
          hitRate: stats.hitRate,
        },
      }
    } else {
      return {
        status: 'degraded',
        message: 'Redis not configured or unavailable',
      }
    }
  } catch (error) {
    logger.warn('Redis health check failed', { error: error.message })
    return {
      status: 'degraded',
      message: `Redis check failed: ${error.message}`,
    }
  }
}

/**
 * Check external service availability (basic check)
 */
const checkExternalServices = async () => {
  const services = {
    aws: { status: 'unknown', message: 'Not checked' },
    exchangeRates: { status: 'unknown', message: 'Not checked' },
  }

  // Note: In a production environment, you might want to make actual API calls
  // For now, we'll just return that services are available if configured
  if (process.env.AWS_ACCESS_KEY_ID) {
    services.aws = { status: 'available', message: 'AWS credentials configured' }
  } else {
    services.aws = { status: 'not_configured', message: 'AWS credentials not configured' }
  }

  // Exchange rates service check (if you have an API endpoint)
  if (process.env.EXCHANGE_RATE_API_URL) {
    services.exchangeRates = { status: 'available', message: 'Exchange rate API configured' }
  } else {
    services.exchangeRates = { status: 'not_configured', message: 'Exchange rate API not configured' }
  }

  return services
}

/**
 * GET /api/health
 * Comprehensive health check endpoint
 */
router.get('/', async (req, res) => {
  const healthCheckStart = Date.now()
  
  try {
    // Run all health checks in parallel
    const [database, redis, externalServices] = await Promise.allSettled([
      checkDatabase(),
      checkRedis(),
      checkExternalServices(),
    ])

    const dbStatus = database.status === 'fulfilled' ? database.value : {
      status: 'unhealthy',
      message: 'Database check failed',
    }

    const redisStatus = redis.status === 'fulfilled' ? redis.value : {
      status: 'degraded',
      message: 'Redis check failed',
    }

    const extServices = externalServices.status === 'fulfilled' ? externalServices.value : {}

    // Determine overall health status
    let overallStatus = 'healthy'
    if (dbStatus.status === 'unhealthy') {
      overallStatus = 'unhealthy'
    } else if (redisStatus.status === 'unhealthy' || dbStatus.status === 'degraded') {
      overallStatus = 'degraded'
    }

    // Get connection pool stats
    const poolStats = getPoolStats()

    // Calculate uptime
    const uptime = Date.now() - serverStartTime
    const uptimeSeconds = Math.floor(uptime / 1000)
    const uptimeMinutes = Math.floor(uptimeSeconds / 60)
    const uptimeHours = Math.floor(uptimeMinutes / 60)
    const uptimeDays = Math.floor(uptimeHours / 24)

    const healthCheckDuration = Date.now() - healthCheckStart

    const healthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: appVersion,
      environment: process.env.NODE_ENV || 'development',
      uptime: {
        milliseconds: uptime,
        seconds: uptimeSeconds,
        minutes: uptimeMinutes,
        hours: uptimeHours,
        days: uptimeDays,
        human: `${uptimeDays}d ${uptimeHours % 24}h ${uptimeMinutes % 60}m ${uptimeSeconds % 60}s`,
      },
      checks: {
        database: {
          ...dbStatus,
          pool: {
            total: poolStats.totalCount,
            idle: poolStats.idleCount,
            waiting: poolStats.waitingCount,
          },
        },
        redis: redisStatus,
        externalServices,
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024),
        },
      },
      requestId: req.requestId,
      healthCheckDuration,
    }

    // Return appropriate HTTP status code
    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503
    res.status(statusCode).json(healthResponse)
  } catch (error) {
    logger.error('Health check error', { error: error.message, stack: error.stack })
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      message: 'Health check failed',
      error: error.message,
      requestId: req.requestId,
    })
  }
})

/**
 * GET /api/health/liveness
 * Simple liveness probe (for Kubernetes)
 */
router.get('/liveness', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  })
})

/**
 * GET /api/health/readiness
 * Readiness probe (checks database)
 */
router.get('/readiness', async (req, res) => {
  try {
    const dbCheck = await checkDatabase()
    if (dbCheck.status === 'healthy') {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      })
    } else {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        reason: dbCheck.message,
      })
    }
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: error.message,
    })
  }
})

export default router
