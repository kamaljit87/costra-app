/**
 * User API keys (create/list/delete). Requires JWT; API keys cannot manage keys.
 */
import { Router } from 'express'
import crypto from 'node:crypto'
import { requireJwt } from '../middleware/auth.js'
import { getApiKeys, createApiKey, deleteApiKey } from '../database.js'
import { logger } from '../logger.js'

const router = Router()
router.use(requireJwt)

router.get('/', async (req, res) => {
  const userId = req.user?.userId || req.user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const keys = await getApiKeys(userId)
    res.json({ keys })
  } catch (error) {
    logger.error('GET api-keys error', { userId, error: error.message })
    res.status(500).json({ error: 'Failed to list API keys' })
  }
})

router.post('/', async (req, res) => {
  const userId = req.user?.userId || req.user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })
  const name = (req.body && req.body.name) ? String(req.body.name).trim() || null : null
  const rawKey = 'costra_' + crypto.randomBytes(32).toString('hex')
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
  const keyPrefix = rawKey.slice(0, 15) + '...'
  try {
    const row = await createApiKey(userId, name, keyHash, keyPrefix)
    res.status(201).json({ id: row.id, name: row.name, key_prefix: row.key_prefix, created_at: row.created_at, key: rawKey })
  } catch (error) {
    logger.error('POST api-keys error', { userId, error: error.message })
    res.status(500).json({ error: 'Failed to create API key' })
  }
})

router.delete('/:id', async (req, res) => {
  const userId = req.user?.userId || req.user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })
  const id = parseInt(req.params.id, 10)
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid key id' })
  try {
    const deleted = await deleteApiKey(userId, id)
    if (!deleted) return res.status(404).json({ error: 'API key not found' })
    res.json({ message: 'API key deleted' })
  } catch (error) {
    logger.error('DELETE api-keys error', { userId, id, error: error.message })
    res.status(500).json({ error: 'Failed to delete API key' })
  }
})

export default router
