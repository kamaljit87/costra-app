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
  pool,
} from '../database.js'
import {
  generateExternalId,
  generateCloudFormationQuickCreateUrl,
  verifyAWSConnection,
  healthCheckAWSConnection,
  extractAccountIdFromRoleArn,
} from '../services/awsConnectionService.js'

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
router.delete('/account/:accountId', async (req, res) => {
  try {
    const userId = req.user.userId
    const accountId = parseInt(req.params.accountId, 10)

    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' })
    }

    // Get account info before deletion for notification
    const account = await getCloudProviderCredentialsByAccountId(userId, accountId)
    const accountLabel = account?.accountAlias || account?.providerName || 'Cloud Provider Account'

    const deleted = await deleteCloudProviderByAccountId(userId, accountId)

    if (!deleted) {
      return res.status(404).json({ error: 'Cloud provider account not found' })
    }

    // Create notification for provider deletion
    try {
      await createNotification(userId, {
        type: 'info',
        title: 'Cloud Provider Removed',
        message: `${accountLabel} has been removed from your account`,
        link: '/settings',
        linkText: 'View Settings'
      })
    } catch (notifError) {
      logger.error('CloudProviders: Failed to create notification', { 
        userId, 
        error: notifError.message 
      })
    }

    res.json({ message: 'Cloud provider account deleted successfully' })
  } catch (error) {
    logger.error('Delete cloud provider account error', { 
      userId, 
      accountId, 
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

      // Sanitize connection name for CloudFormation and IAM role names
      // This ensures the stack name and role name are valid (no spaces, lowercase, etc.)
      const { sanitizeConnectionName } = await import('../services/awsConnectionService.js')
      const sanitizedConnectionName = sanitizeConnectionName(connectionName)

      // Generate external ID for secure access
      const externalId = generateExternalId()

      // Create pending connection record (store sanitized name for CloudFormation)
      const connection = await addAutomatedAWSConnection(
        userId,
        sanitizedConnectionName, // Use sanitized name for consistency
        awsAccountId,
        externalId,
        connectionType
      )

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
      
      // Use sanitized connection name for CloudFormation (already sanitized above)
      const quickCreateUrl = generateCloudFormationQuickCreateUrl(
        templateUrl,
        sanitizedConnectionName, // Use sanitized name for CloudFormation stack and parameters
        costraAccountId,
        externalId,
        awsAccountId
      )

      res.json({
        message: 'Automated connection initiated',
        connectionId: connection.id,
        connectionName: sanitizedConnectionName, // Return sanitized name
        originalConnectionName: connectionName, // Also return original for display
        quickCreateUrl,
        externalId, // For reference, user can copy if needed
        roleArn: connection.roleArn,
        instructions: {
          step1: 'Click the link above to open AWS CloudFormation Console',
          step2: 'Review the stack parameters (they are pre-filled)',
          step3: 'Scroll to the bottom, check the two capability checkboxes',
          step4: 'Click "Create stack"',
          step5: 'Wait for stack creation to complete (~2-5 minutes)',
          step6: 'Return here and click "Verify Connection"',
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

// Verify AWS connection after CloudFormation stack is created
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
    const roleArn = credentials.roleArn || account.roleArn
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

    // For automated connections, skip actual role assumption test (server doesn't have AWS credentials)
    // Just validate the format - the role will be tested during the first cost sync
    const isAutomatedConnection = account.connectionType?.startsWith('automated')
    const verification = await verifyAWSConnection(roleArn, externalId, 'us-east-1', isAutomatedConnection)
    
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

      res.json({
        message: verification.skipActualTest 
          ? 'Connection format validated. The role will be tested during the first cost sync.'
          : 'Connection verified successfully',
        status: 'healthy',
        roleArn,
        skipActualTest: verification.skipActualTest || false,
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

export default router
