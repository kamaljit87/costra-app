/**
 * Subscription Service
 * Manages user subscriptions, trials, and feature access
 */

import { pool } from '../database.js'
export { pool } // Re-export for compatibility
import logger from '../utils/logger.js'

// Feature definitions for each plan
const FEATURE_DEFINITIONS = {
  trial: {
    historicalDataMonths: 12,
    features: [
      'connect_providers',
      'cost_vs_usage',
      'cost_summary',
      'untagged_resources',
      'anomaly_detection',
      'auto_sync',
      'custom_date_ranges',
      'monthly_summaries',
    ],
    restrictedFeatures: ['csv_export', 'email_alerts', 'scheduled_sync', 'unit_economics'],
  },
  starter: {
    historicalDataMonths: 6,
    features: [
      'connect_providers',
      'cost_vs_usage',
      'cost_summary',
      'untagged_resources',
      'anomaly_detection',
      'auto_sync',
      'custom_date_ranges',
      'monthly_summaries',
      'scheduled_sync',
    ],
    restrictedFeatures: ['csv_export', 'email_alerts', 'unit_economics'],
  },
  pro: {
    historicalDataMonths: 12,
    features: [
      'connect_providers',
      'cost_vs_usage',
      'cost_summary',
      'untagged_resources',
      'anomaly_detection',
      'auto_sync',
      'custom_date_ranges',
      'monthly_summaries',
      'scheduled_sync',
      'csv_export',
      'email_alerts',
      'unit_economics',
    ],
    restrictedFeatures: [],
  },
}

/**
 * Get user's current subscription
 */
export const getUserSubscription = async (userId) => {
  const client = await pool.connect()
  try {
    const result = await client.query(
      `SELECT * FROM subscriptions WHERE user_id = $1`,
      [userId]
    )
    
    if (result.rows.length === 0) {
      // No subscription found - create trial
      return await createTrialSubscription(userId)
    }
    
    return result.rows[0]
  } catch (error) {
    logger.error('Error getting user subscription', { userId, error: error.message, stack: error.stack })
    throw error
  } finally {
    client.release()
  }
}

/**
 * Create a 7-day trial subscription for a new user
 */
export const createTrialSubscription = async (userId) => {
  const client = await pool.connect()
  try {
    const trialStart = new Date()
    const trialEnd = new Date(trialStart)
    trialEnd.setDate(trialEnd.getDate() + 7) // 7-day trial
    
    const result = await client.query(
      `INSERT INTO subscriptions (
        user_id, plan_type, status, trial_start_date, trial_end_date, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO NOTHING
      RETURNING *`,
      [userId, 'trial', 'active', trialStart, trialEnd]
    )
    
    if (result.rows.length === 0) {
      // Subscription already exists, fetch it
      return await getUserSubscription(userId)
    }
    
    logger.info('Created trial subscription', { userId, trialEnd })
    return result.rows[0]
  } catch (error) {
    logger.error('Error creating trial subscription', { userId, error: error.message, stack: error.stack })
    throw error
  } finally {
    client.release()
  }
}

/**
 * Upgrade subscription to paid plan
 */
export const upgradeSubscription = async (userId, planType, stripeData = {}) => {
  const client = await pool.connect()
  try {
    const subscription = await getUserSubscription(userId)
    const now = new Date()
    
    // Determine billing period from price ID or stripeData
    let billingPeriod = stripeData.billingPeriod || 'monthly'
    if (stripeData.priceId) {
      // Check if price ID contains 'annual' or matches annual price IDs
      const annualPriceIds = [
        process.env.STRIPE_STARTER_PRICE_ID_ANNUAL,
        process.env.STRIPE_PRO_PRICE_ID_ANNUAL,
      ]
      if (annualPriceIds.includes(stripeData.priceId)) {
        billingPeriod = 'annual'
      }
    }
    
    // If upgrading from trial, set subscription dates
    const subscriptionStart = subscription.plan_type === 'trial' ? now : subscription.subscription_start_date || now
    const subscriptionEnd = new Date(subscriptionStart)
    
    // Set subscription end date based on billing period
    if (billingPeriod === 'annual') {
      subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1)
    } else {
      subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1)
    }
    
    const result = await client.query(
      `UPDATE subscriptions 
       SET plan_type = $1,
           status = 'active',
           subscription_start_date = COALESCE($2, subscription_start_date, CURRENT_TIMESTAMP),
           subscription_end_date = COALESCE($3, subscription_end_date),
           stripe_customer_id = COALESCE($4, stripe_customer_id),
           stripe_subscription_id = COALESCE($5, stripe_subscription_id),
           stripe_price_id = COALESCE($6, stripe_price_id),
           billing_period = COALESCE($7, billing_period, 'monthly'),
           currency = COALESCE($8, currency, 'USD'),
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $9
       RETURNING *`,
      [
        planType,
        subscriptionStart,
        subscriptionEnd,
        stripeData.customerId || null,
        stripeData.subscriptionId || null,
        stripeData.priceId || null,
        billingPeriod,
        stripeData.currency || 'USD',
        userId,
      ]
    )
    
    logger.info('Upgraded subscription', { userId, planType, billingPeriod, stripeData })
    return result.rows[0]
  } catch (error) {
    logger.error('Error upgrading subscription', { userId, planType, error: error.message, stack: error.stack })
    throw error
  } finally {
    client.release()
  }
}

