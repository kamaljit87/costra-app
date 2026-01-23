/**
 * Email Service
 * Handles sending emails for alerts and notifications (Pro only)
 */

import nodemailer from 'nodemailer'
import logger from '../utils/logger.js'
import { getUserById } from '../database.js'
import { canAccessFeature } from './subscriptionService.js'

// Create transporter (supports SMTP or SendGrid)
let transporter = null

const initEmailService = () => {
  // Use SendGrid if API key is provided
  if (process.env.SENDGRID_API_KEY) {
    transporter = nodemailer.createTransport({
      service: 'SendGrid',
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY,
      },
    })
    logger.info('Email service initialized with SendGrid')
    return
  }

  // Use SMTP if configured
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
    logger.info('Email service initialized with SMTP', { host: process.env.SMTP_HOST })
    return
  }

  // No email service configured
  logger.warn('Email service not configured - email alerts will be disabled')
}

// Initialize on module load
initEmailService()

/**
 * Check if email service is available
 */
export const isEmailServiceAvailable = () => {
  return transporter !== null
}

/**
 * Get user email preferences
 */
export const getUserEmailPreferences = async (userId) => {
  const { pool } = await import('../database.js')
  const client = await pool.connect()
  try {
    const result = await client.query(
      `SELECT email_alerts_enabled, email_anomaly_alerts, email_budget_alerts, email_weekly_summary
       FROM user_preferences
       WHERE user_id = $1`,
      [userId]
    )
    
    if (result.rows.length === 0) {
      // Default preferences (all enabled for Pro users)
      return {
        emailAlertsEnabled: true,
        emailAnomalyAlerts: true,
        emailBudgetAlerts: true,
        emailWeeklySummary: false,
      }
    }
    
    const prefs = result.rows[0]
    return {
      emailAlertsEnabled: prefs.email_alerts_enabled ?? true,
      emailAnomalyAlerts: prefs.email_anomaly_alerts ?? true,
      emailBudgetAlerts: prefs.email_budget_alerts ?? true,
      emailWeeklySummary: prefs.email_weekly_summary ?? false,
    }
  } catch (error) {
    logger.error('Error getting email preferences', { userId, error: error.message })
    return {
      emailAlertsEnabled: true,
      emailAnomalyAlerts: true,
      emailBudgetAlerts: true,
      emailWeeklySummary: false,
    }
  } finally {
    client.release()
  }
}

/**
 * Update user email preferences
 */
export const updateUserEmailPreferences = async (userId, preferences) => {
  const { pool } = await import('../database.js')
  const client = await pool.connect()
  try {
    await client.query(
      `INSERT INTO user_preferences (user_id, email_alerts_enabled, email_anomaly_alerts, email_budget_alerts, email_weekly_summary, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         email_alerts_enabled = EXCLUDED.email_alerts_enabled,
         email_anomaly_alerts = EXCLUDED.email_anomaly_alerts,
         email_budget_alerts = EXCLUDED.email_budget_alerts,
         email_weekly_summary = EXCLUDED.email_weekly_summary,
         updated_at = CURRENT_TIMESTAMP`,
      [
        userId,
        preferences.emailAlertsEnabled ?? true,
        preferences.emailAnomalyAlerts ?? true,
        preferences.emailBudgetAlerts ?? true,
        preferences.emailWeeklySummary ?? false,
      ]
    )
    
    logger.info('Email preferences updated', { userId, preferences })
  } catch (error) {
    logger.error('Error updating email preferences', { userId, error: error.message })
    throw error
  } finally {
    client.release()
  }
}

/**
 * Send email (Pro only)
 */
export const sendEmail = async (userId, { to, subject, html, text }) => {
  try {
    // Check if user has Pro subscription
    const hasAccess = await canAccessFeature(userId, 'email_alerts')
    if (!hasAccess) {
      logger.warn('Email send denied - user does not have Pro subscription', { userId })
      return { success: false, error: 'Email alerts require Pro subscription' }
    }

    // Check if email service is available
    if (!isEmailServiceAvailable()) {
      logger.warn('Email service not available', { userId })
      return { success: false, error: 'Email service not configured' }
    }

    // Get user email if not provided
    if (!to) {
      const user = await getUserById(userId)
      if (!user || !user.email) {
        throw new Error('User email not found')
      }
      to = user.email
    }

    // Check user preferences
    const preferences = await getUserEmailPreferences(userId)
    if (!preferences.emailAlertsEnabled) {
      logger.debug('Email alerts disabled by user preference', { userId })
      return { success: false, error: 'Email alerts disabled by user' }
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@costra.com',
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    }

    const info = await transporter.sendMail(mailOptions)
    logger.info('Email sent successfully', { userId, to, subject, messageId: info.messageId })
    
    return { success: true, messageId: info.messageId }
  } catch (error) {
    logger.error('Error sending email', { userId, to, error: error.message, stack: error.stack })
    return { success: false, error: error.message }
  }
}

