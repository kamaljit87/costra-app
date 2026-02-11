import express from 'express'
import { body, validationResult } from 'express-validator'
import { authenticateToken } from '../middleware/auth.js'
import logger from '../utils/logger.js'
import {
  addCloudProvider,
  getUserCloudProviders,
  deleteCloudProvider,
  deleteCloudProviderByAccountId,
  updateCloudProviderStatus,
  updateCloudProviderStatusByAccountId,
  updateCloudProviderAlias,
  updateCloudProviderCredentials,
  getCloudProviderCredentialsByAccountId,
  createNotification,
  addAutomatedAWSConnection,
  updateAWSConnectionStatus,
  getExistingAWSConnection,
  pool,
} from '../database.js'
import {
  generateExternalId,
  generateCloudFormationQuickCreateUrl,
  verifyAWSConnection,
  healthCheckAWSConnection,
  extractAccountIdFromRoleArn,
  computeRoleArn,
} from '../services/awsConnectionService.js'
import { getMaxProviderAccounts } from '../services/subscriptionService.js'
import { verifyConnectionLimiter } from '../middleware/rateLimiter.js'
import * as cache from '../utils/cache.js'

const router = express.Router()

// All routes require authentication
router.use(authenticateToken)

// Get all cloud providers for current user
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId
    const providers = await getUserCloudProviders(userId)

    // Format response (don't include encrypted credentials)
    const formattedProviders = providers.map(provider => ({
      id: provider.id,
      accountId: provider.id, // Include account ID explicitly
      providerId: provider.provider_id,
      providerName: provider.provider_name,
      accountAlias: provider.account_alias || provider.provider_name,
      isActive: provider.is_active,
      lastSyncAt: provider.last_sync_at,
      connectionType: provider.connection_type || 'manual',
      connectionStatus: provider.connection_status || 'pending',
      awsAccountId: provider.aws_account_id,
      lastHealthCheck: provider.last_health_check,
      createdAt: provider.created_at,
      updatedAt: provider.updated_at,
    }))

    res.json({ providers: formattedProviders })
  } catch (error) {
    logger.error('Get cloud providers error', { 
      userId: req.user?.userId, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Add a new cloud provider (supports multiple accounts per provider)
router.post('/',
  [
    body('providerId').notEmpty().withMessage('Provider ID is required'),
    body('providerName').notEmpty().withMessage('Provider name is required'),
    body('credentials').isObject().withMessage('Credentials must be an object'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const userId = req.user.userId
      const { providerId, providerName, credentials, accountAlias } = req.body

      // Check provider account limit for user's plan
      const existingProviders = await getUserCloudProviders(userId)
      const maxAccounts = await getMaxProviderAccounts(userId)
      if (existingProviders.length >= maxAccounts) {
        return res.status(403).json({
          error: `Your current plan allows up to ${maxAccounts} cloud provider account${maxAccounts !== 1 ? 's' : ''}. Please upgrade to Pro for unlimited accounts.`,
          code: 'ACCOUNT_LIMIT_REACHED',
          currentCount: existingProviders.length,
          maxAllowed: maxAccounts,
        })
      }

      const accountId = await addCloudProvider(userId, providerId, providerName, credentials, accountAlias)

      // Create notification for provider addition
      try {
        await createNotification(userId, {
          type: 'success',
          title: 'Cloud Provider Added',
          message: `${providerName} account "${accountAlias || providerName}" has been added successfully. You can now sync cost data.`,
          link: '/settings',
          linkText: 'View Settings'
        })
      } catch (notifError) {
        logger.error('CloudProviders: Failed to create notification', { 
          userId, 
          error: notifError.message 
        })
      }

      res.json({ 
        message: 'Cloud provider account added successfully',
        provider: {
          accountId,
          providerId,
          providerName,
          accountAlias: accountAlias || `${providerName} Account`,
        }
      })
    } catch (error) {
      logger.error('Add cloud provider error', { 
        userId, 
        providerId, 
        providerName, 
        error: error.message, 
        stack: error.stack 
      })
      res.status(500).json({ error: error.message || 'Internal server error' })
    }
  }
)

// Delete a cloud provider account by account ID
// Pass ?cleanupAWS=true to also delete CloudFormation stack, S3 bucket, and BCM export
router.delete('/account/:accountId', async (req, res) => {
  try {
    const userId = req.user.userId
    const accountId = parseInt(req.params.accountId, 10)
    const cleanupAWS = req.query.cleanupAWS === 'true'

    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' })
    }

    // Get account info before deletion for cleanup and notification
    const account = await getCloudProviderCredentialsByAccountId(userId, accountId)
    if (!account) {
      return res.status(404).json({ error: 'Cloud provider account not found' })
    }

    const accountLabel = account.accountAlias || account.providerName || 'Cloud Provider Account'
    let cleanupResults = null

    // If requested, clean up AWS resources before deleting from DB
    if (cleanupAWS && account.roleArn && account.externalId && account.awsAccountId) {
      try {
        const { cleanupAWSResources } = await import('../services/curService.js')
        const { sanitizeConnectionName } = await import('../services/awsConnectionService.js')
        const sanitizedName = sanitizeConnectionName(account.accountAlias || '')

        logger.info('Starting AWS resource cleanup', { userId, accountId, sanitizedName, awsAccountId: account.awsAccountId })
        cleanupResults = await cleanupAWSResources(
          account.roleArn,
          account.externalId,
          account.awsAccountId,
          sanitizedName
        )
        logger.info('AWS resource cleanup completed', { userId, accountId, results: cleanupResults })
      } catch (cleanupError) {
        logger.error('AWS resource cleanup failed (proceeding with DB deletion)', {
          userId, accountId,
          error: cleanupError.message || String(cleanupError),
        })
        cleanupResults = { results: [], errors: [{ step: 'cleanup', error: cleanupError.message || String(cleanupError) }] }
      }
    }

    const deleted = await deleteCloudProviderByAccountId(userId, accountId)

    if (!deleted) {
      return res.status(404).json({ error: 'Cloud provider account not found' })
    }

    // Create notification for provider deletion
    try {
      const cleanupNote = cleanupAWS ? ' AWS resources are being cleaned up.' : ''
      await createNotification(userId, {
        type: 'info',
        title: 'Cloud Provider Removed',
        message: `${accountLabel} has been removed from your account.${cleanupNote}`,
        link: '/settings',
        linkText: 'View Settings'
      })
    } catch (notifError) {
      logger.error('CloudProviders: Failed to create notification', {
        userId,
        error: notifError.message
      })
    }

    res.json({
      message: 'Cloud provider account deleted successfully',
      cleanup: cleanupResults,
    })
  } catch (error) {
    logger.error('Delete cloud provider account error', {
      userId: req.user?.userId,
      accountId: req.params?.accountId,
      error: error.message,
      stack: error.stack
    })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Legacy: Delete all accounts of a provider type
router.delete('/:providerId', async (req, res) => {
  try {
    const userId = req.user.userId
    const { providerId } = req.params

    const deleted = await deleteCloudProvider(userId, providerId)

    if (!deleted) {
      return res.status(404).json({ error: 'Cloud provider not found' })
    }

    res.json({ message: 'Cloud provider deleted successfully' })
  } catch (error) {
    logger.error('Delete cloud provider error', { 
      userId, 
      providerId, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Toggle account active status by account ID
router.patch('/account/:accountId/status', async (req, res) => {
  try {
    const userId = req.user.userId
    const accountId = parseInt(req.params.accountId, 10)
    const { isActive } = req.body

    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' })
    }

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean' })
    }

    await updateCloudProviderStatusByAccountId(userId, accountId, isActive)

    res.json({ 
      message: `Cloud provider account ${isActive ? 'activated' : 'deactivated'} successfully` 
    })
  } catch (error) {
    logger.error('Update cloud provider account status error', { 
      userId, 
      accountId, 
      isActive, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update account alias
router.patch('/account/:accountId/alias', async (req, res) => {
  try {
    const userId = req.user.userId
    const accountId = parseInt(req.params.accountId, 10)
    const { accountAlias } = req.body

    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' })
    }

    if (!accountAlias || typeof accountAlias !== 'string') {
      return res.status(400).json({ error: 'accountAlias must be a non-empty string' })
    }

    await updateCloudProviderAlias(userId, accountId, accountAlias)

    res.json({ 
      message: 'Account alias updated successfully',
      accountAlias
    })
  } catch (error) {
    logger.error('Update account alias error', { 
      userId, 
      accountId, 
      accountAlias, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get account credentials (for editing)
router.get('/account/:accountId/credentials', async (req, res) => {
  try {
    const userId = req.user.userId
    const accountId = parseInt(req.params.accountId, 10)

    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' })
    }

    const account = await getCloudProviderCredentialsByAccountId(userId, accountId)

    if (!account) {
      return res.status(404).json({ error: 'Cloud provider account not found' })
    }

    res.json({ 
      accountId: account.accountId,
      providerId: account.providerId,
      providerName: account.providerName,
      accountAlias: account.accountAlias,
      credentials: account.credentials
    })
  } catch (error) {
    logger.error('Get account credentials error', { 
      userId, 
      accountId, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update account credentials
router.patch('/account/:accountId/credentials', 
  [
    body('credentials').isObject().withMessage('Credentials must be an object'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const userId = req.user.userId
      const accountId = parseInt(req.params.accountId, 10)
      const { credentials } = req.body

      if (isNaN(accountId)) {
        return res.status(400).json({ error: 'Invalid account ID' })
      }

      // Get account info for notification
      const account = await getCloudProviderCredentialsByAccountId(userId, accountId)
      const accountLabel = account?.accountAlias || account?.providerName || 'Cloud Provider Account'

      await updateCloudProviderCredentials(userId, accountId, credentials)

      // Create notification for credentials update
      try {
        await createNotification(userId, {
          type: 'info',
          title: 'Credentials Updated',
          message: `Credentials for ${accountLabel} have been updated successfully`,
          link: '/settings',
          linkText: 'View Settings'
        })
      } catch (notifError) {
        logger.error('CloudProviders: Failed to create notification', { 
          userId, 
          error: notifError.message 
        })
      }

      res.json({ 
        message: 'Account credentials updated successfully'
      })
    } catch (error) {
      logger.error('Update account credentials error', { 
        userId, 
        accountId, 
        error: error.message, 
        stack: error.stack 
      })
      res.status(500).json({ error: error.message || 'Internal server error' })
    }
  }
)

// Legacy: Toggle provider active status by provider ID
router.patch('/:providerId/status', async (req, res) => {
  try {
    const userId = req.user.userId
    const { providerId } = req.params
    const { isActive } = req.body

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean' })
    }

    await updateCloudProviderStatus(userId, providerId, isActive)

    res.json({ 
      message: `Cloud provider ${isActive ? 'activated' : 'deactivated'} successfully` 
    })
  } catch (error) {
    logger.error('Update cloud provider status error', { 
      userId, 
      providerId, 
      isActive, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// AWS Automated Connection Routes

// Initiate automated AWS connection (CloudFormation)
router.post('/aws/automated',
  [
    body('connectionName').notEmpty().withMessage('Connection name is required'),
    body('awsAccountId').matches(/^\d{12}$/).withMessage('AWS Account ID must be 12 digits'),
    body('connectionType').optional().isIn(['billing', 'resource']).withMessage('Connection type must be billing or resource'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const userId = req.user.userId || req.user.id
      const { connectionName, awsAccountId, connectionType = 'billing' } = req.body

      // Check provider account limit for user's plan
      const existingProviders = await getUserCloudProviders(userId)
      const maxAccounts = await getMaxProviderAccounts(userId)
      if (existingProviders.length >= maxAccounts) {
        return res.status(403).json({
          error: `Your current plan allows up to ${maxAccounts} cloud provider account${maxAccounts !== 1 ? 's' : ''}. Please upgrade to Pro for unlimited accounts.`,
          code: 'ACCOUNT_LIMIT_REACHED',
          currentCount: existingProviders.length,
          maxAllowed: maxAccounts,
        })
      }

      // Sanitize connection name for CloudFormation and IAM role names
      // This ensures the stack name and role name are valid (no spaces, lowercase, etc.)
      const { sanitizeConnectionName } = await import('../services/awsConnectionService.js')
      const sanitizedConnectionName = sanitizeConnectionName(connectionName)

      // Check if this AWS account is already connected
      const existingConnection = await getExistingAWSConnection(userId, awsAccountId)
      if (existingConnection) {
        return res.status(409).json({
          error: `An active connection for AWS account ${awsAccountId} already exists ("${existingConnection.account_alias}").`,
          code: 'DUPLICATE_ACCOUNT',
        })
      }

      // Generate external ID for secure access
      const externalId = generateExternalId()

      // Compute the role ARN without creating a database record
      // The record will be created only after successful verification
      const roleArn = computeRoleArn(awsAccountId, sanitizedConnectionName)

      // Generate CloudFormation Quick Create URL
      // The template must be hosted at a publicly accessible HTTPS URL
      // Options: S3 bucket with public read, GitHub raw content (public repo), or any public HTTPS URL
      const templateUrl = process.env.CLOUDFORMATION_TEMPLATE_URL
      
      if (!templateUrl) {
        return res.status(400).json({ 
          error: 'CloudFormation template URL not configured',
          message: 'The CloudFormation template URL must be configured to use automated connections.',
          details: 'Please set CLOUDFORMATION_TEMPLATE_URL environment variable in server/.env. The template must be hosted at a publicly accessible HTTPS URL.',
          options: [
            {
              name: 'S3 Bucket (Recommended)',
              steps: [
                '1. Upload cloudformation/aws-billing-connection.yml to an S3 bucket',
                '2. Make it publicly readable (put-object-acl --acl public-read)',
                '3. Use URL: https://your-bucket.s3.amazonaws.com/aws-billing-connection.yml'
              ]
            },
            {
              name: 'GitHub (Public Repo)',
              steps: [
                '1. Push template to a public GitHub repository',
                '2. Use raw content URL: https://raw.githubusercontent.com/org/repo/main/cloudformation/aws-billing-connection.yml'
              ]
            },
            {
              name: 'Alternative',
              steps: [
                'Use "Simple (API Keys)" or "Advanced (CUR + Role)" connection methods instead',
                'These do not require a CloudFormation template URL'
              ]
            }
          ],
          templateLocation: 'cloudformation/aws-billing-connection.yml',
          documentation: 'See CLOUDFORMATION_SETUP.md for detailed instructions'
        })
      }
      
      const costraAccountId = process.env.COSTRA_AWS_ACCOUNT_ID || '061190967865' // Example, replace with your account ID
      
      // Store pending connection in Redis so the callback can look it up
      const pendingData = {
        userId,
        connectionName: sanitizedConnectionName,
        awsAccountId,
        connectionType: `automated-${connectionType}`,
        roleArn,
        createdAt: new Date().toISOString(),
      }
      await cache.set(`pending-aws-connection:${externalId}`, pendingData, 1800) // 30 min TTL

      // Build callback URL for the CloudFormation Lambda
      const callbackBaseUrl = process.env.COSTRA_API_URL || process.env.API_BASE_URL || ''

      // Use sanitized connection name for CloudFormation (already sanitized above)
      const quickCreateUrl = generateCloudFormationQuickCreateUrl(
        templateUrl,
        sanitizedConnectionName,
        costraAccountId,
        externalId,
        callbackBaseUrl ? `${callbackBaseUrl}/api/aws-callback` : '',
      )

      res.json({
        message: 'Automated connection ready for CloudFormation deployment',
        connectionName: sanitizedConnectionName,
        originalConnectionName: connectionName,
        quickCreateUrl,
        externalId,
        roleArn,
        awsAccountId,
        connectionType: `automated-${connectionType}`,
        hasCallback: !!callbackBaseUrl,
        instructions: {
          step1: 'Click the link above to open AWS CloudFormation Console',
          step2: 'Review the stack parameters (they are pre-filled)',
          step3: 'Scroll to the bottom, check the capability checkboxes',
          step4: 'Click "Create stack"',
          step5: 'Wait for stack creation to complete (~2-5 minutes)',
          step6: callbackBaseUrl ? 'Your connection will be verified automatically!' : 'Return here and click "Verify Connection"',
        },
      })
    } catch (error) {
      logger.error('Initiate automated AWS connection error', { 
        userId, 
        connectionName, 
        awsAccountId, 
        connectionType, 
        error: error.message, 
        stack: error.stack 
      })
      res.status(500).json({ error: error.message || 'Internal server error' })
    }
  }
)

// Verify and create automated AWS connection (new flow: no DB record until verification succeeds)
router.post('/aws/automated/verify',
  verifyConnectionLimiter,
  [
    body('connectionName').notEmpty().withMessage('Connection name is required'),
    body('awsAccountId').matches(/^\d{12}$/).withMessage('AWS Account ID must be 12 digits'),
    body('roleArn').matches(/^arn:aws:iam::\d{12}:role\/.+$/).withMessage('Invalid role ARN'),
    body('externalId').isLength({ min: 16 }).withMessage('Invalid external ID'),
    body('connectionType').optional().isIn(['automated-billing', 'automated-resource']).withMessage('Invalid connection type'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const userId = req.user.userId || req.user.id
      const { connectionName, awsAccountId, roleArn, externalId, connectionType = 'automated-billing' } = req.body

      // Check for duplicate AWS account
      const existingConnection = await getExistingAWSConnection(userId, awsAccountId)
      if (existingConnection) {
        return res.status(409).json({
          error: `An active connection for AWS account ${awsAccountId} already exists ("${existingConnection.account_alias}").`,
          code: 'DUPLICATE_ACCOUNT',
        })
      }

      // Check provider account limit
      const existingProviders = await getUserCloudProviders(userId)
      const maxAccounts = await getMaxProviderAccounts(userId)
      if (existingProviders.length >= maxAccounts) {
        return res.status(403).json({
          error: `Your current plan allows up to ${maxAccounts} cloud provider account${maxAccounts !== 1 ? 's' : ''}. Please upgrade to Pro for unlimited accounts.`,
          code: 'ACCOUNT_LIMIT_REACHED',
        })
      }

      // Actually verify the role via STS AssumeRole
      const verification = await verifyAWSConnection(roleArn, externalId, 'us-east-1')

      if (!verification.success) {
        return res.status(400).json({
          error: verification.message || 'Connection verification failed. Please ensure the CloudFormation stack has completed successfully.',
          status: 'error',
          details: verification.error,
        })
      }

      // Verification succeeded — now create the database record
      const billingType = connectionType.replace('automated-', '')
      const connection = await addAutomatedAWSConnection(
        userId,
        connectionName,
        awsAccountId,
        externalId,
        billingType
      )

      // Update status to healthy with temporary credentials
      await updateAWSConnectionStatus(
        userId,
        connection.id,
        'healthy',
        {
          roleArn,
          externalId,
          temporaryCredentials: verification.credentials,
        }
      )

      // Create success notification
      try {
        await createNotification(userId, {
          type: 'success',
          title: 'AWS Connection Verified',
          message: `AWS account "${connectionName}" is now connected and ready to sync cost data.`,
          link: '/settings',
          linkText: 'View Settings',
        })
      } catch (notifError) {
        logger.error('AWS Connection: Failed to create notification', {
          userId,
          error: notifError.message,
        })
      }

      // Auto-setup CUR export
      let curStatus = null
      try {
        const { setupCURExport } = await import('../services/curService.js')
        const { sanitizeConnectionName: sanitizeName } = await import('../services/awsConnectionService.js')
        const sanitizedName = sanitizeName(connectionName)
        const curResult = await setupCURExport(
          userId,
          connection.id,
          roleArn,
          externalId,
          awsAccountId,
          sanitizedName
        )
        curStatus = curResult.status
        logger.info('CUR export setup initiated after verification', { userId, accountId: connection.id, curStatus })
      } catch (curError) {
        logger.error('CUR setup failed (non-blocking)', {
          userId,
          accountId: connection.id,
          error: curError.message || curError.Code || String(curError),
          code: curError.name || curError.Code,
          stack: curError.stack,
        })
      }

      res.json({
        message: 'Connection verified and created successfully',
        accountId: connection.id,
        status: 'healthy',
        roleArn,
        curStatus,
      })
    } catch (error) {
      logger.error('Verify and create automated AWS connection error', {
        error: error.message,
        stack: error.stack,
      })
      res.status(500).json({ error: error.message || 'Internal server error' })
    }
  }
)

// Check if a pending automated connection has been activated by the Lambda callback
// Lightweight — just checks Redis, no STS call
router.get('/aws/automated/status/:externalId', async (req, res) => {
  try {
    const externalId = req.params.externalId
    if (!externalId || externalId.length < 16) {
      return res.status(400).json({ error: 'Invalid external ID' })
    }

    // Check if the callback has created the connection
    const status = await cache.get(`aws-connection-status:${externalId}`)
    if (status) {
      return res.json(status)
    }

    // Check if the pending connection still exists (not yet processed)
    const pending = await cache.get(`pending-aws-connection:${externalId}`)
    if (pending) {
      return res.json({ status: 'pending' })
    }

    // Neither found — expired or never existed
    return res.json({ status: 'unknown' })
  } catch (error) {
    logger.error('AWS connection status check error', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Verify existing AWS connection (re-verification / legacy pending records)
router.post('/aws/:accountId/verify', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const accountIdParam = req.params.accountId
    
    // Validate accountId is a valid integer (not an encrypted string)
    if (!accountIdParam || accountIdParam.length > 20 || !/^\d+$/.test(accountIdParam)) {
      logger.error('AWS Connection: Invalid accountId format', { 
        userId, 
        accountIdParam 
      })
      return res.status(400).json({ 
        error: 'Invalid account ID format',
        details: 'Account ID must be a numeric value. Please refresh the page and try again.'
      })
    }
    
    const accountId = parseInt(accountIdParam, 10)

    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' })
    }

    // Get connection details
    const account = await getCloudProviderCredentialsByAccountId(userId, accountId)
    if (!account) {
      return res.status(404).json({ error: 'Connection not found' })
    }

    // Extract connection metadata from credentials or use stored values
    const credentials = account.credentials || {}
    let roleArn = credentials.roleArn || account.roleArn
    const externalId = credentials.externalId || account.externalId

    logger.debug('AWS Connection: Verification request', {
      accountId,
      roleArn,
      hasExternalId: !!externalId,
      connectionType: account.connectionType,
    })

    if (!roleArn) {
      return res.status(400).json({ 
        error: 'Role ARN is missing. Please ensure CloudFormation stack was created successfully and the stack outputs contain the RoleArn.',
        details: 'The CloudFormation stack should have created an IAM role. Please verify the stack completed successfully.'
      })
    }

    if (!externalId) {
      return res.status(400).json({ 
        error: 'External ID is missing. Please ensure the connection was initiated correctly.',
        details: 'The external ID should have been generated when you clicked "Add Account".'
      })
    }

    // Always perform real STS role assumption test
    const verification = await verifyAWSConnection(roleArn, externalId, 'us-east-1')
    
    // If role ARN was fixed (e.g., had spaces), update it in the database
    if (verification.fixedRoleArn && verification.fixedRoleArn !== roleArn) {
      logger.info('AWS Connection: Updating role ARN in database', {
        accountId,
        oldRoleArn: roleArn,
        newRoleArn: verification.fixedRoleArn
      })
      const client = await pool.connect()
      try {
        await client.query(
          `UPDATE cloud_provider_credentials 
           SET role_arn = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2 AND user_id = $3`,
          [verification.fixedRoleArn, accountId, userId]
        )
        roleArn = verification.fixedRoleArn // Use the fixed ARN for the rest of the function
      } catch (updateError) {
        logger.error('AWS Connection: Failed to update role ARN', { 
          accountId, 
          error: updateError.message 
        })
      } finally {
        client.release()
      }
    }

    if (verification.success) {
      // Update connection status and store temporary credentials
      await updateAWSConnectionStatus(
        userId,
        accountId,
        'healthy',
        {
          roleArn,
          externalId,
          // Store temporary credentials (they expire, but useful for initial sync)
          temporaryCredentials: verification.credentials,
        }
      )

      // Create success notification
      try {
        await createNotification(userId, {
          type: 'success',
          title: 'AWS Connection Verified',
          message: `AWS account "${account.accountAlias || account.providerName}" is now connected and ready to sync cost data.`,
          link: '/settings',
          linkText: 'View Settings',
        })
      } catch (notifError) {
        logger.error('AWS Connection: Failed to create notification', { 
          userId, 
          error: notifError.message 
        })
      }

      // Auto-setup CUR (Cost and Usage Reports) for penny-perfect billing data
      let curStatus = null
      try {
        const { setupCURExport } = await import('../services/curService.js')
        const { sanitizeConnectionName: sanitizeName } = await import('../services/awsConnectionService.js')
        const connectionName = sanitizeName(account.accountAlias || account.providerName || 'default')
        const curResult = await setupCURExport(
          userId,
          accountId,
          roleArn,
          externalId,
          account.awsAccountId,
          connectionName
        )
        curStatus = curResult.status
        logger.info('CUR export setup initiated after verification', { userId, accountId, curStatus })
      } catch (curError) {
        // CUR setup failure should NOT fail connection verification
        logger.error('CUR setup failed (non-blocking)', { userId, accountId, error: curError.message })
      }

      res.json({
        message: 'Connection verified successfully',
        status: 'healthy',
        roleArn,
        curStatus,
      })
    } else {
      // Update status to error
      await updateAWSConnectionStatus(userId, accountId, 'error')

      res.status(400).json({
        error: verification.message || 'Connection verification failed',
        status: 'error',
        details: verification.error,
      })
    }
  } catch (error) {
    logger.error('Verify AWS connection error', { 
      userId, 
      accountId, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

// Health check for AWS connection
router.get('/aws/:accountId/health', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const accountId = parseInt(req.params.accountId, 10)

    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' })
    }

    const account = await getCloudProviderCredentialsByAccountId(userId, accountId)
    if (!account) {
      return res.status(404).json({ error: 'Connection not found' })
    }

    const credentials = account.credentials || {}
    const roleArn = credentials.roleArn || account.roleArn
    const externalId = credentials.externalId || account.externalId

    if (!roleArn || !externalId) {
      return res.status(400).json({ 
        error: 'Connection metadata missing' 
      })
    }

    const health = await healthCheckAWSConnection(roleArn, externalId)
    
    // Update status in database
    await updateAWSConnectionStatus(
      userId,
      accountId,
      health.healthy ? 'healthy' : 'error'
    )

    res.json(health)
  } catch (error) {
    logger.error('AWS connection health check error', { 
      userId, 
      accountId, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

// Get CUR status for an AWS account
router.get('/aws/:accountId/cur-status', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const accountId = parseInt(req.params.accountId, 10)
    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' })
    }

    const { getCURStatus } = await import('../services/curService.js')
    const status = await getCURStatus(userId, accountId)
    res.json(status)
  } catch (error) {
    logger.error('Get CUR status error', { userId: req.user?.userId, accountId: req.params?.accountId, error: error.message })
    res.status(500).json({ error: 'Failed to get CUR status' })
  }
})

// Manually trigger CUR setup (for existing connections or retry after error)
router.post('/aws/:accountId/cur-setup', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const accountId = parseInt(req.params.accountId, 10)
    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' })
    }

    const account = await getCloudProviderCredentialsByAccountId(userId, accountId)
    if (!account) {
      return res.status(404).json({ error: 'Connection not found' })
    }

    if (!account.roleArn || !account.externalId) {
      return res.status(400).json({ error: 'CUR requires an automated (IAM role) connection. Manual access key connections do not support CUR.' })
    }

    const { setupCURExport } = await import('../services/curService.js')
    const { sanitizeConnectionName } = await import('../services/awsConnectionService.js')
    const connectionName = sanitizeConnectionName(account.accountAlias || account.providerName || 'default')

    const result = await setupCURExport(
      userId,
      accountId,
      account.roleArn,
      account.externalId,
      account.awsAccountId,
      connectionName
    )

    res.json({ message: 'CUR setup initiated', ...result })
  } catch (error) {
    logger.error('CUR setup error', { userId: req.user?.userId, accountId: req.params?.accountId, error: error.message })
    res.status(500).json({ error: error.message || 'Failed to set up CUR' })
  }
})

// Clean up orphaned AWS resources (stack, role, export) before re-creating a connection
// S3 bucket is always preserved — it may contain valuable CUR data and will be reused
router.post('/aws/cleanup-orphaned',
  [
    body('awsAccountId').matches(/^\d{12}$/).withMessage('AWS Account ID must be 12 digits'),
    body('connectionName').notEmpty().withMessage('Connection name is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const userId = req.user.userId || req.user.id
      const { awsAccountId, connectionName } = req.body
      const { sanitizeConnectionName } = await import('../services/awsConnectionService.js')
      const sanitizedName = sanitizeConnectionName(connectionName)

      // Try to find an old connection for this AWS account to get the old role/externalId
      // We look at all the user's providers for a matching awsAccountId
      const allProviders = await getUserCloudProviders(userId)
      const oldConnection = allProviders.find(p => p.aws_account_id === awsAccountId)

      if (oldConnection) {
        // We have old credentials — try full cleanup
        const account = await getCloudProviderCredentialsByAccountId(userId, oldConnection.id)
        if (account?.roleArn && account?.externalId) {
          const { cleanupAWSResources } = await import('../services/curService.js')
          const result = await cleanupAWSResources(account.roleArn, account.externalId, awsAccountId, sanitizedName)
          logger.info('Orphaned resource cleanup with old credentials', { userId, awsAccountId, result })
          return res.json({ message: 'Cleanup completed', ...result })
        }
      }

      // No old credentials available — just return ok, stack will be created fresh
      // The S3 bucket (if it exists) will be reused by setupCURExport
      res.json({
        message: 'No previous connection found. S3 bucket will be reused if it exists.',
        results: [],
        errors: [],
      })
    } catch (error) {
      logger.error('Orphaned resource cleanup error', { error: error.message, stack: error.stack })
      res.status(500).json({ error: error.message || 'Cleanup failed' })
    }
  }
)

export default router
