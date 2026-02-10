import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import helmet from 'helmet'
import compression from 'compression'
import * as Sentry from '@sentry/node'
import { initDatabase } from './database.js'
import { initRedis } from './utils/cache.js'
import authRoutes from './routes/auth.js'
import costDataRoutes from './routes/costData.js'
import savingsPlansRoutes from './routes/savingsPlans.js'
import cloudProvidersRoutes from './routes/cloudProviders.js'
import googleAuthRoutes from './routes/googleAuth.js'
import syncRoutes from './routes/sync.js'
import syncPreferencesRoutes from './routes/syncPreferences.js'
import profileRoutes from './routes/profile.js'
import aiRoutes from './routes/ai.js'
import insightsRoutes from './routes/insights.js'
import budgetsRoutes from './routes/budgets.js'
import reportsRoutes from './routes/reports.js'
import notificationsRoutes from './routes/notifications.js'
import billingRoutes from './routes/billing.js'
import emailPreferencesRoutes from './routes/emailPreferences.js'
import complianceRoutes from './routes/compliance.js'
import contactRoutes from './routes/contact.js'
import path from 'path'
import { fileURLToPath } from 'url'
import logger from './utils/logger.js'
import { requestIdMiddleware } from './middleware/requestId.js'
import { errorHandler } from './middleware/errorHandler.js'
import { performanceMonitor } from './middleware/performanceMonitor.js'
import { metricsMiddleware } from './middleware/metrics.js'
import healthRoutes from './routes/health.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env file from server directory
dotenv.config({ path: path.join(__dirname, '.env') })

// Swagger only loaded in non-production environments
let setupSwagger
if (process.env.NODE_ENV !== 'production') {
  setupSwagger = (await import('./swagger.js')).setupSwagger
}

// Initialize Sentry (if DSN is provided)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    integrations: [
      Sentry.expressIntegration(),
    ],
  })
  logger.info('Sentry initialized', { dsn: process.env.SENTRY_DSN.substring(0, 20) + '...' })
} else {
  logger.warn('Sentry DSN not provided - error tracking disabled')
}

// Validate configuration
import { validateConfig } from './utils/config.js'
import { runSecurityAudit } from './utils/securityAudit.js'

// Validate configuration on startup
validateConfig()

// Enforce secure JWT secret in production
if (process.env.NODE_ENV === 'production') {
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret || jwtSecret === 'CHANGE_ME_TO_A_SECURE_RANDOM_SECRET' || jwtSecret.length < 32) {
    logger.error('JWT_SECRET must be set to a strong secret (at least 32 characters) in production')
    process.exit(1)
  }
}

// Run security audit on startup (warnings only, won't exit)
if (process.env.NODE_ENV === 'production') {
  runSecurityAudit()
}

const app = express()
const PORT = process.env.PORT || 3001

// Trust proxy when behind ALB/reverse proxy in production
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1)
}

// Request ID middleware (must be early in the chain)
app.use(requestIdMiddleware)

// Security middleware - Helmet (must be before other middleware)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for React
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'], // Allow data URIs and HTTPS images
      connectSrc: ["'self'", process.env.FRONTEND_URL || 'http://localhost:5173'],
      fontSrc: ["'self'", 'data:', 'https:'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
}))

// Compression middleware (reduce response size)
app.use(compression())

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://192.168.122.4:5173', 'http://192.168.18.29:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  maxAge: 86400, // Cache preflight responses for 24 hours
}))

// Request body parsing with size limits
app.use(express.json({ limit: '10mb' })) // 10MB limit for JSON
app.use(express.urlencoded({ extended: true, limit: '5mb' })) // 5MB limit for form data

// Request timeout configuration (30 seconds)
app.use((req, res, next) => {
  req.setTimeout(30000, () => {
    logger.warn('Request timeout', { requestId: req.requestId, path: req.path })
    res.status(408).json({
      error: 'Request timeout',
      code: 'REQUEST_TIMEOUT',
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    })
  })
  next()
})

// Performance monitoring middleware (must be before routes)
app.use(performanceMonitor)

// Metrics collection middleware (must be before routes)
app.use(metricsMiddleware)

// Initialize database
initDatabase().catch((error) => {
  logger.error('Failed to initialize database', { error: error.message, stack: error.stack })
  process.exit(1)
})

