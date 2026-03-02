import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { attachOrg } from '../middleware/orgAuth.js'
import logger from '../utils/logger.js'
import {
  createDashboard,
  getDashboards,
  getDashboard,
  updateDashboard,
  deleteDashboard,
  addWidget,
  getWidgets,
  updateWidget,
  removeWidget,
  getSharedDashboards,
  pool,
} from '../database.js'

const router = express.Router()
router.use(authenticateToken, attachOrg)

// GET /api/dashboards
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const dashboards = await getDashboards(userId, req.orgId)
    res.json({ dashboards })
  } catch (error) {
    logger.error('Error listing dashboards', { error: error.message })
    res.status(500).json({ error: 'Failed to list dashboards' })
  }
})

// GET /api/dashboards/shared
router.get('/shared', async (req, res) => {
  try {
    const shared = await getSharedDashboards(req.orgId)
    res.json({ dashboards: shared })
  } catch (error) {
    logger.error('Error listing shared dashboards', { error: error.message })
    res.status(500).json({ error: 'Failed to list shared dashboards' })
  }
})

// POST /api/dashboards
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { name, description } = req.body
    if (!name) return res.status(400).json({ error: 'name is required' })
    const dashboard = await createDashboard(userId, req.orgId, { name, description })
    res.status(201).json({ dashboard })
  } catch (error) {
    logger.error('Error creating dashboard', { error: error.message })
    res.status(500).json({ error: 'Failed to create dashboard' })
  }
})

// GET /api/dashboards/:id
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const dashboard = await getDashboard(parseInt(req.params.id), userId, req.orgId)
    if (!dashboard) return res.status(404).json({ error: 'Dashboard not found' })
    const widgets = await getWidgets(dashboard.id)
    res.json({ dashboard, widgets })
  } catch (error) {
    logger.error('Error getting dashboard', { error: error.message })
    res.status(500).json({ error: 'Failed to get dashboard' })
  }
})

// PUT /api/dashboards/:id
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const dashboard = await updateDashboard(parseInt(req.params.id), userId, req.body)
    if (!dashboard) return res.status(404).json({ error: 'Dashboard not found' })
    res.json({ dashboard })
  } catch (error) {
    logger.error('Error updating dashboard', { error: error.message })
    res.status(500).json({ error: 'Failed to update dashboard' })
  }
})

// DELETE /api/dashboards/:id
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const result = await deleteDashboard(parseInt(req.params.id), userId)
    if (!result) return res.status(404).json({ error: 'Dashboard not found' })
    res.json({ message: 'Dashboard deleted' })
  } catch (error) {
    logger.error('Error deleting dashboard', { error: error.message })
    res.status(500).json({ error: 'Failed to delete dashboard' })
  }
})

// POST /api/dashboards/:id/widgets
router.post('/:id/widgets', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const dashboard = await getDashboard(parseInt(req.params.id), userId, req.orgId)
    if (!dashboard) return res.status(404).json({ error: 'Dashboard not found' })
    const { widgetType, title, config, position } = req.body
    if (!widgetType || !title) return res.status(400).json({ error: 'widgetType and title are required' })
    const widget = await addWidget(dashboard.id, { widgetType, title, config, position })
    res.status(201).json({ widget })
  } catch (error) {
    logger.error('Error adding widget', { error: error.message })
    res.status(500).json({ error: 'Failed to add widget' })
  }
})

// PUT /api/dashboards/:id/widgets/:widgetId
router.put('/:id/widgets/:widgetId', async (req, res) => {
  try {
    const widget = await updateWidget(parseInt(req.params.widgetId), parseInt(req.params.id), req.body)
    if (!widget) return res.status(404).json({ error: 'Widget not found' })
    res.json({ widget })
  } catch (error) {
    logger.error('Error updating widget', { error: error.message })
    res.status(500).json({ error: 'Failed to update widget' })
  }
})

// DELETE /api/dashboards/:id/widgets/:widgetId
router.delete('/:id/widgets/:widgetId', async (req, res) => {
  try {
    const result = await removeWidget(parseInt(req.params.widgetId), parseInt(req.params.id))
    if (!result) return res.status(404).json({ error: 'Widget not found' })
    res.json({ message: 'Widget removed' })
  } catch (error) {
    logger.error('Error removing widget', { error: error.message })
    res.status(500).json({ error: 'Failed to remove widget' })
  }
})