/**
 * Send anomaly alert email
 */
export const sendAnomalyAlert = async (userId, anomalyData) => {
  const preferences = await getUserEmailPreferences(userId)
  if (!preferences.emailAnomalyAlerts) {
    return { success: false, error: 'Anomaly alerts disabled by user' }
  }

  const { serviceName, variancePercent, currentCost, baselineCost, isIncrease, date } = anomalyData

  const subject = `Cost Anomaly Detected: ${serviceName}`
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1F3A5F; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .alert { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0; }
        .metric { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .metric-label { font-weight: 600; }
        .button { display: inline-block; padding: 12px 24px; background: #1F3A5F; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Cost Anomaly Detected</h1>
        </div>
        <div class="content">
          <div class="alert">
            <strong>${serviceName}</strong> costs have ${isIncrease ? 'increased' : 'decreased'} by 
            <strong>${Math.abs(variancePercent).toFixed(1)}%</strong> compared to the 30-day baseline.
          </div>
          
          <div class="metric">
            <span class="metric-label">Current Cost:</span>
            <span>$${currentCost.toFixed(2)}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Baseline Cost:</span>
            <span>$${baselineCost.toFixed(2)}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Variance:</span>
            <span>${isIncrease ? '+' : ''}${variancePercent.toFixed(1)}%</span>
          </div>
          ${date ? `<div class="metric"><span class="metric-label">Date:</span><span>${new Date(date).toLocaleDateString()}</span></div>` : ''}
          
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/provider/${anomalyData.providerId || ''}?tab=analytics" class="button">
            View Anomalies
          </a>
        </div>
      </div>
    </body>
    </html>
  `

  return await sendEmail(userId, { subject, html })
}

/**
 * Send budget alert email
 */
export const sendBudgetAlert = async (userId, budgetData) => {
  const preferences = await getUserEmailPreferences(userId)
  if (!preferences.emailBudgetAlerts) {
    return { success: false, error: 'Budget alerts disabled by user' }
  }

  const { budgetName, currentSpend, budgetAmount, percentage, isExceeded } = budgetData

  const subject = isExceeded 
    ? `Budget Exceeded: ${budgetName}`
    : `Budget Alert: ${budgetName}`
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${isExceeded ? '#DC2626' : '#F59E0B'}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .alert { background: ${isExceeded ? '#fee2e2' : '#fef3c7'}; border-left: 4px solid ${isExceeded ? '#DC2626' : '#F59E0B'}; padding: 15px; margin: 15px 0; }
        .metric { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .metric-label { font-weight: 600; }
        .button { display: inline-block; padding: 12px 24px; background: #1F3A5F; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${isExceeded ? 'Budget Exceeded' : 'Budget Alert'}</h1>
        </div>
        <div class="content">
          <div class="alert">
            <strong>${budgetName}</strong> is at <strong>${percentage.toFixed(1)}%</strong> of the budget limit.
            ${isExceeded ? 'The budget has been exceeded!' : ''}
          </div>
          
          <div class="metric">
            <span class="metric-label">Current Spend:</span>
            <span>$${currentSpend.toFixed(2)}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Budget Limit:</span>
            <span>$${budgetAmount.toFixed(2)}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Remaining:</span>
            <span>$${(budgetAmount - currentSpend).toFixed(2)}</span>
          </div>
          
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/budgets" class="button">
            View Budgets
          </a>
        </div>
      </div>
    </body>
    </html>
  `

  return await sendEmail(userId, { subject, html })
}

/**
 * Send weekly summary email
 */
export const sendWeeklySummary = async (userId, summaryData) => {
  const preferences = await getUserEmailPreferences(userId)
  if (!preferences.emailWeeklySummary) {
    return { success: false, error: 'Weekly summary disabled by user' }
  }

  const { totalCost, topServices, costChange } = summaryData

  const subject = 'Weekly Cost Summary'
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1F3A5F; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .metric { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .metric-label { font-weight: 600; }
        .button { display: inline-block; padding: 12px 24px; background: #1F3A5F; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Weekly Cost Summary</h1>
        </div>
        <div class="content">
          <div class="metric">
            <span class="metric-label">Total Cost:</span>
            <span>$${totalCost.toFixed(2)}</span>
          </div>
          ${costChange ? `
          <div class="metric">
            <span class="metric-label">Change from last week:</span>
            <span>${costChange > 0 ? '+' : ''}${costChange.toFixed(2)}%</span>
          </div>
          ` : ''}
          
          ${topServices && topServices.length > 0 ? `
          <h3>Top Services</h3>
          ${topServices.map(service => `
            <div class="metric">
              <span>${service.name}</span>
              <span>$${service.cost.toFixed(2)}</span>
            </div>
          `).join('')}
          ` : ''}
          
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" class="button">
            View Dashboard
          </a>
        </div>
      </div>
    </body>
    </html>
  `

  return await sendEmail(userId, { subject, html })
}
