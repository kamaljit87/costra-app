import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { attachOrg } from '../middleware/orgAuth.js'
import logger from '../utils/logger.js'
import {
  createWorkflowItem,
  getWorkflowItems,
  getWorkflowItem,
  updateWorkflowItemStatus,
  addWorkflowComment,
  getWorkflowComments,
} from '../database.js'

const router = express.Router()
router.use(authenticateToken, attachOrg)

// GET /api/workflows
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { status, type, assignee } = req.query
    const items = await getWorkflowItems(userId, req.orgId, {
      status: status || undefined,
      type: type || undefined,
      assigneeUserId: assignee ? parseInt(assignee) : undefined,
    })
    res.json({ items })
  } catch (error) {
    logger.error('Error listing workflow items', { error: error.message })
    res.status(500).json({ error: 'Failed to list workflow items' })
  }
})

// GET /api/workflows/:id
router.get('/:id', async (req, res) => {
  try {
    const item = await getWorkflowItem(parseInt(req.params.id), req.orgId)
    if (!item) return res.status(404).json({ error: 'Workflow item not found' })
    const comments = await getWorkflowComments(item.id)
    res.json({ item, comments })
  } catch (error) {
    logger.error('Error getting workflow item', { error: error.message })
    res.status(500).json({ error: 'Failed to get workflow item' })
  }
})

// POST /api/workflows
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { type, title, description, assigneeUserId, relatedId, relatedType, metadata } = req.body
    if (!type || !title) return res.status(400).json({ error: 'type and title are required' })
    const item = await createWorkflowItem(userId, req.orgId, { type, title, description, assigneeUserId, relatedId, relatedType, metadata })
    res.status(201).json({ item })
  } catch (error) {
    logger.error('Error creating workflow item', { error: error.message })
    res.status(500).json({ error: 'Failed to create workflow item' })
  }
})

// PUT /api/workflows/:id
router.put('/:id', async (req, res) => {
  try {
    const { status, assigneeUserId } = req.body
    const item = await updateWorkflowItemStatus(parseInt(req.params.id), req.orgId, { status, assigneeUserId })
    if (!item) return res.status(404).json({ error: 'Workflow item not found' })
    res.json({ item })
  } catch (error) {
    logger.error('Error updating workflow item', { error: error.message })
    res.status(500).json({ error: 'Failed to update workflow item' })
  }
})

// POST /api/workflows/:id/comments
router.post('/:id/comments', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { comment } = req.body
    if (!comment) return res.status(400).json({ error: 'comment is required' })
    const item = await getWorkflowItem(parseInt(req.params.id), req.orgId)
    if (!item) return res.status(404).json({ error: 'Workflow item not found' })
    const newComment = await addWorkflowComment(item.id, userId, comment)
    res.status(201).json({ comment: newComment })
  } catch (error) {
    logger.error('Error adding comment', { error: error.message })
    res.status(500).json({ error: 'Failed to add comment' })
  }
})

export default router
