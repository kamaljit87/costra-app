import {
  getK8sClusterById, upsertK8sNamespaceCosts, upsertK8sWorkloadCosts,
  updateK8sClusterMetrics
} from '../database.js'
import logger from '../utils/logger.js'

/**
 * Process and ingest Kubernetes metrics payload.
 * Allocates node costs to namespaces proportionally based on resource requests.
 *
 * Expected payload format:
 * {
 *   clusterCost: 1500.00,       // Total cluster node cost for the period
 *   nodeCount: 5,
 *   date: "2026-02-25",
 *   namespaces: [
 *     {
 *       name: "production",
 *       cpuRequestCores: 4.0,
 *       cpuUsageCores: 2.5,
 *       memoryRequestBytes: 8589934592,  // 8Gi
 *       memoryUsageBytes: 6442450944,    // 6Gi
 *       podCount: 12,
 *       workloads: [
 *         {
 *           name: "api-server",
 *           type: "deployment",
 *           cpuRequestCores: 2.0,
 *           cpuUsageCores: 1.5,
 *           memoryRequestBytes: 4294967296,
 *           memoryUsageBytes: 3221225472,
 *           replicaCount: 3
 *         }
 *       ]
 *     }
 *   ]
 * }
 */
export async function ingestK8sMetrics(clusterId, userId, payload) {
  const cluster = await getK8sClusterById(clusterId, userId)
  if (!cluster) {
    throw new Error('Cluster not found')
  }

  const { clusterCost, nodeCount, date, namespaces } = payload
  if (!date || !namespaces || !Array.isArray(namespaces)) {
    throw new Error('Invalid payload: date and namespaces array required')
  }

  const totalClusterCost = parseFloat(clusterCost) || 0

  // Calculate total resource requests across all namespaces
  let totalCpuRequest = 0
  let totalMemoryRequest = 0
  for (const ns of namespaces) {
    totalCpuRequest += parseFloat(ns.cpuRequestCores) || 0
    totalMemoryRequest += parseFloat(ns.memoryRequestBytes) || 0
  }

  // Cost allocation weights: 50% CPU, 50% memory
  const cpuWeight = 0.5
  const memoryWeight = 0.5
  const cpuCostPool = totalClusterCost * cpuWeight
  const memoryCostPool = totalClusterCost * memoryWeight

  const results = { namespaces: [], workloads: [] }

  for (const ns of namespaces) {
    const nsCpuRequest = parseFloat(ns.cpuRequestCores) || 0
    const nsMemoryRequest = parseFloat(ns.memoryRequestBytes) || 0

    // Proportional cost allocation
    const nsCpuCost = totalCpuRequest > 0
      ? (nsCpuRequest / totalCpuRequest) * cpuCostPool : 0
    const nsMemoryCost = totalMemoryRequest > 0
      ? (nsMemoryRequest / totalMemoryRequest) * memoryCostPool : 0
    const nsTotalCost = nsCpuCost + nsMemoryCost

    const nsResult = await upsertK8sNamespaceCosts(clusterId, {
      namespace: ns.name,
      date,
      cpuRequestCores: nsCpuRequest,
      cpuUsageCores: parseFloat(ns.cpuUsageCores) || 0,
      memoryRequestBytes: nsMemoryRequest,
      memoryUsageBytes: parseFloat(ns.memoryUsageBytes) || 0,
      cpuCost: Math.round(nsCpuCost * 100) / 100,
      memoryCost: Math.round(nsMemoryCost * 100) / 100,
      totalCost: Math.round(nsTotalCost * 100) / 100,
      podCount: parseInt(ns.podCount) || 0,
    })
    results.namespaces.push(nsResult)

    // Process workloads within namespace
    if (ns.workloads && Array.isArray(ns.workloads)) {
      // Calculate namespace-level totals for workload sub-allocation
      let nsWorkloadCpuTotal = 0
      let nsWorkloadMemTotal = 0
      for (const wl of ns.workloads) {
        nsWorkloadCpuTotal += parseFloat(wl.cpuRequestCores) || 0
        nsWorkloadMemTotal += parseFloat(wl.memoryRequestBytes) || 0
      }

      for (const wl of ns.workloads) {
        const wlCpuRequest = parseFloat(wl.cpuRequestCores) || 0
        const wlMemRequest = parseFloat(wl.memoryRequestBytes) || 0
        const wlCpuUsage = parseFloat(wl.cpuUsageCores) || 0
        const wlMemUsage = parseFloat(wl.memoryUsageBytes) || 0

        // Sub-allocate namespace cost to workloads
        const wlCpuCost = nsWorkloadCpuTotal > 0
          ? (wlCpuRequest / nsWorkloadCpuTotal) * nsCpuCost : 0
        const wlMemCost = nsWorkloadMemTotal > 0
          ? (wlMemRequest / nsWorkloadMemTotal) * nsMemoryCost : 0
        const wlTotalCost = wlCpuCost + wlMemCost

        // Calculate idle cost (requested but not used)
        const cpuIdleRatio = wlCpuRequest > 0 ? Math.max(0, 1 - wlCpuUsage / wlCpuRequest) : 0
        const memIdleRatio = wlMemRequest > 0 ? Math.max(0, 1 - wlMemUsage / wlMemRequest) : 0
        const idleCost = (wlCpuCost * cpuIdleRatio + wlMemCost * memIdleRatio)

        const wlResult = await upsertK8sWorkloadCosts(clusterId, {
          namespace: ns.name,
          workloadName: wl.name,
          workloadType: wl.type || 'deployment',
          date,
          cpuRequestCores: wlCpuRequest,
          cpuUsageCores: wlCpuUsage,
          memoryRequestBytes: wlMemRequest,
          memoryUsageBytes: wlMemUsage,
          cpuCost: Math.round(wlCpuCost * 100) / 100,
          memoryCost: Math.round(wlMemCost * 100) / 100,
          totalCost: Math.round(wlTotalCost * 100) / 100,
          replicaCount: parseInt(wl.replicaCount) || 1,
          idleCost: Math.round(idleCost * 100) / 100,
        })
        results.workloads.push(wlResult)
      }
    }
  }

  // Update cluster metrics
  await updateK8sClusterMetrics(clusterId, userId, {
    nodeCount: parseInt(nodeCount) || cluster.node_count,
    totalCost: totalClusterCost || cluster.total_cost,
  })

  logger.info('K8s metrics ingested', {
    clusterId, date, namespaces: namespaces.length,
    workloads: results.workloads.length,
  })

  return results
}