// Initialize Redis cache (optional - app continues if Redis unavailable)
initRedis().catch((error) => {
  logger.warn('Failed to initialize Redis - caching disabled', { error: error.message })
  // Don't exit - app can run without Redis
})

// Initialize alerting system (in production)
if (process.env.NODE_ENV === 'production') {
  import('./utils/alerting.js').then(({ initAlerting }) => {
    initAlerting()
  }).catch((error) => {
    logger.warn('Failed to initialize alerting system', { error: error.message })
  })
}

// Initialize scheduled syncs (in production)
if (process.env.NODE_ENV === 'production') {
  import('./services/syncScheduler.js').then(({ initScheduledSyncs, initCURPolling }) => {
    initScheduledSyncs()
    initCURPolling()
  }).catch((error) => {
    logger.warn('Failed to initialize scheduled syncs', { error: error.message })
  })
}

// Serve static files for uploaded avatars (with path restrictions)
app.use('/api/uploads', (req, res, next) => {
  // Block path traversal attempts
  if (req.path.includes('..') || req.path.includes('%2e')) {
    return res.status(400).json({ error: 'Invalid path' })
  }
  // Only serve image files
  const ext = path.extname(req.path).toLowerCase()
  if (!['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  next()
}, express.static(path.join(__dirname, 'uploads'), {
  dotfiles: 'deny',
  index: false,
}))

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/auth/google', googleAuthRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/cost-data', costDataRoutes)
app.use('/api/savings-plans', savingsPlansRoutes)
app.use('/api/cloud-providers', cloudProvidersRoutes)
app.use('/api/sync', syncRoutes)
app.use('/api/sync', syncPreferencesRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/insights', insightsRoutes)
app.use('/api/budgets', budgetsRoutes)
app.use('/api/reports', reportsRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/billing', billingRoutes)
app.use('/api/email-preferences', emailPreferencesRoutes)
app.use('/api/compliance', complianceRoutes)
app.use('/api/contact', contactRoutes)

// Health check routes
app.use('/api/health', healthRoutes)

// Prometheus metrics endpoint (requires METRICS_TOKEN or authenticated user)
app.get('/metrics', async (req, res) => {
  const metricsToken = process.env.METRICS_TOKEN
  const authToken = req.query.token || req.headers['x-metrics-token']

  if (process.env.NODE_ENV === 'production') {
    if (!metricsToken) {
      return res.status(503).send('# Metrics not configured\n')
    }
    if (authToken !== metricsToken) {
      return res.status(401).send('# Unauthorized\n')
    }
  }

  try {
    const { getMetrics } = await import('./utils/metrics.js')
    const metrics = await getMetrics()
    res.set('Content-Type', 'text/plain; version=0.0.4')
    res.send(metrics)
  } catch (error) {
    logger.error('Error generating metrics', { error: error.message })
    res.status(500).send('# Error generating metrics\n')
  }
})

// Serve frontend static files in production (after all API routes)
if (process.env.NODE_ENV === 'production') {
  const publicPath = path.join(__dirname, 'public')
  app.use(express.static(publicPath))
  
  // Serve index.html for all non-API routes (SPA routing)
  app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'))
  })
}

// Sentry error handler must be before other error handlers
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app)
}

// Centralized error handling middleware (must be last)
app.use(errorHandler)

// Only start server if not in test environment
let server
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`, {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
    })
    // Signal PM2 that the server is ready to accept connections
    if (process.send) {
      process.send('ready')
    }
  })
}

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received - starting graceful shutdown`)

  // Stop accepting new connections
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed')
    })
  }

  try {
    // Close database pool
    const { pool } = await import('./database.js')
    if (pool) {
      await pool.end()
      logger.info('Database pool closed')
    }
  } catch (err) {
    logger.warn('Error closing database pool', { error: err.message })
  }

  try {
    // Close Redis connection
    const { closeRedis } = await import('./utils/cache.js')
    if (closeRedis) {
      await closeRedis()
      logger.info('Redis connection closed')
    }
  } catch (err) {
    logger.warn('Error closing Redis', { error: err.message })
  }

  // Force exit after 10 seconds if graceful shutdown stalls
  setTimeout(() => {
    logger.error('Graceful shutdown timed out - forcing exit')
    process.exit(1)
  }, 10000).unref()

  process.exit(0)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Export app for testing
export default app
