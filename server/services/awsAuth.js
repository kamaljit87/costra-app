/**
 * Shared AWS STS AssumeRole utility.
 * Extracted from sync.js for reuse across CUR, Cost Explorer, and other AWS services.
 */

import logger from '../utils/logger.js'

/**
 * Assume an IAM role and return temporary credentials.
 * @param {string} roleArn - The ARN of the role to assume
 * @param {string} externalId - External ID for cross-account access
 * @param {string} sessionName - A unique name for this session
 * @returns {Promise<{accessKeyId: string, secretAccessKey: string, sessionToken: string, region: string}>}
 */
export const getAssumedRoleCredentials = async (roleArn, externalId, sessionName) => {
  if (!roleArn || !externalId) {
    throw new Error('roleArn and externalId are required for role assumption')
  }

  const { STSClient, AssumeRoleCommand } = await import('@aws-sdk/client-sts')
  const stsClient = new STSClient({ region: 'us-east-1' })

  const command = new AssumeRoleCommand({
    RoleArn: roleArn,
    RoleSessionName: sessionName,
    ExternalId: externalId,
    DurationSeconds: 3600,
  })

  logger.debug('Assuming role', { roleArn, sessionName })
  const response = await stsClient.send(command)

  if (!response.Credentials) {
    throw new Error('Failed to assume role: No credentials returned')
  }

  return {
    accessKeyId: response.Credentials.AccessKeyId,
    secretAccessKey: response.Credentials.SecretAccessKey,
    sessionToken: response.Credentials.SessionToken,
    region: 'us-east-1',
  }
}
