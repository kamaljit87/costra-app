/**
 * Dodo Payments Service
 * Handles Dodo Payments integration for subscriptions
 * Docs: https://docs.dodopayments.com
 */

import DodoPayments from 'dodopayments'
import { Webhook } from 'standardwebhooks'
import logger from '../utils/logger.js'
import { upgradeSubscription, getUserSubscription, cancelSubscription } from './subscriptionService.js'

let dodoClient = null
let webhookVerifier = null

if (process.env.DODO_PAYMENTS_API_KEY) {
  try {
    dodoClient = new DodoPayments({
      bearerToken: process.env.DODO_PAYMENTS_API_KEY,
      environment: process.env.DODO_PAYMENTS_ENVIRONMENT || 'live_mode',
    })
    logger.info('Dodo Payments initialized')
  } catch (err) {
    logger.warn('Failed to initialize Dodo Payments', { error: err.message })
  }
}

if (process.env.DODO_PAYMENTS_WEBHOOK_KEY) {
  try {
    webhookVerifier = new Webhook(process.env.DODO_PAYMENTS_WEBHOOK_KEY)
  } catch (err) {
    logger.warn('Failed to create Dodo webhook verifier', { error: err.message })
  }
}

function getProductId(planType, billingPeriod) {
  const key = `DODO_${planType.toUpperCase()}_${billingPeriod.toUpperCase()}_PRODUCT_ID`
  return process.env[key] || process.env[`DODO_${planType.toUpperCase()}_PRODUCT_ID`]
}

/**
 * Create Dodo checkout session for subscription upgrade
 */
export const createCheckoutSession = async (userId, planType, userEmail, userName, billingPeriod = 'monthly') => {
  if (!dodoClient) {
    throw new Error('Dodo Payments not configured. Set DODO_PAYMENTS_API_KEY.')
  }

  const productId = getProductId(planType, billingPeriod)
  if (!productId) {
    throw new Error(
      `Dodo product ID not configured. Set DODO_${planType.toUpperCase()}_${billingPeriod.toUpperCase()}_PRODUCT_ID ` +
      `(create products in Dodo Dashboard: https://app.dodopayments.com)`
    )
  }

  const returnUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings/billing?success=true`

  try {
    const session = await dodoClient.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: { email: userEmail, name: userName },
      return_url: returnUrl,
      metadata: {
        userId: userId.toString(),
        planType,
        billingPeriod,
      },
    })

    const checkoutUrl = session.checkout_url ?? session.checkoutUrl
    logger.info('Created Dodo checkout session', { userId, planType, billingPeriod, sessionId: session.session_id })
    return {
      id: session.session_id ?? session.sessionId,
      url: checkoutUrl,
    }
  } catch (error) {
    logger.error('Dodo checkout session failed', {
      userId,
      planType,
      billingPeriod,
      error: error.message,
      stack: error.stack,
    })
    throw error
  }
}

/**
 * Verify and process Dodo webhook payload
 */
export const handleWebhook = async (rawBody, headers) => {
  if (!webhookVerifier) {
    throw new Error('Dodo webhook secret not configured. Set DODO_PAYMENTS_WEBHOOK_KEY.')
  }

  const webhookHeaders = {
    'webhook-id': headers['webhook-id'] || '',
    'webhook-signature': headers['webhook-signature'] || '',
    'webhook-timestamp': headers['webhook-timestamp'] || '',
  }

  const rawString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody)
  webhookVerifier.verify(rawString, webhookHeaders)
  const payload = JSON.parse(rawString)

  logger.info('Processing Dodo webhook', { type: payload.type, businessId: payload.business_id })

  const data = payload.data || {}
  const eventType = payload.type || ''

  try {
    switch (eventType) {
      case 'payment.succeeded': {
        const metadata = data.metadata || {}
        const userId = parseInt(metadata.userId, 10)
        const planType = metadata.planType
        const billingPeriod = metadata.billingPeriod || 'monthly'

        if (userId && planType) {
          await upgradeSubscription(userId, planType, {
            customerId: data.customer_id,
            subscriptionId: data.subscription_id || null,
            priceId: null,
            billingPeriod,
          })
          logger.info('Subscription upgraded from Dodo payment.succeeded', { userId, planType, billingPeriod })
        }
        break
      }

      case 'subscription.created':
      case 'subscription.activated': {
        const metadata = data.metadata || {}
        const userId = parseInt(metadata.userId, 10)
        const planType = metadata.planType
        const billingPeriod = metadata.billingPeriod || 'monthly'

        if (userId && planType) {
          await upgradeSubscription(userId, planType, {
            customerId: data.customer_id,
            subscriptionId: data.subscription_id || data.id,
            priceId: null,
            billingPeriod,
          })
          logger.info('Subscription upgraded from Dodo subscription event', { userId, planType, eventType })
        }
        break
      }

      case 'subscription.cancelled':
      case 'subscription.expired': {
        const metadata = data.metadata || {}
        const userId = parseInt(metadata.userId, 10)
        if (userId) {
          await cancelSubscription(userId)
          logger.info('Subscription cancelled from Dodo webhook', { userId, eventType })
        }
        break
      }

      default:
        logger.debug('Unhandled Dodo webhook event', { type: eventType })
    }

    return { received: true }
  } catch (error) {
    logger.error('Dodo webhook processing failed', { type: eventType, error: error.message, stack: error.stack })
    throw error
  }
}

/**
 * Cancel Dodo subscription (DB only - Dodo cancel via dashboard or their API)
 */
export const cancelDodoSubscription = async (userId) => {
  const subscription = await getUserSubscription(userId)
  if (!subscription.stripe_subscription_id) {
    return await cancelSubscription(userId)
  }
  return await cancelSubscription(userId)
}

export const isConfigured = () => !!dodoClient
