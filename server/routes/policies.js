import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { attachOrg } from '../middleware/orgAuth.js'
import {
  createCostPolicy, getCostPolicies, getCostPolicyById,
  updateCostPolicy, deleteCostPolicy,
  getPolicyViolations, resolvePolicyViolation
} from '../database.js'
import logger from '../utils/logger.js'

const router = express.Router()
router.use(authenticateToken, attachOrg)

/**
 * GET /api/policies
 * List all cost policies
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const policies = await getCostPolicies(userId, req.orgId)
    res.json({ policies })
  } catch (error) {
    logger.error('Error listing policies', { error: error.message })
    res.status(500).json({ error: 'Failed to list policies' })
  }
})

/**
 * POST /api/policies
 * Create a new cost policy
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { name, description, policyType, conditions, actions, scopeProviderId, scopeAccountId } = req.body

    if (!name || !policyType || !conditions) {
      return res.status(400).json({ error: 'name, policyType, and conditions are required' })
    }

    const validTypes = ['spend_threshold', 'tag_compliance', 'trend_alert', 'budget_forecast']
    if (!validTypes.includes(policyType)) {
      return res.status(400).json({ error: `Invalid policyType. Must be one of: ${validTypes.join(', ')}` })
    }

    const policy = await createCostPolicy(userId, req.orgId, {
      name, description, policyType, conditions, actions,
      scopeProviderId, scopeAccountId: scopeAccountId ? parseInt(scopeAccountId) : null,
    })

    res.status(201).json({ policy })
  } catch (error) {
    logger.error('Error creating policy', { error: error.message })
    res.status(500).json({ error: 'Failed to create policy' })
  }
})

/**
 * GET /api/policies/:id
 * Get a specific policy
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const policy = await getCostPolicyById(parseInt(req.params.id), userId)
    if (!policy) return res.status(404).json({ error: 'Policy not found' })
    res.json({ policy })
  } catch (error) {
    logger.error('Error getting policy', { error: error.message })
    res.status(500).json({ error: 'Failed to get policy' })
  }
})

/**
 * PUT /api/policies/:id
 * Update a cost policy
 */
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { name, description, conditions, actions, isEnabled } = req.body
    const policy = await updateCostPolicy(parseInt(req.params.id), userId, {
      name, description, conditions, actions, isEnabled,
    })
    if (!policy) return res.status(404).json({ error: 'Policy not found' })
    res.json({ policy })
  } catch (error) {
    logger.error('Error updating policy', { error: error.message })
    res.status(500).json({ error: 'Failed to update policy' })
  }
})

/**
 * DELETE /api/policies/:id
 * Delete a cost policy
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    await deleteCostPolicy(parseInt(req.params.id), userId)
    res.json({ success: true })
  } catch (error) {
    logger.error('Error deleting policy', { error: error.message })
    res.status(500).json({ error: 'Failed to delete policy' })
  }
})

/**
 * GET /api/policies/violations/list
 * List policy violations
 */
router.get('/violations/list', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { policyId, resolved, limit = 50, offset = 0 } = req.query
    const violations = await getPolicyViolations(userId, {
      orgId: req.orgId,
      policyId: policyId ? parseInt(policyId) : undefined,
      resolved: resolved !== undefined ? resolved === 'true' : undefined,
      limit: parseInt(limit),
      offset: parseInt(offset),
    })
    res.json({ violations })
  } catch (error) {
    logger.error('Error listing violations', { error: error.message })
    res.status(500).json({ error: 'Failed to list violations' })
  }
})

/**
 * PUT /api/policies/violations/:id/resolve
 * Resolve a policy violation
 */
router.put('/violations/:id/resolve', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const violation = await resolvePolicyViolation(parseInt(req.params.id), userId)
    if (!violation) return res.status(404).json({ error: 'Violation not found' })
    res.json({ violation })
  } catch (error) {
    logger.error('Error resolving violation', { error: error.message })
    res.status(500).json({ error: 'Failed to resolve violation' })
  }
})

export default router
