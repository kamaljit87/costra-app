/**
 * AI Chat Credit Service
 * Monthly message credit limits for AI chat feature
 */

import { pool } from '../database.js'
import { getUserSubscription } from './subscriptionService.js'
import logger from '../utils/logger.js'

// Monthly message limits per plan
const CHAT_CREDIT_LIMITS = {
  trial: 10,
  starter: 100,
  pro: 500,
}

/**
 * Get or create a chat credit record for the current billing period.
 * Automatically resets credits when a new month starts.
 */
export const getOrCreateChatCreditRecord = async (userId) => {
  const subscription = await getUserSubscription(userId)
  const planType = subscription.plan_type
  const limit = CHAT_CREDIT_LIMITS[planType] ?? 10

  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const periodStartStr = periodStart.toISOString().split('T')[0]
  const periodEndStr = periodEnd.toISOString().split('T')[0]

  const result = await pool.query(
    `INSERT INTO ai_chat_credits (user_id, credits_used, credits_limit, period_start, period_end)
     VALUES ($1, 0, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET
       credits_limit = $2,
       credits_used = CASE
         WHEN ai_chat_credits.period_start < $3::date THEN 0
         ELSE ai_chat_credits.credits_used
       END,
       period_start = CASE
         WHEN ai_chat_credits.period_start < $3::date THEN $3::date
         ELSE ai_chat_credits.period_start
       END,
       period_end = $4::date,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [userId, limit, periodStartStr, periodEndStr]
  )
  return result.rows[0]
}

/**
 * Get current chat credit balance for user
 */
export const getChatCreditBalance = async (userId) => {
  const record = await getOrCreateChatCreditRecord(userId)
  return {
    used: record.credits_used,
    limit: record.credits_limit,
    remaining: record.credits_limit - record.credits_used,
    periodStart: record.period_start,
    periodEnd: record.period_end,
  }
}

/**
 * Consume 1 chat credit. Throws if insufficient.
 */
export const consumeChatCredit = async (userId) => {
  const record = await getOrCreateChatCreditRecord(userId)
  const remaining = record.credits_limit - record.credits_used
  if (remaining < 1) {
    throw new Error('Monthly AI chat message limit reached. Credits reset on the 1st of each month.')
  }
  await pool.query(
    'UPDATE ai_chat_credits SET credits_used = credits_used + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1',
    [userId]
  )
  logger.debug('AI chat credit consumed', { userId, used: record.credits_used + 1, limit: record.credits_limit })
}
