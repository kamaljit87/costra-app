/**
 * Costra backend server
 * Entry point - loads config, initializes services, starts HTTP server
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import * as Sentry from '@sentry/node'
import { initDatabase } from './database.js'
import { initRedis } from './utils/cache.js'
import { createApp } from './app.js'
import { validateConfig } from './utils/config.js'
import { runSecurityAudit } from './utils/securityAudit.js'
import logger from './utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env
dotenv.config({ path: path.join(__dirname, '.env') })

const isTest = process.env.NODE_ENV === 'test'
const isProduction = process.env.NODE_ENV === 'production'

// Initialize Sentry (skip in test)
if (!isTest && process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: isProduction ? 0.1 : 1.0,
    integrations: [Sentry.expressIntegration()],
  })
  logger.info('Sentry initialized')
} else if (!isTest) {
  logger.warn('Sentry DSN not provided - error tracking disabled')
}

// Validate configuration (skip strict validation in test)
if (!isTest) {
  validateConfig()
}

// Production security checks
if (isProduction) {
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret || jwtSecret === 'CHANGE_ME_TO_A_SECURE_RANDOM_SECRET' || jwtSecret.length < 32) {
    logger.error('JWT_SECRET must be set to a strong secret (at least 32 characters) in production')
    process.exit(1)
  }
  runSecurityAudit()
}

// Initialize database
initDatabase().catch((error) => {
  logger.error('Failed to initialize database', { error: error.message, stack: error.stack })
  if (!isTest) process.exit(1)
})

// Initialize Redis (optional)
initRedis().catch((error) => {
  logger.warn('Failed to initialize Redis - caching disabled', { error: error.message })
})

// Start background services (production only)
if (isProduction) {
  import('./utils/alerting.js').then(({ initAlerting }) => initAlerting()).catch((e) => logger.warn('Alerting init failed', { error: e.message }))
  import('./services/syncScheduler.js').then(({ initScheduledSyncs, initCURPolling, initOptimizationSchedule }) => {
    initScheduledSyncs()
    initCURPolling()
    initOptimizationSchedule()
  }).catch((e) => logger.warn('Sync scheduler init failed', { error: e.message }))
}

// Create Express app
const app = await createApp()

// Add Sentry error handler if configured
if (!isTest && process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app)
}

// Start HTTP server (skip in test)
let server
const PORT = process.env.PORT || 3001

if (!isTest) {
  server = app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`, {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
    })
    if (process.send) process.send('ready')
  })

  server.on('error', (err) => {
    logger.error('Server error', { error: err.message, stack: err.stack })
    process.exit(1)
  })
}

// Graceful shutdown
const shutdown = async (signal) => {
  logger.info(`${signal} received - starting graceful shutdown`)

  const shutdownTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timed out - forcing exit')
    process.exit(1)
  }, 10000)
  shutdownTimeout.unref()

  if (server) {
    await new Promise((resolve) => {
      server.close(() => {
        logger.info('HTTP server closed')
        resolve()
      })
    })
  }

  try {
    const { pool } = await import('./database.js')
    if (pool) {
      await pool.end()
      logger.info('Database pool closed')
    }
  } catch (err) {
    logger.warn('Error closing database pool', { error: err.message })
  }

  try {
    const { closeRedis } = await import('./utils/cache.js')
    if (closeRedis) {
      await closeRedis()
      logger.info('Redis connection closed')
    }
  } catch (err) {
    logger.warn('Error closing Redis', { error: err.message })
  }

  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

export default app