// POST /api/dashboards/:id/share
router.post('/:id/share', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const dashboard = await getDashboard(parseInt(req.params.id), userId, req.orgId)
    if (!dashboard) return res.status(404).json({ error: 'Dashboard not found' })
    const updated = await updateDashboard(dashboard.id, userId, { isShared: !dashboard.is_shared })
    res.json({ dashboard: updated })
  } catch (error) {
    logger.error('Error sharing dashboard', { error: error.message })
    res.status(500).json({ error: 'Failed to share dashboard' })
  }
})

// POST /api/dashboards/widget-data
router.post('/widget-data', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { widgetType, config } = req.body

    let data = {}
    const client = await pool.connect()
    try {
      switch (widgetType) {
        case 'cost_trend': {
          const days = config?.days || 30
          const result = await client.query(
            `SELECT date, SUM(cost)::float AS cost FROM daily_cost_data
             WHERE user_id = $1 AND date >= CURRENT_DATE - $2::int
             GROUP BY date ORDER BY date ASC`,
            [userId, days]
          )
          data = { points: result.rows }
          break
        }
        case 'service_breakdown': {
          const result = await client.query(
            `SELECT service_name, SUM(cost)::float AS cost FROM service_costs
             WHERE user_id = $1 AND month = $2 AND year = $3
             GROUP BY service_name ORDER BY cost DESC LIMIT 10`,
            [userId, new Date().getMonth() + 1, new Date().getFullYear()]
          )
          data = { services: result.rows }
          break
        }
        case 'budget_status': {
          const result = await client.query(
            `SELECT name, amount::float, period, threshold_percent FROM budgets WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
            [userId]
          )
          data = { budgets: result.rows }
          break
        }
        case 'anomaly_count': {
          const result = await client.query(
            `SELECT resolution_status, COUNT(*)::int AS count FROM anomaly_events
             WHERE user_id = $1 AND detected_date >= CURRENT_DATE - 30
             GROUP BY resolution_status`,
            [userId]
          )
          data = { anomalies: result.rows }
          break
        }
        case 'top_services': {
          const result = await client.query(
            `SELECT service_name, SUM(cost)::float AS cost FROM service_costs
             WHERE user_id = $1 AND month = $2 AND year = $3
             GROUP BY service_name ORDER BY cost DESC LIMIT $4`,
            [userId, new Date().getMonth() + 1, new Date().getFullYear(), config?.limit || 5]
          )
          data = { services: result.rows }
          break
        }
        case 'cost_by_provider': {
          const result = await client.query(
            `SELECT provider_id, SUM(current_month_cost)::float AS cost FROM cost_data
             WHERE user_id = $1 AND month = $2 AND year = $3
             GROUP BY provider_id ORDER BY cost DESC`,
            [userId, new Date().getMonth() + 1, new Date().getFullYear()]
          )
          data = { providers: result.rows }
          break
        }
        case 'forecast': {
          const result = await client.query(
            `SELECT date, cost::float FROM daily_cost_data
             WHERE user_id = $1 AND date >= CURRENT_DATE - 60
             ORDER BY date ASC`,
            [userId]
          )
          data = { history: result.rows }
          break
        }
        case 'custom_metric': {
          const metricName = config?.metricName || 'total_spend'
          const result = await client.query(
            `SELECT SUM(current_month_cost)::float AS value FROM cost_data
             WHERE user_id = $1 AND month = $2 AND year = $3`,
            [userId, new Date().getMonth() + 1, new Date().getFullYear()]
          )
          data = { value: result.rows[0]?.value || 0, label: metricName }
          break
        }
        default:
          data = { error: 'Unknown widget type' }
      }
    } finally {
      client.release()
    }

    res.json({ data })
  } catch (error) {
    logger.error('Error fetching widget data', { error: error.message })
    res.status(500).json({ error: 'Failed to fetch widget data' })
  }
})

export default router
