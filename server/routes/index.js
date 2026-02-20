/**
 * Route aggregator - mounts all API routes
 */

import authRoutes from './auth.js'
import costDataRoutes from './costData.js'
import savingsPlansRoutes from './savingsPlans.js'
import cloudProvidersRoutes from './cloudProviders.js'
import googleAuthRoutes from './googleAuth.js'
import syncRoutes from './sync.js'
import syncPreferencesRoutes from './syncPreferences.js'
import profileRoutes from './profile.js'
import aiRoutes from './ai.js'
import insightsRoutes from './insights.js'
import budgetsRoutes from './budgets.js'
import reportsRoutes from './reports.js'
import notificationsRoutes from './notifications.js'
import billingRoutes from './billing.js'
import emailPreferencesRoutes from './emailPreferences.js'
import savedViewsRoutes from './savedViews.js'
import goalsRoutes from './goals.js'
import apiKeysRoutes from './apiKeys.js'
import complianceRoutes from './compliance.js'
import contactRoutes from './contact.js'
import adminRoutes from './admin.js'
import awsCallbackRoutes from './awsCallback.js'
import healthRoutes from './health.js'

const routes = [
  { path: '/api/auth', handler: authRoutes },
  { path: '/api/auth/google', handler: googleAuthRoutes },
  { path: '/api/profile', handler: profileRoutes },
  { path: '/api/cost-data', handler: costDataRoutes },
  { path: '/api/savings-plans', handler: savingsPlansRoutes },
  { path: '/api/cloud-providers', handler: cloudProvidersRoutes },
  { path: '/api/aws-callback', handler: awsCallbackRoutes },
  { path: '/api/sync', handler: syncRoutes },
  { path: '/api/sync', handler: syncPreferencesRoutes },
  { path: '/api/ai', handler: aiRoutes },
  { path: '/api/insights', handler: insightsRoutes },
  { path: '/api/budgets', handler: budgetsRoutes },
  { path: '/api/reports', handler: reportsRoutes },
  { path: '/api/notifications', handler: notificationsRoutes },
  { path: '/api/billing', handler: billingRoutes },
  { path: '/api/email-preferences', handler: emailPreferencesRoutes },
  { path: '/api/saved-views', handler: savedViewsRoutes },
  { path: '/api/goals', handler: goalsRoutes },
  { path: '/api/api-keys', handler: apiKeysRoutes },
  { path: '/api/compliance', handler: complianceRoutes },
  { path: '/api/contact', handler: contactRoutes },
  { path: '/api/admin', handler: adminRoutes },
  { path: '/api/health', handler: healthRoutes },
]

/**
 * Register all routes on the Express app
 * @param {express.Application} app
 */
export function registerRoutes(app) {
  for (const { path: routePath, handler } of routes) {
    app.use(routePath, handler)
  }
}

export default registerRoutes
