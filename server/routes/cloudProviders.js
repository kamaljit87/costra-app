import express from 'express'
import { body, validationResult } from 'express-validator'
import { authenticateToken } from '../middleware/auth.js'
import {
  addCloudProvider,
  getUserCloudProviders,
  deleteCloudProvider,
  updateCloudProviderStatus,
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
      providerId: provider.provider_id,
      providerName: provider.provider_name,
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

// Add a new cloud provider
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
      const { providerId, providerName, credentials } = req.body

      await addCloudProvider(userId, providerId, providerName, credentials)

      res.json({ 
        message: 'Cloud provider added successfully',
        provider: {
          providerId,
          providerName,
        }
      })
    } catch (error) {
      console.error('Add cloud provider error:', error)
      res.status(500).json({ error: error.message || 'Internal server error' })
    }
  }
)

// Delete a cloud provider
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

// Toggle provider active status
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
