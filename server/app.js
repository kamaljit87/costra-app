/**
 * Express application factory
 * Modular bootstrap for middleware, routes, and error handling
 */

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import path from 'path'
import { fileURLToPath } from 'url'
import { requestIdMiddleware } from './middleware/requestId.js'
import { errorHandler } from './middleware/errorHandler.js'
import { performanceMonitor } from './middleware/performanceMonitor.js'
import { metricsMiddleware } from './middleware/metrics.js'
import logger from './utils/logger.js'
import { registerRoutes } from './routes/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Create and configure the Express application
 * @returns {Promise<express.Application>}
 */
export async function createApp() {
  const app = express()
  const isProduction = process.env.NODE_ENV === 'production'

  // Trust proxy when behind ALB/reverse proxy in production
  if (isProduction) {
    app.set('trust proxy', 1)
  }

  // Request ID middleware (must be early in the chain)
  app.use(requestIdMiddleware)

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", process.env.FRONTEND_URL || 'http://localhost:5173'],
        fontSrc: ["'self'", 'data:', 'https:'],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  }))

  app.use(compression())

  // CORS
  app.use(cors({
    origin: isProduction
      ? process.env.FRONTEND_URL
      : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://192.168.122.4:5173', 'http://192.168.18.29:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    maxAge: 86400,
  }))

  // Body parsing
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true, limit: '5mb' }))

  // Request timeout (30 seconds)
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

  app.use(performanceMonitor)
  app.use(metricsMiddleware)

  // Static uploads (with path restrictions)
  app.use('/api/uploads', (req, res, next) => {
    if (req.path.includes('..') || req.path.includes('%2e')) {
      return res.status(400).json({ error: 'Invalid path' })
    }
    const ext = path.extname(req.path).toLowerCase()
    if (!['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    next()
  }, express.static(path.join(__dirname, 'uploads'), { dotfiles: 'deny', index: false }))

  // Register all API routes
  registerRoutes(app)

  // Ensure cost-cache CSV storage directory exists
  const { ensureCostCacheDir } = await import('./services/costCacheCSV.js')
  await ensureCostCacheDir().catch((err) => logger.warn('Cost cache dir init', { error: err.message }))

  // Swagger API docs (non-production)
  if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    const { setupSwagger } = await import('./swagger.js')
    setupSwagger(app)
  }

  // Prometheus metrics
  app.get('/metrics', async (req, res) => {
    const metricsToken = process.env.METRICS_TOKEN
    const authToken = req.query.token || req.headers['x-metrics-token']
    if (isProduction) {
      if (!metricsToken) return res.status(503).send('# Metrics not configured\n')
      if (authToken !== metricsToken) return res.status(401).send('# Unauthorized\n')
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

  // Frontend static (production only) - SPA fallback for non-API routes
  if (isProduction) {
    const publicPath = path.join(__dirname, 'public')
    app.use(express.static(publicPath))
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next()
      res.sendFile(path.join(publicPath, 'index.html'))
    })
  }

  // 404 handler (must be before error handler)
  app.use((req, res, next) => {
    if (!res.headersSent) {
      res.status(404).json({
        error: 'Not found',
        code: 'NOT_FOUND',
        path: req.path,
        requestId: req.requestId,
      })
    } else {
      next()
    }
  })

  // Centralized error handler (must be last)
  app.use(errorHandler)

  return app
}

export default createApp