/**
 * Cancel subscription
 */
export const cancelSubscription = async (userId) => {
  const client = await pool.connect()
  try {
    const result = await client.query(
      `UPDATE subscriptions 
       SET status = 'cancelled',
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
       RETURNING *`,
      [userId]
    )
    
    logger.info('Cancelled subscription', { userId })
    return result.rows[0]
  } catch (error) {
    logger.error('Error cancelling subscription', { userId, error: error.message, stack: error.stack })
    throw error
  } finally {
    client.release()
  }
}

/**
 * Check if trial has expired
 */
export const checkTrialExpiry = async (userId) => {
  const subscription = await getUserSubscription(userId)
  
  if (subscription.plan_type !== 'trial') {
    return false
  }
  
  const now = new Date()
  const trialEnd = new Date(subscription.trial_end_date)
  
  if (now > trialEnd && subscription.status === 'active') {
    // Expire the trial
    const client = await pool.connect()
    try {
      await client.query(
        `UPDATE subscriptions 
         SET status = 'expired',
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1`,
        [userId]
      )
      logger.info('Trial expired', { userId, trialEnd })
      return true
    } catch (error) {
      logger.error('Error expiring trial', { userId, error: error.message })
      return false
    } finally {
      client.release()
    }
  }
  
  return false
}

/**
 * Get available features for user's subscription
 */
export const getSubscriptionFeatures = async (userId) => {
  const subscription = await getUserSubscription(userId)
  const planType = subscription.plan_type
  
  // Check if trial expired
  if (planType === 'trial') {
    const expired = await checkTrialExpiry(userId)
    if (expired) {
      // Return empty features for expired trial
      return {
        features: [],
        restrictedFeatures: Object.values(FEATURE_DEFINITIONS).flatMap(p => p.features),
        historicalDataMonths: 0,
      }
    }
  }
  
  return FEATURE_DEFINITIONS[planType] || FEATURE_DEFINITIONS.trial
}

/**
 * Check if user can access a feature
 */
export const canAccessFeature = async (userId, featureName) => {
  const features = await getSubscriptionFeatures(userId)
  return features.features.includes(featureName)
}

/**
 * Get historical data limit in months
 */
export const getHistoricalDataLimit = async (userId) => {
  const features = await getSubscriptionFeatures(userId)
  return features.historicalDataMonths
}

/**
 * Get required plan for a feature
 */
export const getRequiredPlan = (featureName) => {
  if (['csv_export', 'email_alerts', 'unit_economics'].includes(featureName)) {
    return 'Pro'
  }
  if (['scheduled_sync'].includes(featureName)) {
    return 'Starter'
  }
  return 'Trial'
}

/**
 * Track feature usage (for analytics)
 */
export const trackFeatureUsage = async (userId, featureName, metadata = {}) => {
  const client = await pool.connect()
  try {
    await client.query(
      `INSERT INTO subscription_usage (user_id, feature_name, usage_date, metadata, created_at)
       VALUES ($1, $2, CURRENT_DATE, $3, CURRENT_TIMESTAMP)
       ON CONFLICT DO NOTHING`,
      [userId, featureName, JSON.stringify(metadata)]
    )
  } catch (error) {
    logger.error('Error tracking feature usage', { userId, featureName, error: error.message })
    // Don't throw - usage tracking shouldn't break the app
  } finally {
    client.release()
  }
}

/**
 * Get subscription status info for UI
 */
export const getSubscriptionStatus = async (userId) => {
  const subscription = await getUserSubscription(userId)
  const features = await getSubscriptionFeatures(userId)
  
  const now = new Date()
  let daysRemaining = null
  let nextBillingDate = null
  
  if (subscription.plan_type === 'trial') {
    const trialEnd = new Date(subscription.trial_end_date)
    const diffTime = trialEnd - now
    daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    daysRemaining = Math.max(0, daysRemaining)
  } else if (subscription.subscription_end_date) {
    const subEnd = new Date(subscription.subscription_end_date)
    const diffTime = subEnd - now
    daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    nextBillingDate = subscription.subscription_end_date
  }
  
  return {
    planType: subscription.plan_type,
    status: subscription.status,
    billingPeriod: subscription.billing_period || 'monthly',
    daysRemaining,
    nextBillingDate,
    historicalDataMonths: features.historicalDataMonths,
    isTrial: subscription.plan_type === 'trial',
    isExpired: subscription.status === 'expired',
    canAccessFeatures: features.features.length > 0,
  }
}
