import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'
import { terraformAPI } from '../services/api'
import Layout from '../components/Layout'
import Breadcrumbs from '../components/Breadcrumbs'
import { FileCode, Upload, Trash2, DollarSign, Plus, Minus, RefreshCw } from 'lucide-react'

interface ResourceEstimate {
  address: string
  type: string
  action: string
  monthlyCost: number
  note: string
}

interface Estimate {
  id?: number
  plan_name?: string
  totalMonthlyCost: number
  totalResources: number
  created: number
  updated: number
  deleted: number
  breakdown: ResourceEstimate[]
  created_at?: string
}

interface SavedEstimate {
  id: number
  plan_name: string
  estimated_monthly_cost: string
  resource_breakdown: ResourceEstimate[]
  created_at: string
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-yellow-100 text-yellow-700',
  delete: 'bg-red-100 text-red-700',
}

const ACTION_ICONS: Record<string, typeof Plus> = {
  create: Plus,
  update: RefreshCw,
  delete: Minus,
}

export default function TerraformPage() {
  const { isDemoMode } = useAuth()
  const { showSuccess, showError } = useNotification()
  const [planJson, setPlanJson] = useState('')
  const [planName, setPlanName] = useState('')
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const [savedEstimates, setSavedEstimates] = useState<SavedEstimate[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'estimate' | 'history'>('estimate')

  useEffect(() => {
    if (!isDemoMode) loadSaved()
  }, [isDemoMode])

  const loadSaved = async () => {
    try {
      const res = await terraformAPI.listEstimates()
      setSavedEstimates(res.estimates || [])
    } catch {
      // silent
    }
  }

  const handleEstimate = async () => {
    if (!planJson.trim()) return
    try {
      setIsLoading(true)
      const res = await terraformAPI.estimate({
        planName: planName.trim() || undefined,
        planJson: planJson.trim(),
      })
      setEstimate(res.estimate)
      showSuccess('Cost estimate generated')
      await loadSaved()
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to estimate')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await terraformAPI.deleteEstimate(id)
      showSuccess('Estimate deleted')
      await loadSaved()
    } catch {
      showError('Failed to delete estimate')
    }
  }

  if (isDemoMode) {
    return (
      <Layout><div className="p-6"><Breadcrumbs />
        <div className="text-center py-12 text-gray-500">Terraform estimation is not available in demo mode.</div>
      </div></Layout>
    )
  }

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <Breadcrumbs />
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3 mb-1">
          <FileCode className="h-8 w-8 text-indigo-600" />
          Terraform Cost Estimation
        </h1>
        <p className="text-sm text-gray-500 mb-6">Estimate infrastructure costs from <code className="bg-gray-100 px-1 rounded">terraform plan -json</code> output</p>

        <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
          <button onClick={() => setActiveTab('estimate')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'estimate' ? 'bg-white shadow-sm' : 'text-gray-600'}`}>
            New Estimate
          </button>
          <button onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'history' ? 'bg-white shadow-sm' : 'text-gray-600'}`}>
            History ({savedEstimates.length})
          </button>
        </div>

        {activeTab === 'estimate' ? (
          <>
            <div className="bg-white rounded-xl border p-5 mb-6">
              <div className="mb-4">
                <label className="block text-xs text-gray-500 mb-1">Plan Name (optional)</label>
                <input type="text" value={planName} onChange={e => setPlanName(e.target.value)}
                  placeholder="e.g. Production scaling v2" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div className="mb-4">
                <label className="block text-xs text-gray-500 mb-1">Terraform Plan JSON</label>
                <textarea value={planJson} onChange={e => setPlanJson(e.target.value)}
                  placeholder='Paste output of: terraform plan -json'
                  rows={8} className="w-full px-3 py-2 border rounded-lg text-sm font-mono" />
              </div>
              <button onClick={handleEstimate} disabled={isLoading || !planJson.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-accent-600 text-white rounded-lg text-sm disabled:opacity-50">
                <Upload className="h-4 w-4" /> {isLoading ? 'Estimating...' : 'Estimate Cost'}
              </button>
            </div>

            {estimate && (
              <div className="bg-white rounded-xl border p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Estimated Monthly Cost</h3>
                  <span className="text-2xl font-bold text-accent-600 flex items-center gap-1">
                    <DollarSign className="h-6 w-6" />
                    {estimate.totalMonthlyCost.toFixed(2)}/mo
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-lg font-bold text-green-700">{estimate.created}</p>
                    <p className="text-xs text-green-600">Created</p>
                  </div>
                  <div className="text-center p-3 bg-yellow-50 rounded-lg">
                    <p className="text-lg font-bold text-yellow-700">{estimate.updated}</p>
                    <p className="text-xs text-yellow-600">Updated</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <p className="text-lg font-bold text-red-700">{estimate.deleted}</p>
                    <p className="text-xs text-red-600">Deleted</p>
                  </div>
                </div>
                {estimate.breakdown.length > 0 && (
                  <div className="space-y-2">
                    {estimate.breakdown.map((r, i) => {
                      const Icon = ACTION_ICONS[r.action] || RefreshCw
                      return (
                        <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[r.action] || ''}`}>
                              <Icon className="h-3 w-3 inline" /> {r.action}
                            </span>
                            <span className="text-sm font-mono">{r.address}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-medium">${Math.abs(r.monthlyCost).toFixed(2)}/mo</span>
                            <p className="text-xs text-gray-400">{r.note}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          savedEstimates.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border">
              <FileCode className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-lg font-medium text-gray-700">No saved estimates</p>
              <p className="text-sm text-gray-500 mt-1">Submit a terraform plan to see cost estimates here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedEstimates.map(e => (
                <div key={e.id} className="bg-white rounded-xl border p-4 flex items-center justify-between">
                  <div>
                    <span className="font-semibold">{e.plan_name}</span>
                    <div className="text-xs text-gray-400 mt-1">
                      ${parseFloat(e.estimated_monthly_cost).toFixed(2)}/mo &middot; {new Date(e.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(e.id)} className="p-1.5 text-gray-400 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </Layout>
  )
}
