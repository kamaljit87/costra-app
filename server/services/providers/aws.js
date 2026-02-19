/**
 * AWS Provider Adapter
 * Re-exports AWS functions from cloudProviderIntegrations and adds
 * STS role-assumption credential resolution for automated connections.
 */

import {
  fetchAWSCostData,
  fetchAWSServiceDetails,
  fetchAWSRightsizingRecommendations,
  fetchAWSMonthlyTotal,
} from '../cloudProviderIntegrations.js'
import logger from '../../utils/logger.js'

export default {
  id: 'aws',
  aliases: ['amazon'],
  name: 'Amazon Web Services',

  /**
   * Validate that the minimum required AWS credentials are present.
   */
  validateCredentials(credentials) {
    if (!credentials) return false
    return !!(credentials.accessKeyId && credentials.secretAccessKey)
  },

  /**
   * Resolve credentials for an AWS account.
   * For automated connections (connectionType starts with 'automated'),
   * assumes an IAM role via STS. Otherwise returns credentials as-is.
   *
   * @returns {{ credentials: object, error: string|null }}
   */
  async resolveCredentials(account, accountData) {
    let credentialsToUse = accountData.credentials || {}

    if (accountData.connectionType?.startsWith('automated')) {
      logger.info('Automated AWS connection detected', { accountId: account.id })

      if (!accountData.roleArn || !accountData.externalId) {
        logger.warn('Missing roleArn or externalId for automated connection', { accountId: account.id })
        return { credentials: null, error: 'Automated connection missing role ARN or external ID' }
      }

      try {
        const { STSClient, AssumeRoleCommand } = await import('@aws-sdk/client-sts')
        const stsClient = new STSClient({ region: 'us-east-1' })
        const assumeRoleCommand = new AssumeRoleCommand({
          RoleArn: accountData.roleArn,
          RoleSessionName: `costra-sync-${account.id}-${Date.now()}`,
          ExternalId: accountData.externalId,
          DurationSeconds: 3600,
        })

        logger.info('Assuming role for automated connection', { accountId: account.id, roleArn: accountData.roleArn })
        const assumeRoleResponse = await stsClient.send(assumeRoleCommand)

        if (!assumeRoleResponse.Credentials) {
          throw new Error('Failed to assume role: No credentials returned')
        }

        credentialsToUse = {
          accessKeyId: assumeRoleResponse.Credentials.AccessKeyId,
          secretAccessKey: assumeRoleResponse.Credentials.SecretAccessKey,
          sessionToken: assumeRoleResponse.Credentials.SessionToken,
          region: 'us-east-1',
        }
        logger.info('Successfully assumed role', { accountId: account.id })
      } catch (assumeError) {
        logger.error('Failed to assume role for automated connection', {
          accountId: account.id,
          error: assumeError.message,
          stack: assumeError.stack,
          code: assumeError.code,
        })

        let errorMessage = assumeError.message || assumeError.code || 'Unknown error'
        if (assumeError.message?.includes('Could not load credentials') || assumeError.code === 'CredentialsError') {
          errorMessage = 'Server AWS credentials not configured. The server needs AWS credentials (from AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY environment variables or IAM instance profile) to assume the role in your AWS account. Please configure server-side AWS credentials.'
        } else if (assumeError.code === 'AccessDenied') {
          errorMessage = 'Access denied when assuming role. Please verify: 1) The CloudFormation stack was created successfully, 2) The role ARN is correct, 3) The external ID matches, 4) Costra\'s AWS account has permission to assume the role.'
        } else if (assumeError.code === 'InvalidClientTokenId') {
          errorMessage = 'Invalid AWS credentials. Please check that the server\'s AWS credentials are valid and have permission to assume roles.'
        }

        return { credentials: null, error: errorMessage }
      }
    } else if (!credentialsToUse || Object.keys(credentialsToUse).length === 0) {
      logger.warn('No credentials found', { accountId: account.id })
      return { credentials: null, error: 'Credentials not found' }
    } else if (!credentialsToUse.accessKeyId || !credentialsToUse.secretAccessKey) {
      logger.warn('AWS credentials incomplete (missing accessKeyId or secretAccessKey)', { accountId: account.id })
      return { credentials: null, error: 'AWS credentials invalid (missing Access Key ID or Secret Access Key)' }
    }

    return { credentials: credentialsToUse, error: null }
  },

  /**
   * Fetch daily cost data from AWS Cost Explorer.
   */
  async fetchCostData(credentials, startDate, endDate) {
    return fetchAWSCostData(credentials, startDate, endDate)
  },

  /**
   * AWS already provides real daily granularity — no synthesis needed.
   */
  synthesizeDailyData(costData, startDate, endDate) {
    return null
  },

  /**
   * Fetch per-service usage details from AWS Cost Explorer.
   */
  async fetchServiceDetails(credentials, serviceName, startDate, endDate) {
    return fetchAWSServiceDetails(credentials, serviceName, startDate, endDate)
  },

  /**
   * Fetch rightsizing recommendations from AWS Cost Explorer.
   */
  async fetchRecommendations(credentials, options) {
    return fetchAWSRightsizingRecommendations(credentials, options)
  },

  /**
   * Fetch the accurate monthly total for a given month/year.
   */
  async fetchMonthlyTotal(credentials, month, year) {
    return fetchAWSMonthlyTotal(credentials, month, year)
  },
}
