/**
 * Saved filter views (user_views)
 */
import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { getSavedViews, createSavedView, deleteSavedView } from '../database.js'
import logger from '../utils/logger.js'

const router = Router()
router.use(authenticateToken)

router.get('/', async (req, res) => {
  const userId = req.user?.userId || req.user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const views = await getSavedViews(userId)
    res.json({ views })
  } catch (error) {
    logger.error('GET saved views error', { userId, error: error.message })
    res.status(500).json({ error: 'Failed to load saved views' })
  }
})

router.post('/', async (req, res) => {
  const userId = req.user?.userId || req.user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })
  const { name, filters } = req.body || {}
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Name is required' })
  }
  try {
    const view = await createSavedView(userId, name.trim(), filters || {})
    res.status(201).json(view)
  } catch (error) {
    logger.error('POST saved view error', { userId, error: error.message })
    res.status(500).json({ error: 'Failed to save view' })
  }
})

router.delete('/:id', async (req, res) => {
  const userId = req.user?.userId || req.user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })
  const viewId = parseInt(req.params.id, 10)
  if (Number.isNaN(viewId)) return res.status(400).json({ error: 'Invalid view id' })
  try {
    const deleted = await deleteSavedView(userId, viewId)
    if (!deleted) return res.status(404).json({ error: 'View not found' })
    res.json({ message: 'View deleted' })
  } catch (error) {
    logger.error('DELETE saved view error', { userId, viewId, error: error.message })
    res.status(500).json({ error: 'Failed to delete view' })
  }
})

export default router
