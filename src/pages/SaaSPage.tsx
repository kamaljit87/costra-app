import { useState, useEffect, useCallback } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'
import { saasAPI } from '../services/api'
import Layout from '../components/Layout'
import Breadcrumbs from '../components/Breadcrumbs'
import FeatureInfoButton from '../components/FeatureInfoButton'
import { Cloud, Plus, Trash2, Upload, TrendingUp, TrendingDown, RefreshCw, CheckCircle, AlertCircle, Clock, Loader2, Link2 } from 'lucide-react'

interface CredentialField {
  key: string
  label: string
  type: 'text' | 'password' | 'select'
  required: boolean
  placeholder?: string
  defaultValue?: string
  options?: { value: string; label: string }[]
}

interface SaaSProvider {
  id: number
  provider_name: string
  provider_type: string
  is_active: boolean
  current_month_cost: string
  created_at: string
  last_sync_at: string | null
  sync_status: 'never' | 'syncing' | 'success' | 'error'
  sync_error: string | null
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
  { value: 'custom', label: 'Custom (Manual / CSV)' },
]

function SyncStatusBadge({ status, error, lastSync }: { status: string; error: string | null; lastSync: string | null }) {
  const formatTime = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000)
    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    return `${Math.floor(diffHr / 24)}d ago`
  }

  switch (status) {
    case 'success':
      return (
        <span className="flex items-center gap-1 text-xs text-green-600" title={lastSync ? `Last synced: ${new Date(lastSync).toLocaleString()}` : ''}>
          <CheckCircle className="h-3.5 w-3.5" />
          Synced {lastSync ? formatTime(lastSync) : ''}
        </span>
      )
    case 'syncing':
      return (
        <span className="flex items-center gap-1 text-xs text-blue-600">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Syncing...
        </span>
      )
    case 'error':
      return (
        <span className="flex items-center gap-1 text-xs text-red-600" title={error || 'Sync failed'}>
          <AlertCircle className="h-3.5 w-3.5" />
          Error
        </span>
      )
    default:
      return (
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <Clock className="h-3.5 w-3.5" />
          Never synced
        </span>
      )
  }
}

