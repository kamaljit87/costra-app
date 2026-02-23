/**
 * MongoDB Atlas Provider Adapter
 *
 * Re-exports MongoDB Atlas functions from cloudProviderIntegrations and adds
 * credential validation plus daily data synthesis (Atlas provides invoice-level
 * / monthly totals, not daily granularity).
 */

import { fetchMongoDBAtlasCostData, fetchMongoDBAtlasServiceDetails } from '../cloudProviderIntegrations.js'
import logger from '../../utils/logger.js'

export default {
  id: 'mongodb',
  aliases: ['mongodbatlas', 'atlas'],
  name: 'MongoDB Atlas',

  /**
   * Validate that the required MongoDB Atlas API credentials are present.
   */
  validateCredentials(credentials) {
    if (!credentials) return false
    return !!(credentials.publicKey && credentials.privateKey && credentials.orgId)
  },

  /**
   * Resolve credentials for a MongoDB Atlas account.
   * Atlas uses API key pairs — no role assumption needed.
   */
  async resolveCredentials(account, accountData) {
    const creds = accountData.credentials || {}
    if (!creds || Object.keys(creds).length === 0) {
      return { credentials: null, error: 'Credentials not found' }
    }
    if (!this.validateCredentials(creds)) {
      return { credentials: null, error: 'MongoDB Atlas credentials incomplete (requires publicKey, privateKey, orgId)' }
    }
    return { credentials: creds, error: null }
  },

  /**
   * Fetch cost data from the MongoDB Atlas API.
   */
  async fetchCostData(credentials, startDate, endDate) {
    return fetchMongoDBAtlasCostData(credentials, startDate, endDate)
  },

  /**
   * Synthesize daily cost data from the current month total.
   *
   * MongoDB Atlas's billing API only returns invoice-level (monthly) data, not daily.
   * This distributes the current month total evenly across elapsed days
   * so the UI can render a daily cost chart.
   */
  synthesizeDailyData(costData, startDate, endDate) {
    // If daily data already exists, return it as-is
    if (costData.dailyData && costData.dailyData.length > 0) {
      return costData.dailyData
    }

    const total = costData.currentMonth || 0
    if (total <= 0) {
      return []
    }

    // Determine the date range: 1st of the current month to today (or endDate if earlier)
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const endBound = endDate ? new Date(endDate) : now
    const effectiveEnd = endBound < now ? endBound : now

    // If the effective end is before the month start, nothing to synthesize
    if (effectiveEnd < monthStart) {
      return []
    }

    // Count the number of elapsed days (inclusive of both start and end dates)
    const msPerDay = 24 * 60 * 60 * 1000
    const daysElapsed = Math.floor((effectiveEnd - monthStart) / msPerDay) + 1

    if (daysElapsed <= 0) {
      return []
    }

    const dailyCost = Math.round((total / daysElapsed) * 100) / 100

    logger.debug(`MongoDB Atlas: synthesizing daily data — $${total} over ${daysElapsed} days ($${dailyCost}/day)`)

    const dailyData = []
    for (let i = 0; i < daysElapsed; i++) {
      const date = new Date(monthStart)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]
      dailyData.push({ date: dateStr, cost: dailyCost })
    }

    return dailyData
  },

  /**
   * Fetch service-level detail from MongoDB Atlas.
   */
  async fetchServiceDetails(credentials, serviceName, startDate, endDate) {
    return fetchMongoDBAtlasServiceDetails(credentials, serviceName, startDate, endDate)
  },

  /**
   * Fetch cost-optimization recommendations.
   * MongoDB Atlas does not expose a recommendations API, but we can analyze
   * invoice line items to provide billing-data-driven suggestions.
   */
  async fetchRecommendations(credentials, options) {
    try {
      const endDate = new Date()
      const startDate = new Date()
      startDate.setMonth(startDate.getMonth() - 3)

      const costData = await fetchMongoDBAtlasCostData(credentials, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0])
      const recommendations = []
      let totalPotentialSavings = 0

      // Analyze services for potential recommendations
      if (costData.services && costData.services.length > 0) {
        const totalCost = costData.services.reduce((sum, s) => sum + s.cost, 0)

        for (const service of costData.services) {
          // Flag high data transfer costs (>20% of total)
          if (service.name === 'Data Transfer' && totalCost > 0 && service.cost / totalCost > 0.2) {
            const savings = service.cost * 0.3
            totalPotentialSavings += savings
            recommendations.push({
              category: 'data_transfer',
              subcategory: 'vpc_peering',
              service_name: 'Data Transfer',
              title: 'High data transfer costs detected',
              description: 'Data transfer accounts for over 20% of your MongoDB Atlas spend. Consider enabling VPC Peering or Private Endpoints to reduce cross-network data transfer charges.',
              action: 'Enable VPC Peering or AWS PrivateLink / Azure Private Link to reduce data transfer costs.',
              priority: 'medium',
              estimated_monthly_savings: savings,
              confidence: 'medium',
              current_cost: service.cost,
            })
          }

          // Flag high backup costs (>15% of total)
          if (service.name === 'Backup' && totalCost > 0 && service.cost / totalCost > 0.15) {
            const savings = service.cost * 0.2
            totalPotentialSavings += savings
            recommendations.push({
              category: 'storage_optimization',
              subcategory: 'backup_policy',
              service_name: 'Backup',
              title: 'Review backup retention policy',
              description: 'Backup costs are a significant portion of your MongoDB Atlas spend. Review your backup snapshot schedule and retention period to optimize costs.',
              action: 'Reduce backup frequency or retention period if business requirements allow.',
              priority: 'low',
              estimated_monthly_savings: savings,
              confidence: 'low',
              current_cost: service.cost,
            })
          }
        }
      }

      return {
        recommendations,
        totalPotentialSavings,
        recommendationCount: recommendations.length,
        source: 'mongodb',
      }
    } catch (error) {
      logger.warn('MongoDB Atlas: Could not generate recommendations', { error: error.message })
      return {
        recommendations: [],
        totalPotentialSavings: 0,
        recommendationCount: 0,
        source: 'mongodb',
      }
    }
  },
}
