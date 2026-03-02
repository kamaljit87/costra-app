import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { attachOrg } from '../middleware/orgAuth.js'
import logger from '../utils/logger.js'
import {
  createAllocationRule,
  getAllocationRules,
  updateAllocationRule,
  deleteAllocationRule,
} from '../database.js'

const router = express.Router()
router.use(authenticateToken, attachOrg)

// GET /api/allocations
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const rules = await getAllocationRules(userId, req.orgId)
    res.json({ rules })
  } catch (error) {
    logger.error('Error listing allocation rules', { error: error.message })
    res.status(500).json({ error: 'Failed to list allocation rules' })
  }
})

// POST /api/allocations
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { name, description, sourceFilter, splitMethod, splitTargets } = req.body
    if (!name || !splitMethod || !splitTargets) {
      return res.status(400).json({ error: 'name, splitMethod, and splitTargets are required' })
    }
    const rule = await createAllocationRule(userId, req.orgId, { name, description, sourceFilter, splitMethod, splitTargets })
    res.status(201).json({ rule })
  } catch (error) {
    logger.error('Error creating allocation rule', { error: error.message })
    res.status(500).json({ error: 'Failed to create allocation rule' })
  }
})

// PUT /api/allocations/:id
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const rule = await updateAllocationRule(parseInt(req.params.id), userId, req.body)
    if (!rule) return res.status(404).json({ error: 'Allocation rule not found' })
    res.json({ rule })
  } catch (error) {
    logger.error('Error updating allocation rule', { error: error.message })
    res.status(500).json({ error: 'Failed to update allocation rule' })
  }
})

// DELETE /api/allocations/:id
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const result = await deleteAllocationRule(parseInt(req.params.id), userId)
    if (!result) return res.status(404).json({ error: 'Allocation rule not found' })
    res.json({ message: 'Allocation rule deleted' })
  } catch (error) {
    logger.error('Error deleting allocation rule', { error: error.message })
    res.status(500).json({ error: 'Failed to delete allocation rule' })
  }
})

// POST /api/allocations/preview
router.post('/preview', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { sourceFilter, splitMethod, splitTargets } = req.body
    // Return a preview of how costs would be split
    // This is a simplified preview - actual allocation happens during report generation
    const targets = splitTargets || []
    const preview = targets.map((t, i) => ({
      target: t.name || t.team || `Target ${i + 1}`,
      percentage: splitMethod === 'even' ? (100 / targets.length).toFixed(1) : (t.percentage || 0),
      method: splitMethod,
    }))
    res.json({ preview })
  } catch (error) {
    logger.error('Error previewing allocation', { error: error.message })
    res.status(500).json({ error: 'Failed to preview allocation' })
  }
})

export default router
