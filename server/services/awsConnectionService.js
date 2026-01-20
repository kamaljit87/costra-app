import crypto from 'crypto'
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts'
import { CostExplorerClient, GetCostAndUsageCommand } from '@aws-sdk/client-cost-explorer'

/**
 * Generate a secure external ID for cross-account IAM role assumption
 */
export const generateExternalId = () => {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Generate CloudFormation Quick Create URL for automated AWS connection
 * @param {string} templateUrl - URL to the CloudFormation template
 * @param {string} connectionName - Name for the connection
 * @param {string} costraAccountId - Costra's AWS account ID
 * @param {string} externalId - External ID for secure access
 * @param {string} awsAccountId - User's AWS account ID (optional, can be entered in console)
 */
export const generateCloudFormationQuickCreateUrl = (
  templateUrl,
  connectionName,
  costraAccountId,
  externalId,
  awsAccountId = null
) => {
  const baseUrl = 'https://console.aws.amazon.com/cloudformation/home'
  const region = 'us-east-1' // Default region, user can change in console
  
  const params = new URLSearchParams({
    templateURL: templateUrl,
    stackName: connectionName,
    param_CostraAccountId: costraAccountId,
    param_ExternalId: externalId,
    param_ConnectionName: connectionName,
  })
  
  if (awsAccountId) {
    params.append('param_AwsAccountId', awsAccountId)
  }
  
  return `${baseUrl}?region=${region}#/stacks/create/review?${params.toString()}`
}

/**
 * Verify AWS connection by attempting to assume the IAM role
 * @param {string} roleArn - ARN of the IAM role to assume
 * @param {string} externalId - External ID for secure access
 * @param {string} region - AWS region (default: us-east-1)
 */
export const verifyAWSConnection = async (roleArn, externalId, region = 'us-east-1') => {
  try {
    // Create STS client with default credentials (for initial connection test)
    const stsClient = new STSClient({ region })
    
    // Attempt to assume the role
    const assumeRoleCommand = new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: `costra-connection-verify-${Date.now()}`,
      ExternalId: externalId,
      DurationSeconds: 900, // 15 minutes
    })
    
    const assumeRoleResponse = await stsClient.send(assumeRoleCommand)
    
    if (!assumeRoleResponse.Credentials) {
      throw new Error('Failed to assume role: No credentials returned')
    }
    
    // Test Cost Explorer access with assumed role credentials
    const costExplorerClient = new CostExplorerClient({
      region,
      credentials: {
        accessKeyId: assumeRoleResponse.Credentials.AccessKeyId,
        secretAccessKey: assumeRoleResponse.Credentials.SecretAccessKey,
        sessionToken: assumeRoleResponse.Credentials.SessionToken,
      },
    })
    
    // Make a minimal Cost Explorer API call to verify permissions
    const today = new Date()
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1)
    const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    
    const costCommand = new GetCostAndUsageCommand({
      TimePeriod: {
        Start: startDate.toISOString().split('T')[0],
        End: endDate.toISOString().split('T')[0],
      },
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost'],
    })
    
    await costExplorerClient.send(costCommand)
    
    return {
      success: true,
      message: 'Connection verified successfully',
      credentials: {
        accessKeyId: assumeRoleResponse.Credentials.AccessKeyId,
        secretAccessKey: assumeRoleResponse.Credentials.SecretAccessKey,
        sessionToken: assumeRoleResponse.Credentials.SessionToken,
        expiration: assumeRoleResponse.Credentials.Expiration,
      },
    }
  } catch (error) {
    console.error('[AWS Connection] Verification failed:', error)
    return {
      success: false,
      message: error.message || 'Connection verification failed',
      error: error.code || 'UnknownError',
    }
  }
}

/**
 * Health check for AWS connection
 * @param {string} roleArn - ARN of the IAM role
 * @param {string} externalId - External ID
 * @param {string} region - AWS region
 */
export const healthCheckAWSConnection = async (roleArn, externalId, region = 'us-east-1') => {
  try {
    const result = await verifyAWSConnection(roleArn, externalId, region)
    return {
      healthy: result.success,
      lastChecked: new Date().toISOString(),
      message: result.message,
    }
  } catch (error) {
    return {
      healthy: false,
      lastChecked: new Date().toISOString(),
      message: error.message || 'Health check failed',
    }
  }
}

/**
 * Extract AWS account ID from IAM role ARN
 * @param {string} roleArn - IAM role ARN
 */
export const extractAccountIdFromRoleArn = (roleArn) => {
  const match = roleArn.match(/arn:aws:iam::(\d{12}):role\//)
  return match ? match[1] : null
}
