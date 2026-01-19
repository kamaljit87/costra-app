import express from 'express'
import { body, validationResult } from 'express-validator'
import { authenticateToken } from '../middleware/auth.js'
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
} from '../database.js'

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
      createdAt: provider.created_at,
      updatedAt: provider.updated_at,
    }))

    res.json({ providers: formattedProviders })
  } catch (error) {
    console.error('Get cloud providers error:', error)
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
      console.error('Add cloud provider error:', error)
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

    const deleted = await deleteCloudProviderByAccountId(userId, accountId)

    if (!deleted) {
      return res.status(404).json({ error: 'Cloud provider account not found' })
    }

    res.json({ message: 'Cloud provider account deleted successfully' })
  } catch (error) {
    console.error('Delete cloud provider account error:', error)
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
    console.error('Delete cloud provider error:', error)
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
    console.error('Update cloud provider account status error:', error)
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
    console.error('Update account alias error:', error)
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
    console.error('Get account credentials error:', error)
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

      await updateCloudProviderCredentials(userId, accountId, credentials)

      res.json({ 
        message: 'Account credentials updated successfully'
      })
    } catch (error) {
      console.error('Update account credentials error:', error)
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
    console.error('Update cloud provider status error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
