/**
 * AWS CloudFormation Callback Route (Public — no auth)
 *
 * Called by the Lambda Custom Resource in the CloudFormation template
 * when the stack finishes creating. This lets Costra automatically
 * verify and activate the connection without frontend polling.
 *
 * Security: The externalId acts as a shared secret. Only requests
 * whose externalId matches a pending connection in Redis are processed.
 */

import express from 'express'
import logger from '../utils/logger.js'
import * as cache from '../utils/cache.js'
import {
  addAutomatedAWSConnection,
  updateAWSConnectionStatus,
  getUserCloudProviders,
  getExistingAWSConnection,
  createNotification,
} from '../database.js'
import {
  verifyAWSConnection,
  sanitizeConnectionName,
} from '../services/awsConnectionService.js'
import { getMaxProviderAccounts } from '../services/subscriptionService.js'

const router = express.Router()

/**
 * POST /api/aws-callback
 * Called by CloudFormation Lambda when the stack completes.
 * No auth token — secured by externalId matching a pending connection.
 */
router.post('/', async (req, res) => {
  try {
    const { accountId, externalId, roleArn, connectionName, region, stackName } = req.body

    if (!externalId || !roleArn || !accountId) {
      logger.warn('AWS Callback: Missing required fields', { accountId, hasExternalId: !!externalId, hasRoleArn: !!roleArn })
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Look up pending connection by externalId
    const cacheKey = `pending-aws-connection:${externalId}`
    const pending = await cache.get(cacheKey)

    if (!pending) {
      logger.warn('AWS Callback: No pending connection found for externalId', { externalId: externalId.substring(0, 16) + '...' })
      return res.status(404).json({ error: 'No pending connection found. It may have expired or already been processed.' })
    }

    const { userId, connectionType, awsAccountId } = pending

    // Verify the AWS account ID matches
    if (awsAccountId !== accountId) {
      logger.warn('AWS Callback: Account ID mismatch', { expected: awsAccountId, received: accountId })
      return res.status(400).json({ error: 'Account ID mismatch' })
    }

    // Check for duplicate (may have been created by manual verify while Lambda was running)
    const existingConnection = await getExistingAWSConnection(userId, awsAccountId)
    if (existingConnection) {
      logger.info('AWS Callback: Connection already exists, skipping', { userId, awsAccountId })
      await cache.del(cacheKey)
      // Update the status in Redis so frontend knows it's done
      await cache.set(`aws-connection-status:${externalId}`, { status: 'connected', accountId: existingConnection.id }, 600)
      return res.json({ message: 'Connection already exists', accountId: existingConnection.id })
    }

    // Check account limit
    const existingProviders = await getUserCloudProviders(userId)
    const maxAccounts = await getMaxProviderAccounts(userId)
    if (existingProviders.length >= maxAccounts) {
      logger.warn('AWS Callback: Account limit reached', { userId, current: existingProviders.length, max: maxAccounts })
      await cache.set(`aws-connection-status:${externalId}`, { status: 'error', error: 'Account limit reached' }, 600)
      return res.status(403).json({ error: 'Account limit reached' })
    }

    // Verify the connection via STS
    const verification = await verifyAWSConnection(roleArn, externalId, region || 'us-east-1')

    if (!verification.success) {
      logger.error('AWS Callback: Verification failed', { roleArn, error: verification.message })
      await cache.set(`aws-connection-status:${externalId}`, { status: 'error', error: verification.message }, 600)
      return res.status(400).json({ error: verification.message })
    }

    // Create the database record
    const sanitizedName = sanitizeConnectionName(connectionName || pending.connectionName)
    const billingType = (connectionType || 'automated-billing').replace('automated-', '')
    const connection = await addAutomatedAWSConnection(
      userId,
      sanitizedName,
      awsAccountId,
      externalId,
      billingType
    )

    // Update status to healthy
    await updateAWSConnectionStatus(userId, connection.id, 'healthy', {
      roleArn,
      externalId,
      temporaryCredentials: verification.credentials,
    })

    // Store status so frontend can pick it up
    await cache.set(`aws-connection-status:${externalId}`, {
      status: 'connected',
      accountId: connection.id,
      connectionName: sanitizedName,
    }, 600)

    // Clean up the pending connection from cache
    await cache.del(cacheKey)

    // Create notification
    try {
      await createNotification(userId, {
        type: 'success',
        title: 'AWS Connection Verified',
        message: `AWS account "${sanitizedName}" is now connected and ready to sync cost data.`,
        link: '/settings',
        linkText: 'View Settings',
      })
    } catch (notifError) {
      logger.error('AWS Callback: Failed to create notification', { error: notifError.message })
    }

    // Auto-setup CUR export (non-blocking)
    try {
      const { setupCURExport } = await import('../services/curService.js')
      const curResult = await setupCURExport(userId, connection.id, roleArn, externalId, awsAccountId, sanitizedName)
      logger.info('CUR export setup via callback', { userId, accountId: connection.id, curStatus: curResult.status })
    } catch (curError) {
      logger.error('CUR setup failed via callback (non-blocking)', {
        userId, accountId: connection.id,
        error: curError.message || String(curError),
      })
    }

    logger.info('AWS Callback: Connection created successfully', {
      userId, accountId: connection.id, awsAccountId, connectionName: sanitizedName,
    })

    res.json({
      message: 'Connection created successfully',
      accountId: connection.id,
      status: 'healthy',
    })
  } catch (error) {
    logger.error('AWS Callback error', { error: error.message, stack: error.stack })
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
