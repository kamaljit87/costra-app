import { randomUUID } from 'crypto'

/**
 * Middleware to add a unique request ID to each request
 * This helps track requests across the entire lifecycle
 */
export const requestIdMiddleware = (req, res, next) => {
  // Generate or use existing request ID
  const requestId = req.headers['x-request-id'] || randomUUID()
  
  // Attach to request object
  req.requestId = requestId
  
  // Add to response headers
  res.setHeader('X-Request-ID', requestId)
  
  // Continue to next middleware
  next()
}

export default requestIdMiddleware
