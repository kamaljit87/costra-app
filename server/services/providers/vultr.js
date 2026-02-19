/**
 * Vultr Provider Adapter
 *
 * Re-exports Vultr functions from cloudProviderIntegrations and adds
 * credential validation plus daily data synthesis (Vultr only provides
 * invoice-level / monthly totals).
 */

import { fetchVultrCostData, fetchVultrServiceDetails } from '../cloudProviderIntegrations.js'
import logger from '../../utils/logger.js'

export default {
  id: 'vultr',
  aliases: [],
  name: 'Vultr',

  /**
   * Validate that the required Vultr API key is present.
   */
  validateCredentials(credentials) {
    if (!credentials) return false
    return !!credentials.apiKey
  },

  /**
   * Resolve credentials for a Vultr account.
   * Vultr uses direct API keys — no role assumption needed.
   */
  async resolveCredentials(account, accountData) {
    const creds = accountData.credentials || {}
    if (!creds || Object.keys(creds).length === 0) {
      return { credentials: null, error: 'Credentials not found' }
    }
    if (!this.validateCredentials(creds)) {
      return { credentials: null, error: 'Vultr credentials incomplete (requires apiKey)' }
    }
    return { credentials: creds, error: null }
  },

  /**
   * Fetch cost data from the Vultr API.
   */
  async fetchCostData(credentials, startDate, endDate) {
    return fetchVultrCostData(credentials, startDate, endDate)
  },

  /**
   * Synthesize daily cost data from the current month total.
   *
   * Vultr's API only returns invoice-level (monthly) data, not daily.
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

    logger.debug(`Vultr: synthesizing daily data — $${total} over ${daysElapsed} days ($${dailyCost}/day)`)

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
   * Fetch service-level detail from Vultr.
   */
  async fetchServiceDetails(credentials, serviceName, startDate, endDate) {
    return fetchVultrServiceDetails(credentials, serviceName, startDate, endDate)
  },

  /**
   * Fetch cost-optimization recommendations.
   * Vultr does not currently expose a recommendations API.
   */
  async fetchRecommendations(credentials, options) {
    return {
      recommendations: [],
      totalPotentialSavings: 0,
      recommendationCount: 0,
      source: 'vultr',
    }
  },
}
