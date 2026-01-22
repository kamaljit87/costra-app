import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import helmet from 'helmet'
import compression from 'compression'
import * as Sentry from '@sentry/node'
import { initDatabase } from './database.js'
import authRoutes from './routes/auth.js'
import costDataRoutes from './routes/costData.js'
import savingsPlansRoutes from './routes/savingsPlans.js'
import cloudProvidersRoutes from './routes/cloudProviders.js'
import googleAuthRoutes from './routes/googleAuth.js'
import syncRoutes from './routes/sync.js'
import profileRoutes from './routes/profile.js'
import aiRoutes from './routes/ai.js'
import insightsRoutes from './routes/insights.js'
import budgetsRoutes from './routes/budgets.js'
import reportsRoutes from './routes/reports.js'
import notificationsRoutes from './routes/notifications.js'
import path from 'path'
import { fileURLToPath } from 'url'
import logger from './utils/logger.js'
import { requestIdMiddleware } from './middleware/requestId.js'
import { errorHandler } from './middleware/errorHandler.js'
import { apiLimiter } from './middleware/rateLimiter.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env file from server directory
dotenv.config({ path: path.join(__dirname, '.env') })

// Initialize Sentry (if DSN is provided)
// Note: Express integration will be added after app is created
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
    ],
  })
  logger.info('Sentry initialized', { dsn: process.env.SENTRY_DSN.substring(0, 20) + '...' })
} else {
  logger.warn('Sentry DSN not provided - error tracking disabled')
}

// Validate required environment variables and security configuration
import { runSecurityAudit } from './utils/securityAudit.js'

if (!process.env.JWT_SECRET) {
  logger.error('JWT_SECRET is not set in environment variables!')
  logger.error('Please set JWT_SECRET in server/.env file')
  process.exit(1)
}

// Run security audit on startup (warnings only, won't exit)
if (process.env.NODE_ENV === 'production') {
  runSecurityAudit()
}

const app = express()
const PORT = process.env.PORT || 3001

// Sentry request handler must be the first middleware
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.requestHandler())
  app.use(Sentry.Handlers.tracingHandler())
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
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
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

// Apply general API rate limiting to all routes
app.use('/api', apiLimiter)

// Initialize database
initDatabase().catch((error) => {
  logger.error('Failed to initialize database', { error: error.message, stack: error.stack })
  process.exit(1)
})

// Serve static files for uploaded avatars
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')))

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/auth/google', googleAuthRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/cost-data', costDataRoutes)
app.use('/api/savings-plans', savingsPlansRoutes)
app.use('/api/cloud-providers', cloudProvidersRoutes)
app.use('/api/sync', syncRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/insights', insightsRoutes)
app.use('/api/budgets', budgetsRoutes)
app.use('/api/reports', reportsRoutes)
app.use('/api/notifications', notificationsRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Costra API is running',
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
  })
})

// Sentry error handler must be before other error handlers
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler())
}

// Centralized error handling middleware (must be last)
app.use(errorHandler)

app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`, { 
    port: PORT, 
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
  })
})
