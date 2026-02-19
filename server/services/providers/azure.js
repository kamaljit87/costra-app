/**
 * Azure Provider Adapter
 *
 * Re-exports Azure functions from cloudProviderIntegrations and adds
 * credential validation. Azure provides real daily granularity, so
 * no daily data synthesis is needed.
 */

import {
  fetchAzureCostData,
  fetchAzureServiceDetails,
  fetchAzureRightsizingRecommendations,
} from '../cloudProviderIntegrations.js'
import logger from '../../utils/logger.js'

export default {
  id: 'azure',
  aliases: ['microsoft', 'msft'],
  name: 'Microsoft Azure',

  /**
   * Validate that the required Azure credentials are present.
   */
  validateCredentials(credentials) {
    if (!credentials) return false
    return !!(credentials.tenantId && credentials.clientId && credentials.clientSecret && credentials.subscriptionId)
  },

  /**
   * Resolve credentials for an Azure account.
   * Azure uses direct service principal credentials — no role assumption needed.
   */
  async resolveCredentials(account, accountData) {
    const creds = accountData.credentials || {}
    if (!creds || Object.keys(creds).length === 0) {
      return { credentials: null, error: 'Credentials not found' }
    }
    if (!this.validateCredentials(creds)) {
      return { credentials: null, error: 'Azure credentials incomplete (requires tenantId, clientId, clientSecret, subscriptionId)' }
    }
    return { credentials: creds, error: null }
  },

  /**
   * Fetch daily cost data from Azure Cost Management.
   */
  async fetchCostData(credentials, startDate, endDate) {
    return fetchAzureCostData(credentials, startDate, endDate)
  },

  /**
   * Azure already provides real daily granularity — no synthesis needed.
   */
  synthesizeDailyData(costData, startDate, endDate) {
    return null
  },

  /**
   * Fetch per-service usage details from Azure Cost Management.
   */
  async fetchServiceDetails(credentials, serviceName, startDate, endDate) {
    return fetchAzureServiceDetails(credentials, serviceName, startDate, endDate)
  },

  /**
   * Fetch rightsizing recommendations from Azure Advisor.
   */
  async fetchRecommendations(credentials, options) {
    return fetchAzureRightsizingRecommendations(credentials, options)
  },
}
