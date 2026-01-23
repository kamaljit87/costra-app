/**
 * Stripe Service
 * Handles Stripe integration for subscriptions
 */

import Stripe from 'stripe'
import logger from '../utils/logger.js'
import { upgradeSubscription, cancelSubscription as cancelSub, getUserSubscription } from './subscriptionService.js'

// Initialize Stripe
const stripe = Stripe(process.env.STRIPE_SECRET_KEY || '')

/**
 * Create Stripe customer
 */
export const createCustomer = async (userId, email, name) => {
  try {
    if (!stripe) {
      throw new Error('Stripe not configured')
    }
    
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        userId: userId.toString(),
      },
    })
    
    logger.info('Created Stripe customer', { userId, customerId: customer.id })
    return customer
  } catch (error) {
    logger.error('Error creating Stripe customer', { userId, error: error.message, stack: error.stack })
    throw error
  }
}

/**
 * Create checkout session for subscription
 */
export const createCheckoutSession = async (userId, planType, userEmail, userName, billingPeriod = 'monthly') => {
  try {
    if (!stripe) {
      throw new Error('Stripe not configured')
    }
    
    // Get or create customer
    const subscription = await getUserSubscription(userId)
    let customerId = subscription.stripe_customer_id
    
    if (!customerId) {
      const customer = await createCustomer(userId, userEmail, userName)
      customerId = customer.id
    }
    
    // Get price ID based on plan and billing period
    let priceId
    if (planType === 'starter') {
      priceId = billingPeriod === 'annual'
        ? process.env.STRIPE_STARTER_PRICE_ID_ANNUAL
        : process.env.STRIPE_STARTER_PRICE_ID_MONTHLY || process.env.STRIPE_STARTER_PRICE_ID
    } else {
      priceId = billingPeriod === 'annual'
        ? process.env.STRIPE_PRO_PRICE_ID_ANNUAL
        : process.env.STRIPE_PRO_PRICE_ID_MONTHLY || process.env.STRIPE_PRO_PRICE_ID
    }
    
    if (!priceId) {
      throw new Error(`Price ID not configured for plan: ${planType}, period: ${billingPeriod}`)
    }
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings/billing?success=true`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings/billing?canceled=true`,
      metadata: {
        userId: userId.toString(),
        planType,
        billingPeriod,
      },
    })
    
    logger.info('Created checkout session', { userId, planType, billingPeriod, sessionId: session.id })
    return session
  } catch (error) {
    logger.error('Error creating checkout session', { userId, planType, billingPeriod, error: error.message, stack: error.stack })
    throw error
  }
}

/**
 * Create customer portal session
 */
export const createPortalSession = async (userId) => {
  try {
    if (!stripe) {
      throw new Error('Stripe not configured')
    }
    
    const subscription = await getUserSubscription(userId)
    
    if (!subscription.stripe_customer_id) {
      throw new Error('No Stripe customer ID found')
    }
    
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings/billing`,
    })
    
    logger.info('Created portal session', { userId, sessionId: session.id })
    return session
  } catch (error) {
    logger.error('Error creating portal session', { userId, error: error.message, stack: error.stack })
    throw error
  }
}

/**
 * Handle Stripe webhook events
 */
export const handleWebhook = async (event) => {
  try {
    logger.info('Processing Stripe webhook', { type: event.type, id: event.id })
    
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const userId = parseInt(session.metadata?.userId, 10)
        const planType = session.metadata?.planType
        
        if (userId && planType) {
          await upgradeSubscription(userId, planType, {
            customerId: session.customer,
            subscriptionId: session.subscription,
            priceId: session.display_items?.[0]?.price?.id,
          })
          logger.info('Subscription upgraded from webhook', { userId, planType })
        }
        break
      }
      
      case 'customer.subscription.updated': {
        const subscription = event.data.object
        // Find user by customer ID
        // Update subscription status if needed
        logger.info('Subscription updated', { subscriptionId: subscription.id })
        break
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        // Find user by customer ID and cancel
        logger.info('Subscription deleted', { subscriptionId: subscription.id })
        break
      }
      
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object
        logger.info('Payment succeeded', { invoiceId: invoice.id })
        break
      }
      
      case 'invoice.payment_failed': {
        const invoice = event.data.object
        logger.warn('Payment failed', { invoiceId: invoice.id })
        break
      }
      
      default:
        logger.debug('Unhandled webhook event', { type: event.type })
    }
    
    return { received: true }
  } catch (error) {
    logger.error('Error handling webhook', { type: event.type, error: error.message, stack: error.stack })
    throw error
  }
}

/**
 * Cancel subscription via Stripe
 */
export const cancelStripeSubscription = async (userId) => {
  try {
    if (!stripe) {
      throw new Error('Stripe not configured')
    }
    
    const subscription = await getUserSubscription(userId)
    
    if (!subscription.stripe_subscription_id) {
      // No Stripe subscription, just cancel in our DB
      return await cancelSub(userId)
    }
    
    // Cancel in Stripe
    await stripe.subscriptions.cancel(subscription.stripe_subscription_id)
    
    // Cancel in our DB
    return await cancelSub(userId)
  } catch (error) {
    logger.error('Error cancelling Stripe subscription', { userId, error: error.message, stack: error.stack })
    throw error
  }
}
