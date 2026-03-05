import { useState, useEffect } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useAuth } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'
import { saasAPI } from '../services/api'
import Layout from '../components/Layout'
import Breadcrumbs from '../components/Breadcrumbs'
import FeatureInfoButton from '../components/FeatureInfoButton'
import { Cloud, Plus, Trash2, Upload, TrendingUp, TrendingDown } from 'lucide-react'

interface SaaSProvider {
  id: number
  provider_name: string
  provider_type: string
  is_active: boolean
  current_month_cost: string
  created_at: string
}

interface SaaSTotals {
  id: number
  provider_name: string
  provider_type: string
  current_month: string
  last_month: string
}

const PROVIDER_TYPES = [
  { value: 'datadog', label: 'Datadog' },
  { value: 'snowflake', label: 'Snowflake' },
  { value: 'github', label: 'GitHub' },
  { value: 'custom', label: 'Custom' },
]

export default function SaaSPage() {
  const { isDemoMode } = useAuth()
  const { showSuccess, showError } = useNotification()
  const [providers, setProviders] = useState<SaaSProvider[]>([])
  const [totals, setTotals] = useState<SaaSTotals[]>([])
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; onConfirm: () => void }>({ open: false, onConfirm: () => {} })
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState('custom')
  const [uploadProviderId, setUploadProviderId] = useState('')
  const [uploadCsv, setUploadCsv] = useState('')

  useEffect(() => {
    if (!isDemoMode) loadData()
  }, [isDemoMode])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [providersRes, totalsRes] = await Promise.all([
        saasAPI.listProviders(),
        saasAPI.getTotals(),
      ])
      setProviders(providersRes.providers || [])
      setTotals(totalsRes.totals || [])
    } catch {
      showError('Failed to load SaaS data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddProvider = async () => {
    if (!formName.trim()) return
    try {
      await saasAPI.addProvider({ providerName: formName.trim(), providerType: formType })
      showSuccess('SaaS provider added')
      setShowAddForm(false)
      setFormName('')
      await loadData()
    } catch {
      showError('Failed to add provider')
    }
  }

  const handleDelete = (id: number) => {
    setConfirmDialog({
      open: true,
      onConfirm: async () => {
        try {
          await saasAPI.deleteProvider(id)
          showSuccess('Provider deleted')
          await loadData()
        } catch {
          showError('Failed to delete provider')
        }
      }
    })
  }

  const handleUpload = async () => {
    if (!uploadProviderId || !uploadCsv.trim()) return
    try {
      // Parse simple CSV: date,service,cost
      const lines = uploadCsv.trim().split('\n')
      const costs = lines.slice(1).map(line => {
        const [date, service, cost] = line.split(',').map(s => s.trim())
        return { date, serviceName: service, cost }
      }).filter(c => c.date && c.cost)

      const res = await saasAPI.uploadCosts({ providerId: parseInt(uploadProviderId), costs })
      showSuccess(`${res.imported} cost entries imported`)
      setShowUploadForm(false)
      setUploadCsv('')
      await loadData()
    } catch {
      showError('Failed to upload costs')
    }
  }

  if (isDemoMode) {
    return (
      <Layout><div className="p-6"><Breadcrumbs />
        <div className="text-center py-12 text-gray-500">SaaS tracking is not available in demo mode.</div>
      </div></Layout>
    )
  }

  const totalCurrentMonth = totals.reduce((s, t) => s + parseFloat(t.current_month || '0'), 0)
  const totalLastMonth = totals.reduce((s, t) => s + parseFloat(t.last_month || '0'), 0)
  const change = totalLastMonth > 0 ? ((totalCurrentMonth - totalLastMonth) / totalLastMonth * 100) : 0

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <Breadcrumbs />
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Cloud className="h-8 w-8 text-indigo-600" />
              SaaS Spend
              <FeatureInfoButton featureId="saas" />
            </h1>
            <p className="text-sm text-gray-500 mt-1">Track costs for Datadog, Snowflake, GitHub, and other SaaS tools</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowUploadForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">
              <Upload className="h-4 w-4" /> Upload CSV
            </button>
            <button onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 text-sm">
              <Plus className="h-4 w-4" /> Add Provider
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 mb-1">This Month</p>
            <p className="text-2xl font-bold">${totalCurrentMonth.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 mb-1">Last Month</p>
            <p className="text-2xl font-bold">${totalLastMonth.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 mb-1">Change</p>
            <p className={`text-2xl font-bold flex items-center gap-1 ${change >= 0 ? 'text-red-600' : 'text-green-600'}`}>
              {change >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              {Math.abs(change).toFixed(1)}%
            </p>
          </div>
        </div>

        {showAddForm && (
          <div className="mb-6 p-5 bg-white rounded-xl border shadow-sm">
            <h3 className="font-semibold mb-4">Add SaaS Provider</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Provider Name</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. Datadog Production" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type</label>
                <select value={formType} onChange={e => setFormType(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                  {PROVIDER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddProvider} className="px-4 py-2 bg-accent-600 text-white rounded-lg text-sm">Add</button>
              <button onClick={() => setShowAddForm(false)} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        )}

        {showUploadForm && (
          <div className="mb-6 p-5 bg-white rounded-xl border shadow-sm">
            <h3 className="font-semibold mb-4">Upload Cost CSV</h3>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">Provider</label>
              <select value={uploadProviderId} onChange={e => setUploadProviderId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                <option value="">Select provider...</option>
                {providers.map(p => <option key={p.id} value={p.id}>{p.provider_name}</option>)}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">CSV Data (date, service, cost)</label>
              <textarea value={uploadCsv} onChange={e => setUploadCsv(e.target.value)}
                placeholder="date,service,cost&#10;2026-03-01,Infrastructure,450.00&#10;2026-03-01,APM,200.00"
                rows={6} className="w-full px-3 py-2 border rounded-lg text-sm font-mono" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleUpload} className="px-4 py-2 bg-accent-600 text-white rounded-lg text-sm">Import</button>
              <button onClick={() => setShowUploadForm(false)} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 rounded-full border-2 border-gray-200 border-t-gray-600 animate-spin" />
          </div>
        ) : totals.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border">
            <Cloud className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-lg font-medium text-gray-700">No SaaS providers</p>
            <p className="text-sm text-gray-500 mt-1">Add Datadog, Snowflake, or other SaaS providers to track their costs.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {totals.map(t => {
              const current = parseFloat(t.current_month || '0')
              const last = parseFloat(t.last_month || '0')
              const pctChange = last > 0 ? ((current - last) / last * 100) : 0
              return (
                <div key={t.id} className="bg-white rounded-xl border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{t.provider_name}</span>
                        <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">{t.provider_type}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        This month: ${current.toFixed(2)} &middot; Last month: ${last.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-medium ${pctChange >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(1)}%
                      </span>
                      <button onClick={() => handleDelete(t.id)} className="p-1.5 text-gray-400 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        title="Delete SaaS Provider"
        description="Delete this SaaS provider and all its costs?"
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDialog.onConfirm}
      />
    </Layout>
  )
}
