import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import {
  createBudget,
  getBudgets,
  getBudget,
  updateBudget,
  deleteBudget,
  updateBudgetSpend,
  checkBudgetAlerts,
  getBudgetAlerts,
} from '../database.js'

const router = express.Router()

// All routes require authentication
router.use(authenticateToken)

/**
 * POST /api/budgets
 * Create a new budget
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' })
    }
    const { budgetName, providerId, accountId, budgetAmount, budgetPeriod, alertThreshold, createInCloudProvider } = req.body
    
    if (!budgetName || !budgetAmount || !budgetPeriod) {
      return res.status(400).json({ error: 'budgetName, budgetAmount, and budgetPeriod are required' })
    }
    
    if (!['monthly', 'quarterly', 'yearly'].includes(budgetPeriod)) {
      return res.status(400).json({ error: 'budgetPeriod must be monthly, quarterly, or yearly' })
    }
    
    const budget = await createBudget(userId, {
      budgetName,
      providerId: providerId || null,
      accountId: accountId ? parseInt(accountId) : null,
      budgetAmount: parseFloat(budgetAmount),
      budgetPeriod,
      alertThreshold: alertThreshold ? parseInt(alertThreshold) : 80
    })
    
    // Create budget in cloud provider if requested
    if (createInCloudProvider && providerId && accountId) {
      try {
        const { createCloudProviderBudget } = await import('../services/cloudProviderBudgets.js')
        const accountCredentials = await getCloudProviderCredentialsByAccountId(userId, parseInt(accountId))
        
        if (accountCredentials && accountCredentials.credentials) {
          await createCloudProviderBudget(
            providerId,
            accountCredentials.credentials,
            {
              budgetName,
              budgetAmount: parseFloat(budgetAmount),
              budgetPeriod,
              alertThreshold: alertThreshold ? parseInt(alertThreshold) : 80
            }
          )
          console.log(`[Budget] Created budget in cloud provider: ${providerId}`)
        } else {
          console.warn(`[Budget] Could not find credentials for account ${accountId}, skipping cloud provider budget creation`)
        }
      } catch (cloudError) {
        console.error(`[Budget] Failed to create budget in cloud provider ${providerId}:`, cloudError)
        // Don't fail the entire request if cloud provider budget creation fails
        // The budget is still created in the app
      }
    }
    
    // Update spend immediately
    await updateBudgetSpend(userId, budget.id)
    
    const message = createInCloudProvider && providerId && accountId
      ? 'Budget created successfully in app and cloud provider'
      : 'Budget created successfully'
    
    res.status(201).json({ budget, message })
  } catch (error) {
    console.error('Create budget error:', error)
    res.status(500).json({ error: 'Failed to create budget' })
  }
})

/**
 * GET /api/budgets
 * Get all budgets for the user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' })
    }
    const { providerId, accountId } = req.query
    
    const budgets = await getBudgets(
      userId,
      providerId || null,
      accountId ? parseInt(accountId) : null
    )
    
    // Update spend for all budgets
    for (const budget of budgets) {
      if (budget.status !== 'paused') {
        await updateBudgetSpend(userId, budget.id).catch(err => {
          console.error(`Failed to update spend for budget ${budget.id}:`, err)
        })
      }
    }
    
    // Re-fetch to get updated values
    const updatedBudgets = await getBudgets(
      userId,
      providerId || null,
      accountId ? parseInt(accountId) : null
    )
    
    res.json({ budgets: updatedBudgets })
  } catch (error) {
    console.error('Get budgets error:', error)
    res.status(500).json({ error: 'Failed to fetch budgets' })
  }
})

/**
 * GET /api/budgets/:budgetId
 * Get a specific budget
 */
router.get('/:budgetId', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' })
    }
    const budgetId = parseInt(req.params.budgetId)
    
    if (isNaN(budgetId)) {
      return res.status(400).json({ error: 'Invalid budget ID' })
    }
    
    let budget = await getBudget(userId, budgetId)
    
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' })
    }
    
    // Update spend
    if (budget.status !== 'paused') {
      budget = await updateBudgetSpend(userId, budgetId)
    }
    
    res.json({ budget })
  } catch (error) {
    console.error('Get budget error:', error)
    res.status(500).json({ error: 'Failed to fetch budget' })
  }
})

/**
 * PATCH /api/budgets/:budgetId
 * Update a budget
 */
router.patch('/:budgetId', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' })
    }
    const budgetId = parseInt(req.params.budgetId)
    const updateData = req.body
    
    if (isNaN(budgetId)) {
      return res.status(400).json({ error: 'Invalid budget ID' })
    }
    
    const budget = await updateBudget(userId, budgetId, updateData)
    
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' })
    }
    
    // Update spend if budget amount or period changed
    if (updateData.budgetAmount || updateData.budgetPeriod) {
      await updateBudgetSpend(userId, budgetId)
      const updated = await getBudget(userId, budgetId)
      res.json({ budget: updated, message: 'Budget updated successfully' })
    } else {
      res.json({ budget, message: 'Budget updated successfully' })
    }
  } catch (error) {
    console.error('Update budget error:', error)
    res.status(500).json({ error: 'Failed to update budget' })
  }
})

/**
 * DELETE /api/budgets/:budgetId
 * Delete a budget
 */
router.delete('/:budgetId', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' })
    }
    const budgetId = parseInt(req.params.budgetId)
    
    if (isNaN(budgetId)) {
      return res.status(400).json({ error: 'Invalid budget ID' })
    }
    
    const deleted = await deleteBudget(userId, budgetId)
    
    if (!deleted) {
      return res.status(404).json({ error: 'Budget not found' })
    }
    
    res.json({ message: 'Budget deleted successfully' })
  } catch (error) {
    console.error('Delete budget error:', error)
    res.status(500).json({ error: 'Failed to delete budget' })
  }
})

/**
 * GET /api/budgets/alerts
 * Get budget alerts
 */
router.get('/alerts/all', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' })
    }
    
    // Check all budgets for alerts
    const alerts = await checkBudgetAlerts(userId)
    
    res.json({ alerts })
  } catch (error) {
    console.error('Get budget alerts error:', error)
    res.status(500).json({ error: 'Failed to fetch budget alerts' })
  }
})

/**
 * GET /api/budgets/alerts/history
 * Get budget alert history
 */
router.get('/alerts/history', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' })
    }
    const limit = parseInt(req.query.limit) || 10
    
    const alerts = await getBudgetAlerts(userId, limit)
    
    res.json({ alerts })
  } catch (error) {
    console.error('Get budget alert history error:', error)
    res.status(500).json({ error: 'Failed to fetch budget alert history' })
  }
})

/**
 * POST /api/budgets/:budgetId/check
 * Manually check budget status
 */
router.post('/:budgetId/check', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' })
    }
    const budgetId = parseInt(req.params.budgetId)
    
    if (isNaN(budgetId)) {
      return res.status(400).json({ error: 'Invalid budget ID' })
    }
    
    const budget = await updateBudgetSpend(userId, budgetId)
    
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' })
    }
    
    const status = budget.percentage >= 100 ? 'exceeded' : 
                   budget.percentage >= budget.alertThreshold ? 'warning' : 'ok'
    
    res.json({ 
      budget, 
      status,
      percentage: budget.percentage 
    })
  } catch (error) {
    console.error('Check budget error:', error)
    res.status(500).json({ error: 'Failed to check budget' })
  }
})

export default router
