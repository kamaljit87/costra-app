import rateLimit from 'express-rate-limit'
import logger from '../utils/logger.js'

/**
 * Rate limiter for authentication endpoints
 * 5 requests per 15 minutes per IP
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts from this IP, please try again after 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
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
 * More lenient limits: 30 requests per hour per user (requires authentication)
 * In development, allow more frequent syncing for testing
 */
export const syncLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'production' ? 20 : 50, // More lenient in development
  message: {
    error: 'Too many sync requests. Please wait before syncing again.',
    code: 'SYNC_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise fall back to IP
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
  // Skip rate limiting for sync endpoints (they have their own limiter)
  skip: (req) => {
    return req.path.startsWith('/api/sync')
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

export default {
  authLimiter,
  syncLimiter,
  apiLimiter,
  aiLimiter,
}
