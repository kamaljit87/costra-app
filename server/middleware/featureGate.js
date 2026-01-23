/**
 * Feature Gate Middleware
 * Restricts access to features based on subscription plan
 */

import { canAccessFeature, getHistoricalDataLimit, getRequiredPlan } from '../services/subscriptionService.js'
import logger from '../utils/logger.js'

/**
 * Middleware to require a specific feature
 */
export const requireFeature = (featureName) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.userId || req.user?.id
      
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }
      
      const hasAccess = await canAccessFeature(userId, featureName)
      
      if (!hasAccess) {
        const requiredPlan = getRequiredPlan(featureName)
        logger.warn('Feature access denied', { userId, featureName, requiredPlan })
        
        return res.status(403).json({
          error: 'Feature not available',
          message: `This feature requires a ${requiredPlan} subscription`,
          feature: featureName,
          requiredPlan,
          upgradeUrl: '/settings/billing',
        })
      }
      
      next()
    } catch (error) {
      logger.error('Error checking feature access', { 
        userId: req.user?.userId, 
        featureName, 
        error: error.message, 
        stack: error.stack 
      })
      res.status(500).json({ error: 'Failed to verify feature access' })
    }
  }
}

/**
 * Middleware to limit historical data based on subscription
 */
export const limitHistoricalData = async (req, res, next) => {
  try {
    const userId = req.user?.userId || req.user?.id
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    
    const monthsLimit = await getHistoricalDataLimit(userId)
    
    // Attach limit to request for use in routes
    req.subscriptionDataLimit = monthsLimit
    
    // If a date range is provided, validate it
    if (req.query.startDate || req.body.startDate) {
      const startDate = req.query.startDate || req.body.startDate
      const limitDate = new Date()
      limitDate.setMonth(limitDate.getMonth() - monthsLimit)
      limitDate.setHours(0, 0, 0, 0)
      
      const requestedDate = new Date(startDate)
      
      if (requestedDate < limitDate) {
        logger.warn('Historical data limit exceeded', { 
          userId, 
          requestedDate, 
          limitDate, 
          monthsLimit 
        })
        
        // Adjust the start date to the limit
        req.query.startDate = limitDate.toISOString().split('T')[0]
        req.body.startDate = limitDate.toISOString().split('T')[0]
      }
    }
    
    next()
  } catch (error) {
    logger.error('Error applying historical data limit', { 
      userId: req.user?.userId, 
      error: error.message, 
      stack: error.stack 
    })
    // Don't block the request if limit check fails
    req.subscriptionDataLimit = 12 // Default to 12 months
    next()
  }
}
