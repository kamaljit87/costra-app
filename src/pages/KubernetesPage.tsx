import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'
import { kubernetesAPI } from '../services/api'
import Layout from '../components/Layout'
import Breadcrumbs from '../components/Breadcrumbs'
import { Container, Plus, Trash2, ArrowLeft, AlertTriangle } from 'lucide-react'

interface Cluster {
  id: number
  cluster_name: string
  cluster_id: string | null
  provider_id: string | null
  region: string | null
  node_count: number
  total_cost: number
  last_metrics_at: string | null
  created_at: string
}

interface NamespaceSummary {
  namespace: string
  total_cost: number
  cpu_cost: number
  memory_cost: number
  avg_cpu_usage: number
  avg_memory_usage: number
  pod_count: number
}

interface Workload {
  workload_name: string
  workload_type: string
  namespace: string
  total_cost: number
  cpu_cost: number
  memory_cost: number
  idle_cost: number
  avg_cpu_usage: number
  avg_memory_usage: number
  avg_cpu_request: number
  avg_memory_request: number
  replica_count: number
}

interface IdleResource {
  workload_name: string
  workload_type: string
  namespace: string
  avg_cpu_utilization: number
  avg_memory_utilization: number
  total_idle_cost: number
  days_tracked: number
}

export default function KubernetesPage() {
  const { isDemoMode } = useAuth()
  const { showSuccess, showError } = useNotification()
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null)
  const [namespaceSummary, setNamespaceSummary] = useState<NamespaceSummary[]>([])
  const [workloads, setWorkloads] = useState<Workload[]>([])
  const [idleResources, setIdleResources] = useState<IdleResource[]>([])
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'namespaces' | 'workloads' | 'idle'>('namespaces')
  const [showCreateForm, setShowCreateForm] = useState(false)

  // Create form
  const [formName, setFormName] = useState('')
  const [formRegion, setFormRegion] = useState('')
  const [formNodes, setFormNodes] = useState('')
  const [formCost, setFormCost] = useState('')

  useEffect(() => {
    if (!isDemoMode) loadClusters()
  }, [isDemoMode])

  const loadClusters = async () => {
    try {
      setIsLoading(true)
      const res = await kubernetesAPI.listClusters()
      setClusters(res.clusters || [])
    } catch {
      showError('Failed to load clusters')
    } finally {
      setIsLoading(false)
    }
  }

  const selectCluster = async (cluster: Cluster) => {
    setSelectedCluster(cluster)
    setSelectedNamespace(null)
    setActiveTab('namespaces')
    try {
      const [nsRes, idleRes] = await Promise.all([
        kubernetesAPI.getNamespaces(cluster.id),
        kubernetesAPI.getIdleResources(cluster.id),
      ])
      setNamespaceSummary(nsRes.summary || [])
      setIdleResources(idleRes.idleResources || [])
    } catch {
      setNamespaceSummary([])
      setIdleResources([])
    }
  }

  const loadWorkloads = async (namespace?: string) => {
    if (!selectedCluster) return
    setSelectedNamespace(namespace || null)
    setActiveTab('workloads')
    try {
      const res = await kubernetesAPI.getWorkloads(selectedCluster.id, namespace || undefined)
      setWorkloads(res.workloads || [])
    } catch {
      setWorkloads([])
    }
  }

  const handleCreate = async () => {
    if (!formName.trim()) return
    try {
      await kubernetesAPI.createCluster({
        clusterName: formName.trim(),
        region: formRegion.trim() || undefined,
        nodeCount: formNodes ? parseInt(formNodes) : undefined,
        totalCost: formCost ? parseFloat(formCost) : undefined,
      })
      showSuccess('Cluster registered')
      setShowCreateForm(false)
      setFormName('')
      setFormRegion('')
      setFormNodes('')
      setFormCost('')
      await loadClusters()
    } catch {
      showError('Failed to create cluster')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this cluster and all associated cost data?')) return
    try {
      await kubernetesAPI.deleteCluster(id)
      showSuccess('Cluster deleted')
      if (selectedCluster?.id === id) {
        setSelectedCluster(null)
        setNamespaceSummary([])
        setWorkloads([])
      }
      await loadClusters()
    } catch {
      showError('Failed to delete cluster')
    }
  }

  const formatCost = (v: number) => `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const formatPct = (v: number) => `${(Number(v) * 100).toFixed(1)}%`

  if (isDemoMode) {
    return (
      <Layout><div className="p-6"><Breadcrumbs />
        <div className="text-center py-12 text-gray-500">Kubernetes cost allocation is not available in demo mode.</div>
      </div></Layout>
    )
  }

  // Cluster detail view
  if (selectedCluster) {
    const totalNsCost = namespaceSummary.reduce((sum, ns) => sum + Number(ns.total_cost), 0)
    const maxNsCost = namespaceSummary.reduce((max, ns) => Math.max(max, Number(ns.total_cost)), 0)

    return (
      <Layout>
        <div className="p-6 max-w-5xl mx-auto">
          <Breadcrumbs />
          <button onClick={() => setSelectedCluster(null)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to clusters
          </button>

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{selectedCluster.cluster_name}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {selectedCluster.region && `${selectedCluster.region} · `}
                {selectedCluster.node_count} nodes · {formatCost(selectedCluster.total_cost)}/mo
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
            <button onClick={() => setActiveTab('namespaces')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'namespaces' ? 'bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
              Namespaces ({namespaceSummary.length})
            </button>
            <button onClick={() => { setActiveTab('workloads'); if (workloads.length === 0) loadWorkloads() }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'workloads' ? 'bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
              Workloads
            </button>
            <button onClick={() => setActiveTab('idle')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-1 ${activeTab === 'idle' ? 'bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
              Idle Resources
              {idleResources.length > 0 && (
                <span className="bg-orange-100 text-orange-700 text-xs px-1.5 py-0.5 rounded-full">{idleResources.length}</span>
              )}
            </button>
          </div>

          {activeTab === 'namespaces' && (
            namespaceSummary.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border">
                <Container className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-lg font-medium text-gray-700">No namespace data</p>
                <p className="text-sm text-gray-500 mt-1">Push metrics via the API to see namespace cost breakdown.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border">
                <div className="p-4 border-b">
                  <p className="text-sm text-gray-500">Total namespace costs: <span className="font-semibold text-gray-900">{formatCost(totalNsCost)}</span></p>
                </div>
                <div className="divide-y">
                  {namespaceSummary.map(ns => (
                    <div key={ns.namespace} className="p-4 hover:bg-gray-50 cursor-pointer" onClick={() => loadWorkloads(ns.namespace)}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{ns.namespace}</span>
                        <span className="font-semibold text-sm">{formatCost(Number(ns.total_cost))}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                        <div className="bg-accent-500 h-2 rounded-full" style={{ width: `${maxNsCost ? (Number(ns.total_cost) / maxNsCost) * 100 : 0}%` }} />
                      </div>
                      <div className="flex gap-4 text-xs text-gray-500">
                        <span>CPU: {formatCost(Number(ns.cpu_cost))}</span>
                        <span>Memory: {formatCost(Number(ns.memory_cost))}</span>
                        <span>Pods: {ns.pod_count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}

          {activeTab === 'workloads' && (
            <div>
              {selectedNamespace && (
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-sm text-gray-500">Namespace:</span>
                  <span className="px-2 py-0.5 bg-accent-50 text-accent-700 rounded-full text-sm font-medium">{selectedNamespace}</span>
                  <button onClick={() => loadWorkloads()} className="text-xs text-gray-400 hover:text-gray-600">Show all</button>
                </div>
              )}
              {workloads.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border text-gray-500 text-sm">
                  No workload data available.
                </div>
              ) : (
                <div className="bg-white rounded-xl border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium">Workload</th>
                        <th className="text-left px-4 py-3 font-medium">Type</th>
                        <th className="text-right px-4 py-3 font-medium">Cost</th>
                        <th className="text-right px-4 py-3 font-medium">CPU Util</th>
                        <th className="text-right px-4 py-3 font-medium">Mem Util</th>
                        <th className="text-right px-4 py-3 font-medium">Idle $</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {workloads.map((w, i) => {
                        const cpuUtil = Number(w.avg_cpu_request) > 0 ? Number(w.avg_cpu_usage) / Number(w.avg_cpu_request) : 0
                        const memUtil = Number(w.avg_memory_request) > 0 ? Number(w.avg_memory_usage) / Number(w.avg_memory_request) : 0
                        return (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <span className="font-medium">{w.workload_name}</span>
                              {!selectedNamespace && <span className="text-xs text-gray-400 ml-2">{w.namespace}</span>}
                            </td>
                            <td className="px-4 py-3 text-gray-500">{w.workload_type}</td>
                            <td className="px-4 py-3 text-right font-medium">{formatCost(Number(w.total_cost))}</td>
                            <td className="px-4 py-3 text-right">
                              <span className={cpuUtil < 0.3 ? 'text-red-600' : cpuUtil < 0.6 ? 'text-yellow-600' : 'text-green-600'}>
                                {formatPct(cpuUtil)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={memUtil < 0.3 ? 'text-red-600' : memUtil < 0.6 ? 'text-yellow-600' : 'text-green-600'}>
                                {formatPct(memUtil)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-orange-600">{formatCost(Number(w.idle_cost))}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'idle' && (
            idleResources.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border">
                <p className="text-lg font-medium text-gray-700">No idle resources detected</p>
                <p className="text-sm text-gray-500 mt-1">All workloads are utilizing above 30% of their requested resources.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {idleResources.map((r, i) => (
                  <div key={i} className="bg-white rounded-xl border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                          <span className="font-semibold text-sm">{r.workload_name}</span>
                          <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">{r.workload_type}</span>
                          <span className="text-xs text-gray-400">{r.namespace}</span>
                        </div>
                        <div className="flex gap-4 mt-1 text-xs text-gray-500">
                          <span>CPU util: <span className="text-red-600 font-medium">{formatPct(Number(r.avg_cpu_utilization))}</span></span>
                          <span>Mem util: <span className="text-red-600 font-medium">{formatPct(Number(r.avg_memory_utilization))}</span></span>
                          <span>Tracked {r.days_tracked} days</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-orange-600 font-semibold">{formatCost(Number(r.total_idle_cost))}</p>
                        <p className="text-xs text-gray-400">idle cost</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </Layout>
    )
  }

  // Cluster list view
  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <Breadcrumbs />
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Container className="h-8 w-8 text-accent-600" />
              Kubernetes Costs
            </h1>
            <p className="text-sm text-gray-500 mt-1">Namespace and workload cost allocation for K8s clusters</p>
          </div>
          <button onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 text-sm">
            <Plus className="h-4 w-4" /> Register Cluster
          </button>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="mb-6 p-5 bg-white rounded-xl border shadow-sm">
            <h3 className="font-semibold mb-4">Register Cluster</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cluster Name</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. production-us-east" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Region (optional)</label>
                <input type="text" value={formRegion} onChange={e => setFormRegion(e.target.value)}
                  placeholder="e.g. us-east-1" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Node Count (optional)</label>
                <input type="number" value={formNodes} onChange={e => setFormNodes(e.target.value)}
                  placeholder="3" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Monthly Cost ($, optional)</label>
                <input type="number" value={formCost} onChange={e => setFormCost(e.target.value)}
                  placeholder="2500" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} className="px-4 py-2 bg-accent-600 text-white rounded-lg text-sm">Register</button>
              <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 rounded-full border-2 border-gray-200 dark:border-gray-700 border-t-gray-600 animate-spin" />
          </div>
        ) : clusters.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border">
            <Container className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-lg font-medium text-gray-700">No clusters registered</p>
            <p className="text-sm text-gray-500 mt-1">Register a Kubernetes cluster to start tracking namespace and workload costs.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {clusters.map(cluster => (
              <div key={cluster.id}
                className="bg-white rounded-xl border p-5 hover:shadow-md transition cursor-pointer"
                onClick={() => selectCluster(cluster)}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-lg">{cluster.cluster_name}</h3>
                  <button onClick={e => { e.stopPropagation(); handleDelete(cluster.id) }}
                    className="p-1.5 text-gray-400 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Region</p>
                    <p className="text-sm font-medium">{cluster.region || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Nodes</p>
                    <p className="text-sm font-medium">{cluster.node_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Cost/mo</p>
                    <p className="text-sm font-medium">{formatCost(cluster.total_cost || 0)}</p>
                  </div>
                </div>
                {cluster.last_metrics_at && (
                  <p className="text-xs text-gray-400 mt-3">Last metrics: {new Date(cluster.last_metrics_at).toLocaleDateString()}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
