/**
 * Spend goals (user_goals)
 */
import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { getGoals, createGoal, deleteGoal, getGoalProgress } from '../database.js'
import logger from '../utils/logger.js'

const router = Router()
router.use(authenticateToken)

router.get('/', async (req, res) => {
  const userId = req.user?.userId || req.user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const goals = await getGoals(userId)
    res.json({ goals })
  } catch (error) {
    logger.error('GET goals error', { userId, error: error.message })
    res.status(500).json({ error: 'Failed to load goals' })
  }
})

router.post('/', async (req, res) => {
  const userId = req.user?.userId || req.user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })
  const body = req.body || {}
  const target_value = parseFloat(body.target_value)
  if (Number.isNaN(target_value) || target_value < 0) {
    return res.status(400).json({ error: 'Valid target_value is required' })
  }
  try {
    const goal = await createGoal(userId, {
      name: body.name,
      target_type: body.target_type || 'percent_reduction',
      target_value,
      baseline: body.baseline || 'same_period_last_year',
      period: body.period || 'quarter',
    })
    res.status(201).json(goal)
  } catch (error) {
    logger.error('POST goal error', { userId, error: error.message })
    res.status(500).json({ error: 'Failed to create goal' })
  }
})

router.get('/:id/progress', async (req, res) => {
  const userId = req.user?.userId || req.user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })
  const id = parseInt(req.params.id, 10)
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid goal id' })
  try {
    const progress = await getGoalProgress(userId, id)
    if (!progress) return res.status(404).json({ error: 'Goal not found' })
    res.json(progress)
  } catch (error) {
    logger.error('GET goal progress error', { userId, id, error: error.message })
    res.status(500).json({ error: 'Failed to get progress' })
  }
})

router.delete('/:id', async (req, res) => {
  const userId = req.user?.userId || req.user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })
  const id = parseInt(req.params.id, 10)
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid goal id' })
  try {
    const deleted = await deleteGoal(userId, id)
    if (!deleted) return res.status(404).json({ error: 'Goal not found' })
    res.json({ message: 'Goal deleted' })
  } catch (error) {
    logger.error('DELETE goal error', { userId, id, error: error.message })
    res.status(500).json({ error: 'Failed to delete goal' })
  }
})

export default router
