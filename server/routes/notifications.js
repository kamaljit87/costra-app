import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import logger from '../utils/logger.js'
import {
  createNotification,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteOldNotifications
} from '../database.js'
import { parsePagination, createPaginationMeta, createPaginatedResponse } from '../utils/pagination.js'

const router = express.Router()

// All routes require authentication
router.use(authenticateToken)

/**
 * GET /api/notifications
 * Get notifications for the authenticated user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { unreadOnly, type } = req.query

    // Parse pagination (default: 30 per page for notifications)
    const { page, limit, offset } = parsePagination(req, { page: 1, limit: 30, maxLimit: 100 })

    const result = await getNotifications(userId, {
      unreadOnly: unreadOnly === 'true',
      limit,
      offset,
      type: type || null,
      includeTotal: true, // Request total count for pagination
    })

    const notifications = result.notifications || result
    const total = result.total || notifications.length

    // Create pagination metadata
    const pagination = createPaginationMeta(page, limit, total)

    // Return paginated response
    res.json(createPaginatedResponse(notifications, pagination))
  } catch (error) {
    logger.error('Notifications: Error fetching notifications', { 
      userId: req.user?.userId || req.user?.id, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to fetch notifications' })
  }
})

/**
 * GET /api/notifications/count
 * Get unread notification count
 */
router.get('/count', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const count = await getUnreadNotificationCount(userId)
    res.json({ count })
  } catch (error) {
    logger.error('Notifications: Error fetching notification count', { 
      userId, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to fetch notification count' })
  }
})

/**
 * POST /api/notifications
 * Create a new notification
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { type, title, message, link, linkText, metadata } = req.body

    if (!type || !title) {
      return res.status(400).json({ error: 'Type and title are required' })
    }

    const notification = await createNotification(userId, {
      type,
      title,
      message,
      link,
      linkText,
      metadata
    })

    res.status(201).json({ notification })
  } catch (error) {
    logger.error('Notifications: Error creating notification', { 
      userId, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to create notification' })
  }
})

/**
 * PUT /api/notifications/:id/read
 * Mark a notification as read
 */
router.put('/:id/read', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const notificationId = parseInt(req.params.id, 10)

    if (isNaN(notificationId)) {
      return res.status(400).json({ error: 'Invalid notification ID' })
    }

    await markNotificationAsRead(userId, notificationId)
    res.json({ success: true })
  } catch (error) {
    logger.error('Notifications: Error marking notification as read', { 
      userId, 
      notificationId: req.params.id, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to mark notification as read' })
  }
})

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    await markAllNotificationsAsRead(userId)
    res.json({ success: true })
  } catch (error) {
    logger.error('Notifications: Error marking all notifications as read', { 
      userId, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to mark all notifications as read' })
  }
})

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const notificationId = parseInt(req.params.id, 10)

    if (isNaN(notificationId)) {
      return res.status(400).json({ error: 'Invalid notification ID' })
    }

    await deleteNotification(userId, notificationId)
    res.json({ success: true })
  } catch (error) {
    logger.error('Notifications: Error deleting notification', { 
      userId, 
      notificationId: req.params.id, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to delete notification' })
  }
})

/**
 * DELETE /api/notifications/old
 * Delete old read notifications
 */
router.delete('/old', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const daysOld = parseInt(req.query.days || 30, 10)

    const deletedCount = await deleteOldNotifications(userId, daysOld)
    res.json({ deletedCount })
  } catch (error) {
    logger.error('Notifications: Error deleting old notifications', { 
      userId, 
      daysOld, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to delete old notifications' })
  }
})

export default router
