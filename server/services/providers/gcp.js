/**
 * GCP Provider Adapter
 *
 * Re-exports GCP functions from cloudProviderIntegrations and adds
 * credential validation. GCP provides real daily granularity via
 * BigQuery billing export, so no daily data synthesis is needed.
 */

import {
  fetchGCPCostData,
  fetchGCPServiceDetails,
  fetchGCPRightsizingRecommendations,
} from '../cloudProviderIntegrations.js'
import logger from '../../utils/logger.js'

export default {
  id: 'gcp',
  aliases: ['google', 'googlecloud'],
  name: 'Google Cloud Platform',

  /**
   * Validate that the required GCP credentials are present.
   */
  validateCredentials(credentials) {
    if (!credentials) return false
    return !!(credentials.projectId && (credentials.serviceAccountKey || credentials.credentials))
  },

  /**
   * Resolve credentials for a GCP account.
   * GCP uses service account keys — no role assumption needed.
   */
  async resolveCredentials(account, accountData) {
    const creds = accountData.credentials || {}
    if (!creds || Object.keys(creds).length === 0) {
      return { credentials: null, error: 'Credentials not found' }
    }
    if (!this.validateCredentials(creds)) {
      return { credentials: null, error: 'GCP credentials incomplete (requires projectId and serviceAccountKey)' }
    }
    return { credentials: creds, error: null }
  },

  /**
   * Fetch daily cost data from GCP Billing.
   */
  async fetchCostData(credentials, startDate, endDate) {
    return fetchGCPCostData(credentials, startDate, endDate)
  },

  /**
   * GCP already provides real daily granularity — no synthesis needed.
   */
  synthesizeDailyData(costData, startDate, endDate) {
    return null
  },

  /**
   * Fetch per-service usage details from GCP Billing.
   */
  async fetchServiceDetails(credentials, serviceName, startDate, endDate) {
    return fetchGCPServiceDetails(credentials, serviceName, startDate, endDate)
  },

  /**
   * Fetch rightsizing recommendations from GCP Recommender.
   */
  async fetchRecommendations(credentials, options) {
    return fetchGCPRightsizingRecommendations(credentials, options)
  },
}