/**
 * Calculate idle resources across a cluster.
 * Returns namespaces and workloads where usage is significantly below requests.
 */
export async function getIdleResources(clusterId, startDate, endDate) {
  const { pool: dbPool } = await import('../database.js')

  const result = await dbPool.query(
    `SELECT namespace, workload_name, workload_type,
       AVG(cpu_request_cores)::float AS avg_cpu_request,
       AVG(cpu_usage_cores)::float AS avg_cpu_usage,
       AVG(memory_request_bytes)::float AS avg_memory_request,
       AVG(memory_usage_bytes)::float AS avg_memory_usage,
       SUM(idle_cost)::float AS total_idle_cost,
       SUM(total_cost)::float AS total_cost,
       COUNT(*)::int AS days
     FROM k8s_workload_costs
     WHERE cluster_id = $1 AND date >= $2 AND date <= $3
     GROUP BY namespace, workload_name, workload_type
     HAVING AVG(CASE WHEN cpu_request_cores > 0 THEN cpu_usage_cores / cpu_request_cores ELSE 1 END) < 0.3
        OR AVG(CASE WHEN memory_request_bytes > 0 THEN memory_usage_bytes::float / memory_request_bytes::float ELSE 1 END) < 0.3
     ORDER BY total_idle_cost DESC`,
    [clusterId, startDate, endDate]
  )

  return result.rows.map(r => ({
    ...r,
    cpuUtilization: r.avg_cpu_request > 0 ? (r.avg_cpu_usage / r.avg_cpu_request) * 100 : 0,
    memoryUtilization: r.avg_memory_request > 0 ? (r.avg_memory_usage / r.avg_memory_request) * 100 : 0,
  }))
}
