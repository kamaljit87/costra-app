import rateLimit from 'express-rate-limit'
import logger from '../utils/logger.js'

/**
 * Rate limiter for authentication endpoints
 * Relaxed limits: 100 attempts per 15 min in production, 1000 in development
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // 100 auth attempts per 15min in production
  message: {
    error: 'Too many authentication attempts from this IP, please try again after 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded for auth endpoint', {
      requestId: req.requestId,
      ip: req.ip,
      path: req.path,
    })
    res.status(429).json({
      error: 'Too many authentication attempts from this IP, please try again after 15 minutes.',
      code: 'RATE_LIMIT_EXCEEDED',
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    })
  },
})

/**
 * Rate limiter for sync endpoints
 * Lenient limits so normal sync usage (manual + retries) does not hit "too many requests"
 */
export const syncLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'production' ? 120 : 500, // 120 syncs/hour in production, 500 in dev
  message: {
    error: 'Too many sync requests. Please wait before syncing again.',
    code: 'SYNC_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.userId || req.user?.id || req.ip
  },
  handler: (req, res) => {
    logger.warn('Rate limit exceeded for sync endpoint', {
      requestId: req.requestId,
      userId: req.user?.userId || req.user?.id || 'N/A',
      ip: req.ip,
      path: req.path,
    })
    res.status(429).json({
      error: 'Too many sync requests. Please wait before syncing again.',
      code: 'SYNC_RATE_LIMIT_EXCEEDED',
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    })
  },
})

/**
 * Rate limiter for general API endpoints
 * More lenient in development, stricter in production
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 500, // More lenient in development
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip for auth/sync (have their own limiters) and for authenticated requests (no "too many requests" after sign-in)
  skip: (req) => {
    const p = (req.path || '').toLowerCase()
    const url = (req.originalUrl || '').toLowerCase()
    const isAuthPath = p.startsWith('/sync') || p.startsWith('/auth') || url.includes('/api/auth') || url.includes('/api/sync')
    const hasAuthHeader = req.headers.authorization && String(req.headers.authorization).startsWith('Bearer ')
    return isAuthPath || hasAuthHeader
  },
  handler: (req, res) => {
    logger.warn('Rate limit exceeded for API endpoint', {
      requestId: req.requestId,
      ip: req.ip,
      path: req.path,
    })
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    })
  },
})

/**
 * Rate limiter for AI endpoints (more restrictive due to cost)
 * 20 requests per hour per user
 */
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each user to 20 AI requests per hour
  message: {
    error: 'Too many AI requests. Please wait before making another request.',
    code: 'AI_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise fall back to IP
    return req.user?.userId || req.user?.id || req.ip
  },
  handler: (req, res) => {
    logger.warn('Rate limit exceeded for AI endpoint', {
      requestId: req.requestId,
      userId: req.user?.userId || req.user?.id || 'N/A',
      ip: req.ip,
      path: req.path,
    })
    res.status(429).json({
      error: 'Too many AI requests. Please wait before making another request.',
      code: 'AI_RATE_LIMIT_EXCEEDED',
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    })
  },
})

/**
 * Rate limiter for AWS connection verification endpoints
 * Restricts STS AssumeRole calls to prevent abuse
 */
export const verifyConnectionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 10 : 50,
  message: {
    error: 'Too many verification attempts. Please wait before trying again.',
    code: 'VERIFY_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.userId || req.user?.id || req.ip
  },
  handler: (req, res) => {
    logger.warn('Rate limit exceeded for verify endpoint', {
      requestId: req.requestId,
      userId: req.user?.userId || req.user?.id || 'N/A',
      ip: req.ip,
      path: req.path,
    })
    res.status(429).json({
      error: 'Too many verification attempts. Please wait before trying again.',
      code: 'VERIFY_RATE_LIMIT_EXCEEDED',
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    })
  },
})

export default {
  authLimiter,
  syncLimiter,
  apiLimiter,
  aiLimiter,
  verifyConnectionLimiter,
}
