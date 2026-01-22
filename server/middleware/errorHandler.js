import logger from '../utils/logger.js'
import * as Sentry from '@sentry/node'

/**
 * Centralized error handling middleware
 * Standardizes error responses and logs errors with full context
 */
export const errorHandler = (err, req, res, next) => {
  const requestId = req.requestId || 'unknown'
  const userId = req.user?.id || req.user?.userId || null
  
  // Extract error information
  const errorMessage = err.message || 'Internal server error'
  const errorStack = err.stack
  const statusCode = err.statusCode || err.status || 500
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR'
  
  // Log error with full context
  logger.error(errorMessage, {
    requestId,
    userId,
    method: req.method,
    path: req.path,
    statusCode,
    errorCode,
    stack: errorStack,
    body: req.body,
    query: req.query,
    params: req.params,
  })
  
  // Send error to Sentry (if configured)
  if (process.env.SENTRY_DSN) {
    Sentry.withScope((scope) => {
      scope.setTag('requestId', requestId)
      if (userId) {
        scope.setUser({ id: userId })
      }
      scope.setContext('request', {
        method: req.method,
        path: req.path,
        query: req.query,
        params: req.params,
      })
      scope.setLevel('error')
      Sentry.captureException(err)
    })
  }
  
  // Map database errors to user-friendly messages
  let userFriendlyMessage = errorMessage
  let mappedStatusCode = statusCode
  
  if (err.code === '23505') {
    // PostgreSQL unique constraint violation
    userFriendlyMessage = 'A record with this information already exists'
    mappedStatusCode = 400
  } else if (err.code === '23503') {
    // PostgreSQL foreign key constraint violation
    userFriendlyMessage = 'Cannot perform this operation due to related records'
    mappedStatusCode = 400
  } else if (err.code === '23502') {
    // PostgreSQL not null constraint violation
    userFriendlyMessage = 'Required fields are missing'
    mappedStatusCode = 400
  } else if (err.code === '42P01') {
    // PostgreSQL undefined table
    userFriendlyMessage = 'Database configuration error'
    mappedStatusCode = 500
  } else if (err.code === 'ECONNREFUSED') {
    // Database connection refused
    userFriendlyMessage = 'Database connection failed. Please try again later.'
    mappedStatusCode = 503
  } else if (err.name === 'ValidationError') {
    // Express validator error
    userFriendlyMessage = errorMessage
    mappedStatusCode = 400
  } else if (err.name === 'JsonWebTokenError') {
    // JWT error
    userFriendlyMessage = 'Invalid authentication token'
    mappedStatusCode = 401
  } else if (err.name === 'TokenExpiredError') {
    // JWT expired
    userFriendlyMessage = 'Authentication token has expired'
    mappedStatusCode = 401
  } else if (err.name === 'UnauthorizedError') {
    // Unauthorized
    userFriendlyMessage = 'Unauthorized access'
    mappedStatusCode = 401
  } else if (statusCode >= 500) {
    // Server errors - don't expose internal details in production
    userFriendlyMessage = process.env.NODE_ENV === 'production'
      ? 'An internal server error occurred'
      : errorMessage
  }
  
  // Standardized error response format
  const errorResponse = {
    error: userFriendlyMessage,
    code: errorCode,
    requestId,
    timestamp: new Date().toISOString(),
  }
  
  // Include stack trace in development
  if (process.env.NODE_ENV === 'development' && errorStack) {
    errorResponse.stack = errorStack
  }
  
  // Include additional details in development
  if (process.env.NODE_ENV === 'development' && err.details) {
    errorResponse.details = err.details
  }
  
  res.status(mappedStatusCode).json(errorResponse)
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors and pass to error handler
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

/**
 * Create custom error with status code
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = null) {
    super(message)
    this.statusCode = statusCode
    this.status = statusCode
    this.code = code || `HTTP_${statusCode}`
    this.isOperational = true
    
    Error.captureStackTrace(this, this.constructor)
  }
}

export default errorHandler
