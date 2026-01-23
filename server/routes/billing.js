/**
 * Billing Routes
 * Handles subscription and billing operations
 */

import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { 
  getUserSubscription, 
  getSubscriptionStatus,
  upgradeSubscription,
  cancelSubscription,
} from '../services/subscriptionService.js'
import {
  createCheckoutSession,
  createPortalSession,
  handleWebhook,
  cancelStripeSubscription,
} from '../services/stripeService.js'
import logger from '../utils/logger.js'
import Stripe from 'stripe'

const router = express.Router()

/**
 * GET /api/billing/subscription
 * Get current subscription status
 */
router.get('/subscription', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const subscription = await getUserSubscription(userId)
    const status = await getSubscriptionStatus(userId)
    
    res.json({
      subscription: {
        planType: subscription.plan_type,
        status: subscription.status,
        billingPeriod: subscription.billing_period || 'monthly',
        trialStartDate: subscription.trial_start_date,
        trialEndDate: subscription.trial_end_date,
        subscriptionStartDate: subscription.subscription_start_date,
        subscriptionEndDate: subscription.subscription_end_date,
      },
      status,
    })
  } catch (error) {
    logger.error('Error getting subscription', { 
      userId: req.user?.userId, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to get subscription' })
  }
})

/**
 * POST /api/billing/create-checkout-session
 * Create Stripe checkout session for subscription upgrade
 */
router.post('/create-checkout-session', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { planType, billingPeriod = 'monthly' } = req.body
    
    if (!planType || !['starter', 'pro'].includes(planType)) {
      return res.status(400).json({ error: 'Invalid plan type. Must be "starter" or "pro"' })
    }
    
    if (!['monthly', 'annual'].includes(billingPeriod)) {
      return res.status(400).json({ error: 'Invalid billing period. Must be "monthly" or "annual"' })
    }
    
    // Get user email and name
    const userEmail = req.user.email || 'user@example.com'
    const userName = req.user.name || 'User'
    
    const session = await createCheckoutSession(userId, planType, userEmail, userName, billingPeriod)
    
    res.json({ 
      sessionId: session.id,
      url: session.url,
    })
  } catch (error) {
    logger.error('Error creating checkout session', { 
      userId: req.user?.userId, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to create checkout session' })
  }
})

/**
 * POST /api/billing/create-portal-session
 * Create Stripe customer portal session
 */
router.post('/create-portal-session', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const session = await createPortalSession(userId)
    
    res.json({ url: session.url })
  } catch (error) {
    logger.error('Error creating portal session', { 
      userId: req.user?.userId, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to create portal session' })
  }
})

/**
 * POST /api/billing/webhook
 * Handle Stripe webhook events
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature']
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  
  if (!webhookSecret) {
    logger.warn('Stripe webhook secret not configured')
    return res.status(400).json({ error: 'Webhook secret not configured' })
  }
  
  let event
  
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
  } catch (err) {
    logger.error('Webhook signature verification failed', { error: err.message })
    return res.status(400).json({ error: `Webhook Error: ${err.message}` })
  }
  
  try {
    await handleWebhook(event)
    res.json({ received: true })
  } catch (error) {
    logger.error('Error handling webhook', { 
      type: event.type, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to handle webhook' })
  }
})

/**
 * POST /api/billing/cancel
 * Cancel subscription
 */
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    await cancelStripeSubscription(userId)
    
    res.json({ message: 'Subscription cancelled successfully' })
  } catch (error) {
    logger.error('Error cancelling subscription', { 
      userId: req.user?.userId, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to cancel subscription' })
  }
})

export default router
