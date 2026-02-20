import express from 'express'
import { getContactSubmissions, getContactSubmissionById, updateContactSubmissionStatus } from '../database.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'
import logger from '../utils/logger.js'

const router = express.Router()

// All admin routes require authentication + admin role
router.use(authenticateToken, requireAdmin)

/**
 * GET /api/admin/tickets
 * List contact submissions with pagination and filters
 */
router.get('/tickets', async (req, res) => {
  try {
    const { status, category, page = '1', limit = '25' } = req.query
    const result = await getContactSubmissions({
      status: status || undefined,
      category: category || undefined,
      page: parseInt(page),
      limit: Math.min(parseInt(limit) || 25, 100),
    })
    res.json(result)
  } catch (error) {
    logger.error('Admin list tickets error', { error: error.message, stack: error.stack })
    res.status(500).json({ error: 'Failed to fetch tickets' })
  }
})

/**
 * GET /api/admin/tickets/:id
 * Get a single ticket by ID
 */
router.get('/tickets/:id', async (req, res) => {
  try {
    const ticket = await getContactSubmissionById(parseInt(req.params.id))
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })
    res.json({ ticket })
  } catch (error) {
    logger.error('Admin get ticket error', { id: req.params.id, error: error.message })
    res.status(500).json({ error: 'Failed to fetch ticket' })
  }
})

/**
 * PUT /api/admin/tickets/:id
 * Update ticket status
 */
router.put('/tickets/:id', async (req, res) => {
  try {
    const { status } = req.body
    const validStatuses = ['open', 'in_progress', 'resolved']
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` })
    }
    const updated = await updateContactSubmissionStatus(parseInt(req.params.id), status)
    if (!updated) return res.status(404).json({ error: 'Ticket not found' })
    res.json({ message: 'Status updated', ticket: updated })
  } catch (error) {
    logger.error('Admin update ticket error', { id: req.params.id, error: error.message })
    res.status(500).json({ error: 'Failed to update ticket' })
  }
})

export default router
