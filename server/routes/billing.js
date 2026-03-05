/**
 * Billing Routes
 * Handles subscription and billing operations via Dodo Payments
 */

import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { getUserSubscription, getSubscriptionStatus, getSubscriptionFeatures } from '../services/subscriptionService.js'
import {
  createCheckoutSession as createDodoCheckout,
  handleWebhook as handleDodoWebhook,
  cancelDodoSubscription,
} from '../services/dodoService.js'
import logger from '../utils/logger.js'

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
    const features = await getSubscriptionFeatures(userId)

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
      limits: {
        historicalDataMonths: features.historicalDataMonths,
        maxProviderAccounts: features.maxProviderAccounts,
      },
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
 * Create checkout session for subscription upgrade
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

    const userEmail = req.user.email || 'user@example.com'
    const userName = req.user.name || 'User'

    const session = await createDodoCheckout(userId, planType, userEmail, userName, billingPeriod)

    res.json({
      sessionId: session.id,
      url: session.url,
    })
  } catch (error) {
    logger.error('Error creating checkout session', {
      userId: req.user?.userId,
      error: error.message,
      stack: error.stack,
    })
    res.status(500).json({ error: error.message || 'Failed to create checkout session' })
  }
})

/**
 * POST /api/billing/cancel
 * Cancel subscription
 */
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    await cancelDodoSubscription(userId)
    res.json({ message: 'Subscription cancelled successfully' })
  } catch (error) {
    logger.error('Error cancelling subscription', {
      userId: req.user?.userId,
      error: error.message,
      stack: error.stack,
    })
    res.status(500).json({ error: 'Failed to cancel subscription' })
  }
})

/**
 * POST /api/billing/dodo-webhook
 * Dodo Payments webhook (raw body required for signature verification)
 */
router.post(
  '/dodo-webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      const rawBody = req.body
      const headers = {
        'webhook-id': req.headers['webhook-id'],
        'webhook-signature': req.headers['webhook-signature'],
        'webhook-timestamp': req.headers['webhook-timestamp'],
      }
      await handleDodoWebhook(rawBody, headers)
      res.json({ received: true })
    } catch (error) {
      logger.error('Dodo webhook error', { error: error.message })
      res.status(400).json({ error: 'Webhook verification failed' })
    }
  }
)

export default router
