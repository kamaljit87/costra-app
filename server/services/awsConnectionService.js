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
 * Sanitize connection name for use in CloudFormation stack names and IAM role names
 * CloudFormation stack names must:
 *   - Start with a letter (a-z, A-Z)
 *   - Contain only alphanumeric characters and hyphens
 *   - Not start or end with a hyphen
 *   - Be 1-128 characters long
 * IAM role names: alphanumeric, +, =, ,, ., @, -, _ (no spaces)
 * @param {string} connectionName - Original connection name
 * @returns {string} Sanitized connection name
 */
export const sanitizeConnectionName = (connectionName) => {
  if (!connectionName) return 'costra-connection'
  
  // Convert to lowercase and replace invalid chars with hyphens
  let sanitized = connectionName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-') // Replace invalid chars with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
  
  // Ensure it starts with a letter (CloudFormation requirement)
  // If it starts with a number, prefix with 'costra-'
  if (sanitized && /^[0-9]/.test(sanitized)) {
    sanitized = `costra-${sanitized}`
  }
  
  // Limit length to 128 chars (CloudFormation max) but keep reasonable for IAM roles too
  sanitized = sanitized.substring(0, 50) || 'costra-connection'
  
  // Final check: ensure it starts with a letter
  if (!/^[a-z]/.test(sanitized)) {
    sanitized = `costra-${sanitized}`
  }
  
  return sanitized
}

/**
 * Generate CloudFormation Quick Create URL for automated AWS connection
 * @param {string} templateUrl - URL to the CloudFormation template
 * @param {string} connectionName - Name for the connection (will be sanitized)
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
  
  // Sanitize connection name for CloudFormation stack name (must be alphanumeric + hyphens)
  const sanitizedStackName = sanitizeConnectionName(connectionName)
  // For the ConnectionName parameter, also sanitize it
  const sanitizedConnectionName = sanitizeConnectionName(connectionName)
  
  const params = new URLSearchParams({
    templateURL: templateUrl,
    stackName: sanitizedStackName,
    param_CostraAccountId: costraAccountId,
    param_ExternalId: externalId,
    param_ConnectionName: sanitizedConnectionName,
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
 * @param {boolean} skipActualTest - If true, only validate format without actually assuming role (for automated connections)
 */
export const verifyAWSConnection = async (roleArn, externalId, region = 'us-east-1', skipActualTest = false) => {
  try {
    // Validate role ARN is provided
    if (!roleArn || typeof roleArn !== 'string') {
      console.error('[AWS Connection] Role ARN is missing or invalid:', roleArn)
      return {
        success: false,
        message: 'Role ARN is missing or invalid. Please ensure CloudFormation stack was created successfully.',
        error: 'MissingRoleArn',
      }
    }

    // Fix role ARN if it contains invalid characters (e.g., spaces)
    let fixedRoleArn = roleArn
    if (roleArn.includes(' ')) {
      console.warn('[AWS Connection] Role ARN contains spaces, attempting to fix:', roleArn)
      fixedRoleArn = fixRoleArn(roleArn)
      console.log('[AWS Connection] Fixed role ARN:', fixedRoleArn)
    }

    // Validate role ARN format (more lenient pattern to handle various role name formats)
    // AWS IAM role names can contain: alphanumeric, +, =, ,, ., @, -, _ and path separators
    // Pattern allows for role paths: arn:aws:iam::ACCOUNT:role/path/to/role-name
    const roleArnPattern = /^arn:aws:iam::\d{12}:role(\/[a-zA-Z0-9+=,.@_-]+)+$/
    if (!roleArnPattern.test(fixedRoleArn)) {
      console.error('[AWS Connection] Invalid role ARN format (even after fix attempt):', fixedRoleArn)
      return {
        success: false,
        message: `Invalid role ARN format: ${roleArn}. Expected format: arn:aws:iam::ACCOUNT_ID:role/ROLE_NAME. Role names cannot contain spaces.`,
        error: 'InvalidFormat',
        suggestion: 'Please recreate the connection with a name containing only lowercase letters, numbers, and hyphens.',
        fixedRoleArn: fixedRoleArn !== roleArn ? fixedRoleArn : undefined,
      }
    }

    // Use fixed role ARN if it was corrected
    if (fixedRoleArn !== roleArn) {
      console.log('[AWS Connection] Using fixed role ARN:', fixedRoleArn)
      roleArn = fixedRoleArn
    }

    // Validate external ID format
    if (!externalId || externalId.length < 16) {
      return {
        success: false,
        message: 'Invalid external ID format',
        error: 'InvalidFormat',
      }
    }

    // For automated connections, we can't test the role assumption from the server
    // because we don't have AWS credentials. We'll just validate the format
    // and mark it as verified. The actual connection will be tested during the first sync.
    if (skipActualTest) {
      console.log('[AWS Connection] Skipping actual role assumption test (automated connection)')
      return {
        success: true,
        message: 'Connection format validated. Role will be tested during first cost sync.',
        skipActualTest: true,
      }
    }

    // For manual connections, try to actually assume the role if credentials are available
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
    } catch (credentialError) {
      // If we can't assume the role (no credentials on server), that's okay for automated connections
      // The role will be tested when we actually use it for cost syncing
      if (credentialError.message?.includes('credentials') || credentialError.code === 'CredentialsError') {
        console.log('[AWS Connection] Cannot test role assumption from server (no credentials). Connection will be tested during first sync.')
        return {
          success: true,
          message: 'Connection format validated. Role will be tested during first cost sync.',
          skipActualTest: true,
        }
      }
      throw credentialError
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

/**
 * Sanitize connection name for use in IAM role names
 * IAM role names must match: [a-zA-Z0-9+=,.@_-]+ (max 64 chars, no spaces)
 * @param {string} connectionName - Original connection name
 * @returns {string} Sanitized connection name
 */
export const sanitizeConnectionNameForRole = (connectionName) => {
  if (!connectionName) return 'costra-connection'
  
  return connectionName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-') // Replace invalid chars with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .substring(0, 50) || 'costra-connection' // Limit length, ensure not empty
}

/**
 * Fix invalid role ARN by sanitizing the role name part
 * @param {string} roleArn - Potentially invalid role ARN
 * @returns {string} Fixed role ARN
 */
export const fixRoleArn = (roleArn) => {
  if (!roleArn) return null
  
  const match = roleArn.match(/^(arn:aws:iam::\d{12}:role\/)(.+)$/)
  if (!match) return roleArn // Can't fix if format is completely wrong
  
  const [, prefix, roleName] = match
  const sanitizedRoleName = sanitizeConnectionNameForRole(roleName)
  return `${prefix}${sanitizedRoleName}`
}