export default function SaaSPage() {
  const { showSuccess, showError } = useNotification()
  const [providers, setProviders] = useState<SaaSProvider[]>([])
  const [totals, setTotals] = useState<SaaSTotals[]>([])
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; onConfirm: () => void }>({ open: false, onConfirm: () => {} })
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState('datadog')
  const [credentialFields, setCredentialFields] = useState<CredentialField[]>([])
  const [credentialValues, setCredentialValues] = useState<Record<string, string>>({})
  const [isAdding, setIsAdding] = useState(false)
  const [syncingIds, setSyncingIds] = useState<Set<number>>(new Set())
  const [expandedError, setExpandedError] = useState<number | null>(null)
  const [uploadProviderId, setUploadProviderId] = useState('')
  const [uploadCsv, setUploadCsv] = useState('')

  const loadData = useCallback(async () => {
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
  }, [showError])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Load credential fields when provider type changes
  useEffect(() => {
    if (formType === 'custom') {
      setCredentialFields([])
      setCredentialValues({})
      return
    }
    saasAPI.getCredentialFields(formType).then(res => {
      const fields = res.fields || []
      setCredentialFields(fields)
      const defaults: Record<string, string> = {}
      for (const f of fields) {
        if (f.defaultValue) defaults[f.key] = f.defaultValue
      }
      setCredentialValues(defaults)
    }).catch(() => setCredentialFields([]))
  }, [formType])

  const handleAddProvider = async () => {
    if (!formName.trim()) return
    setIsAdding(true)
    try {
      const hasCredentials = credentialFields.length > 0 && Object.values(credentialValues).some(v => v)
      await saasAPI.addProvider({
        providerName: formName.trim(),
        providerType: formType,
        credentials: hasCredentials ? credentialValues : undefined,
      })
      showSuccess('SaaS provider added')
      setShowAddForm(false)
      setFormName('')
      setCredentialValues({})
      await loadData()
    } catch (err: any) {
      showError(err?.message || 'Failed to add provider')
    } finally {
      setIsAdding(false)
    }
  }

  const handleSync = async (id: number) => {
    setSyncingIds(prev => new Set(prev).add(id))
    try {
      const res = await saasAPI.syncProvider(id)
      showSuccess(res.message || 'Sync completed')
      await loadData()
    } catch (err: any) {
      showError(err?.message || 'Sync failed')
      await loadData()
    } finally {
      setSyncingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
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

  const totalCurrentMonth = totals.reduce((s, t) => s + parseFloat(t.current_month || '0'), 0)
  const totalLastMonth = totals.reduce((s, t) => s + parseFloat(t.last_month || '0'), 0)
  const change = totalLastMonth > 0 ? ((totalCurrentMonth - totalLastMonth) / totalLastMonth * 100) : 0

  const getProviderDetails = (id: number) => providers.find(p => p.id === id)

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <Breadcrumbs />
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
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

        {/* Add Provider Form */}
        {showAddForm && (
          <div className="mb-6 p-5 bg-white rounded-xl border shadow-sm">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Link2 className="h-4 w-4" /> Add SaaS Provider
            </h3>
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

            {/* Dynamic credential fields */}
            {credentialFields.length > 0 && (
              <div className="border-t pt-4 mt-2 mb-4">
                <p className="text-xs font-medium text-gray-600 mb-3 uppercase tracking-wide">
                  Connection Credentials
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {credentialFields.map(field => (
                    <div key={field.key}>
                      <label className="block text-xs text-gray-500 mb-1">
                        {field.label} {field.required && <span className="text-red-400">*</span>}
                      </label>
                      {field.type === 'select' ? (
                        <select
                          value={credentialValues[field.key] || field.defaultValue || ''}
                          onChange={e => setCredentialValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                          className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                        >
                          {field.options?.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type}
                          value={credentialValues[field.key] || ''}
                          onChange={e => setCredentialValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                          placeholder={field.placeholder}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                        />
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Credentials are encrypted at rest (AES-256-GCM). Connection will be tested before saving.
                </p>
              </div>
            )}

            {formType === 'custom' && (
              <p className="text-xs text-gray-400 mb-4">
                Custom providers use manual CSV upload for cost data. No API credentials needed.
              </p>
            )}

            <div className="flex gap-2">
              <button onClick={handleAddProvider} disabled={isAdding || !formName.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-accent-600 text-white rounded-lg text-sm disabled:opacity-50">
                {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {isAdding ? 'Connecting...' : 'Add Provider'}
              </button>
              <button onClick={() => { setShowAddForm(false); setCredentialValues({}) }}
                className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        )}

        {/* Upload CSV Form */}
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

        {/* Provider List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 rounded-full border-2 border-gray-200 border-t-gray-600 animate-spin" />
          </div>
        ) : totals.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border">
            <Cloud className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-lg font-medium text-gray-700">No SaaS providers</p>
            <p className="text-sm text-gray-500 mt-1">Add Datadog, Snowflake, GitHub, or other SaaS providers to track their costs.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {totals.map(t => {
              const current = parseFloat(t.current_month || '0')
              const last = parseFloat(t.last_month || '0')
              const pctChange = last > 0 ? ((current - last) / last * 100) : 0
              const details = getProviderDetails(t.id)
              const isSyncing = syncingIds.has(t.id) || details?.sync_status === 'syncing'
              const hasCredentials = details?.provider_type !== 'custom'
              const isErrorExpanded = expandedError === t.id

              return (
                <div key={t.id} className="bg-white rounded-xl border p-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{t.provider_name}</span>
                        <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">{t.provider_type}</span>
                        {details && (
                          <SyncStatusBadge
                            status={details.sync_status}
                            error={details.sync_error}
                            lastSync={details.last_sync_at}
                          />
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        This month: ${current.toFixed(2)} &middot; Last month: ${last.toFixed(2)}
                      </p>
                      {isErrorExpanded && details?.sync_error && (
                        <p className="text-xs text-red-500 mt-1 bg-red-50 rounded px-2 py-1">
                          {details.sync_error}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <span className={`text-sm font-medium ${pctChange >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(1)}%
                      </span>
                      {hasCredentials && (
                        <button
                          onClick={() => handleSync(t.id)}
                          disabled={isSyncing}
                          title="Sync now"
                          className="p-1.5 text-gray-400 hover:text-indigo-600 disabled:opacity-50"
                        >
                          {isSyncing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </button>
                      )}
                      {details?.sync_status === 'error' && (
                        <button
                          onClick={() => setExpandedError(isErrorExpanded ? null : t.id)}
                          title="Show error"
                          className="p-1.5 text-red-400 hover:text-red-600"
                        >
                          <AlertCircle className="h-4 w-4" />
                        </button>
                      )}
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
