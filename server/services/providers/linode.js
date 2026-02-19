/**
 * Linode (Akamai) Provider Adapter
 *
 * Re-exports Linode functions from cloudProviderIntegrations and adds
 * credential validation plus daily data synthesis (Linode only provides
 * invoice-level / monthly totals).
 */

import { fetchLinodeCostData, fetchLinodeServiceDetails } from '../cloudProviderIntegrations.js'
import logger from '../../utils/logger.js'

export default {
  id: 'linode',
  aliases: ['akamai'],
  name: 'Linode (Akamai)',

  /**
   * Validate that the required Linode API token is present.
   */
  validateCredentials(credentials) {
    if (!credentials || !credentials.apiToken) {
      return { valid: false, error: 'Linode API token is required' }
    }
    return { valid: true, error: null }
  },

  /**
   * Resolve credentials for a Linode account.
   * Linode uses direct API tokens — no role assumption needed.
   */
  async resolveCredentials(account, accountData) {
    if (!accountData.credentials || Object.keys(accountData.credentials).length === 0) {
      return { credentials: null, error: 'No Linode credentials configured for this account' }
    }
    return { credentials: accountData.credentials, error: null }
  },

  /**
   * Fetch cost data from the Linode API.
   */
  async fetchCostData(credentials, startDate, endDate) {
    return fetchLinodeCostData(credentials, startDate, endDate)
  },

  /**
   * Synthesize daily cost data from the current month total.
   *
   * Linode's API only returns invoice-level (monthly) data, not daily.
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

    logger.debug(`Linode: synthesizing daily data — $${total} over ${daysElapsed} days ($${dailyCost}/day)`)

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
   * Fetch service-level detail from Linode.
   */
  async fetchServiceDetails(credentials, serviceName, startDate, endDate) {
    return fetchLinodeServiceDetails(credentials, serviceName, startDate, endDate)
  },

  /**
   * Fetch cost-optimization recommendations.
   * Linode does not currently expose a recommendations API.
   */
  async fetchRecommendations(credentials) {
    return {
      recommendations: [],
      totalPotentialSavings: 0,
      recommendationCount: 0,
      source: 'linode',
    }
  },
}
