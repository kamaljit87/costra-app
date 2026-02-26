import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { attachOrg } from '../middleware/orgAuth.js'
import {
  createK8sCluster, getK8sClusters, getK8sClusterById, deleteK8sCluster,
  getK8sNamespaceCosts, getK8sNamespaceSummary, getK8sWorkloadCosts
} from '../database.js'
import { ingestK8sMetrics, getIdleResources } from '../services/k8sCostService.js'
import logger from '../utils/logger.js'

const router = express.Router()
router.use(authenticateToken, attachOrg)

/**
 * GET /api/kubernetes/clusters
 * List all K8s clusters
 */
router.get('/clusters', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const clusters = await getK8sClusters(userId, req.orgId)
    res.json({ clusters })
  } catch (error) {
    logger.error('Error listing clusters', { error: error.message })
    res.status(500).json({ error: 'Failed to list clusters' })
  }
})

/**
 * POST /api/kubernetes/clusters
 * Register a new K8s cluster
 */
router.post('/clusters', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { clusterName, clusterId, providerId, accountId, region, nodeCount, totalCost } = req.body

    if (!clusterName) {
      return res.status(400).json({ error: 'clusterName is required' })
    }

    const cluster = await createK8sCluster(userId, req.orgId, {
      clusterName, clusterId, providerId,
      accountId: accountId ? parseInt(accountId) : null,
      region, nodeCount, totalCost,
    })

    res.status(201).json({ cluster })
  } catch (error) {
    logger.error('Error creating cluster', { error: error.message })
    res.status(500).json({ error: 'Failed to create cluster' })
  }
})

/**
 * GET /api/kubernetes/clusters/:id
 * Get cluster details with summary
 */
router.get('/clusters/:id', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const clusterId = parseInt(req.params.id)
    const cluster = await getK8sClusterById(clusterId, userId)
    if (!cluster) return res.status(404).json({ error: 'Cluster not found' })

    // Get 30-day namespace summary
    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    const namespaceSummary = await getK8sNamespaceSummary(clusterId, startDate, endDate)

    res.json({ cluster, namespaceSummary })
  } catch (error) {
    logger.error('Error getting cluster', { error: error.message })
    res.status(500).json({ error: 'Failed to get cluster' })
  }
})

/**
 * DELETE /api/kubernetes/clusters/:id
 * Delete a cluster and all associated data
 */
router.delete('/clusters/:id', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    await deleteK8sCluster(parseInt(req.params.id), userId)
    res.json({ success: true })
  } catch (error) {
    logger.error('Error deleting cluster', { error: error.message })
    res.status(500).json({ error: 'Failed to delete cluster' })
  }
})

/**
 * POST /api/kubernetes/clusters/:id/metrics
 * Ingest K8s metrics (namespace/workload resource usage)
 */
router.post('/clusters/:id/metrics', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const clusterId = parseInt(req.params.id)
    const results = await ingestK8sMetrics(clusterId, userId, req.body)
    res.json({
      success: true,
      ingested: {
        namespaces: results.namespaces.length,
        workloads: results.workloads.length,
      },
    })
  } catch (error) {
    logger.error('Error ingesting K8s metrics', { error: error.message })
    res.status(500).json({ error: error.message || 'Failed to ingest metrics' })
  }
})

/**
 * GET /api/kubernetes/clusters/:id/namespaces
 * Get namespace cost breakdown
 */
router.get('/clusters/:id/namespaces', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const clusterId = parseInt(req.params.id)
    const cluster = await getK8sClusterById(clusterId, userId)
    if (!cluster) return res.status(404).json({ error: 'Cluster not found' })

    const endDate = req.query.endDate || new Date().toISOString().split('T')[0]
    const startDate = req.query.startDate || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

    const summary = await getK8sNamespaceSummary(clusterId, startDate, endDate)
    const daily = await getK8sNamespaceCosts(clusterId, startDate, endDate)

    res.json({ summary, daily, cluster })
  } catch (error) {
    logger.error('Error getting namespace costs', { error: error.message })
    res.status(500).json({ error: 'Failed to get namespace costs' })
  }
})

/**
 * GET /api/kubernetes/clusters/:id/workloads
 * Get workload cost breakdown
 */
router.get('/clusters/:id/workloads', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const clusterId = parseInt(req.params.id)
    const cluster = await getK8sClusterById(clusterId, userId)
    if (!cluster) return res.status(404).json({ error: 'Cluster not found' })

    const endDate = req.query.endDate || new Date().toISOString().split('T')[0]
    const startDate = req.query.startDate || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    const namespace = req.query.namespace || null

    const workloads = await getK8sWorkloadCosts(clusterId, namespace, startDate, endDate)

    res.json({ workloads, cluster })
  } catch (error) {
    logger.error('Error getting workload costs', { error: error.message })
    res.status(500).json({ error: 'Failed to get workload costs' })
  }
})

/**
 * GET /api/kubernetes/clusters/:id/idle
 * Get idle/underutilized resources
 */
router.get('/clusters/:id/idle', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const clusterId = parseInt(req.params.id)
    const cluster = await getK8sClusterById(clusterId, userId)
    if (!cluster) return res.status(404).json({ error: 'Cluster not found' })

    const endDate = req.query.endDate || new Date().toISOString().split('T')[0]
    const startDate = req.query.startDate || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

    const idleResources = await getIdleResources(clusterId, startDate, endDate)

    res.json({ idleResources, cluster })
  } catch (error) {
    logger.error('Error getting idle resources', { error: error.message })
    res.status(500).json({ error: 'Failed to get idle resources' })
  }
})

export default router
