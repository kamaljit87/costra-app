import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'
import { policiesAPI } from '../services/api'
import Layout from '../components/Layout'
import Breadcrumbs from '../components/Breadcrumbs'
import { Shield, Plus, Trash2, ToggleLeft, ToggleRight, AlertCircle, CheckCircle } from 'lucide-react'

interface Policy {
  id: number
  name: string
  description: string
  policy_type: string
  conditions: Record<string, unknown>
  actions: string[]
  scope_provider_id: string | null
  scope_account_id: number | null
  is_enabled: boolean
  created_at: string
}

interface Violation {
  id: number
  policy_name: string
  policy_type: string
  violation_type: string
  violation_details: Record<string, unknown>
  severity: string
  resolved: boolean
  created_at: string
}

const POLICY_TYPES = [
  { value: 'spend_threshold', label: 'Spend Threshold', description: 'Alert when daily spend exceeds a threshold' },
  { value: 'tag_compliance', label: 'Tag Compliance', description: 'Flag untagged resources above a cost threshold' },
  { value: 'trend_alert', label: 'Trend Alert', description: 'Alert on sustained week-over-week increases' },
  { value: 'budget_forecast', label: 'Budget Forecast', description: 'Alert when forecast exceeds budget percentage' },
]

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-blue-100 text-blue-700',
}

export default function PoliciesPage() {
  const { isDemoMode } = useAuth()
  const { showSuccess, showError } = useNotification()
  const [policies, setPolicies] = useState<Policy[]>([])
  const [violations, setViolations] = useState<Violation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [activeTab, setActiveTab] = useState<'policies' | 'violations'>('policies')

  // Create form state
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formType, setFormType] = useState('spend_threshold')
  const [formThreshold, setFormThreshold] = useState('')
  const [formService, setFormService] = useState('')

  useEffect(() => {
    if (!isDemoMode) loadData()
  }, [isDemoMode])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [policiesRes, violationsRes] = await Promise.all([
        policiesAPI.list(),
        policiesAPI.getViolations({ resolved: false, limit: 50 }),
      ])
      setPolicies(policiesRes.policies || [])
      setViolations(violationsRes.violations || [])
    } catch {
      showError('Failed to load policies')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!formName.trim() || !formThreshold) return
    try {
      const conditions: Record<string, unknown> = { operator: 'gt', value: parseFloat(formThreshold) }

      if (formType === 'spend_threshold') {
        conditions.metric = 'daily_spend'
        if (formService.trim()) conditions.service = formService.trim()
      } else if (formType === 'tag_compliance') {
        conditions.metric = 'untagged_cost'
      } else if (formType === 'trend_alert') {
        conditions.metric = '7day_trend'
      } else if (formType === 'budget_forecast') {
        conditions.metric = 'forecast_vs_budget'
      }

      await policiesAPI.create({
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        policyType: formType,
        conditions,
        actions: ['notify'],
      })
      showSuccess('Policy created')
      setShowCreateForm(false)
      setFormName('')
      setFormDescription('')
      setFormThreshold('')
      setFormService('')
      await loadData()
    } catch {
      showError('Failed to create policy')
    }
  }

  const handleToggle = async (policy: Policy) => {
    try {
      await policiesAPI.update(policy.id, { isEnabled: !policy.is_enabled })
      showSuccess(`Policy ${policy.is_enabled ? 'disabled' : 'enabled'}`)
      await loadData()
    } catch {
      showError('Failed to update policy')
    }
  }

  const handleDelete = async (policyId: number) => {
    if (!confirm('Delete this policy and all its violations?')) return
    try {
      await policiesAPI.delete(policyId)
      showSuccess('Policy deleted')
      await loadData()
    } catch {
      showError('Failed to delete policy')
    }
  }

  const handleResolveViolation = async (violationId: number) => {
    try {
      await policiesAPI.resolveViolation(violationId)
      showSuccess('Violation resolved')
      await loadData()
    } catch {
      showError('Failed to resolve violation')
    }
  }

  if (isDemoMode) {
    return (
      <Layout><div className="p-6"><Breadcrumbs />
        <div className="text-center py-12 text-gray-500">Policies are not available in demo mode.</div>
      </div></Layout>
    )
  }

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <Breadcrumbs />
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Shield className="h-8 w-8 text-indigo-600" />
              Cost Policies
            </h1>
            <p className="text-sm text-gray-500 mt-1">Define guardrails to catch overspending and governance issues</p>
          </div>
          <button onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 text-sm">
            <Plus className="h-4 w-4" /> New Policy
          </button>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="mb-6 p-5 bg-white rounded-xl border shadow-sm">
            <h3 className="font-semibold mb-4">Create Policy</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Policy Name</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. EC2 daily spend limit" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type</label>
                <select value={formType} onChange={e => setFormType(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                  {POLICY_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">{POLICY_TYPES.find(t => t.value === formType)?.description}</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Threshold {formType === 'trend_alert' || formType === 'budget_forecast' ? '(%)' : '($)'}
                </label>
                <input type="number" value={formThreshold} onChange={e => setFormThreshold(e.target.value)}
                  placeholder={formType === 'trend_alert' ? '20' : '500'}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              {formType === 'spend_threshold' && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Service (optional)</label>
                  <input type="text" value={formService} onChange={e => setFormService(e.target.value)}
                    placeholder="e.g. Amazon EC2" className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              )}
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Description (optional)</label>
                <input type="text" value={formDescription} onChange={e => setFormDescription(e.target.value)}
                  placeholder="Brief description of this policy" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} className="px-4 py-2 bg-accent-600 text-white rounded-lg text-sm">Create Policy</button>
              <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
          <button onClick={() => setActiveTab('policies')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'policies' ? 'bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            Policies ({policies.length})
          </button>
          <button onClick={() => setActiveTab('violations')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-1 ${activeTab === 'violations' ? 'bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            Violations
            {violations.length > 0 && (
              <span className="bg-red-100 text-red-700 text-xs px-1.5 py-0.5 rounded-full">{violations.length}</span>
            )}
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 rounded-full border-2 border-gray-200 dark:border-gray-700 border-t-gray-600 animate-spin" />
          </div>
        ) : activeTab === 'policies' ? (
          /* Policies List */
          policies.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border">
              <Shield className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-lg font-medium text-gray-700">No policies yet</p>
              <p className="text-sm text-gray-500 mt-1">Create cost policies to automatically catch overspending.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {policies.map(policy => {
                const cond = typeof policy.conditions === 'string' ? JSON.parse(policy.conditions as unknown as string) : policy.conditions
                return (
                  <div key={policy.id} className={`bg-white rounded-xl border p-4 ${!policy.is_enabled ? 'opacity-60' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{policy.name}</span>
                          <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-600">
                            {POLICY_TYPES.find(t => t.value === policy.policy_type)?.label || policy.policy_type}
                          </span>
                        </div>
                        {policy.description && <p className="text-xs text-gray-500 mt-1">{policy.description}</p>}
                        <p className="text-xs text-gray-400 mt-1">
                          Threshold: {String((cond as Record<string, unknown>).value)}
                          {policy.policy_type === 'trend_alert' || policy.policy_type === 'budget_forecast' ? '%' : '$'}
                          {(cond as Record<string, unknown>).service ? ` for ${String((cond as Record<string, unknown>).service)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleToggle(policy)}
                          className="p-1.5 text-gray-400 hover:text-gray-600">
                          {policy.is_enabled
                            ? <ToggleRight className="h-6 w-6 text-green-500" />
                            : <ToggleLeft className="h-6 w-6 text-gray-400" />}
                        </button>
                        <button onClick={() => handleDelete(policy.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : (
          /* Violations List */
          violations.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border">
              <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
              <p className="text-lg font-medium text-gray-700">No active violations</p>
              <p className="text-sm text-gray-500 mt-1">All policies are passing. Violations are checked after each sync.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {violations.map(v => {
                const details = typeof v.violation_details === 'string'
                  ? JSON.parse(v.violation_details as unknown as string) : v.violation_details
                return (
                  <div key={v.id} className="bg-white rounded-xl border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-red-500" />
                          <span className="font-semibold">{v.policy_name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[v.severity] || ''}`}>
                            {v.severity}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {(details as Record<string, unknown>).service ? `${String((details as Record<string, unknown>).service)}: ` : ''}
                          {(details as Record<string, unknown>).actualValue !== undefined
                            ? `$${Number((details as Record<string, unknown>).actualValue).toFixed(2)} (threshold: $${Number((details as Record<string, unknown>).threshold).toFixed(2)})`
                            : (details as Record<string, unknown>).changePercent !== undefined
                              ? `${Number((details as Record<string, unknown>).changePercent).toFixed(1)}% increase (threshold: ${(details as Record<string, unknown>).threshold}%)`
                              : JSON.stringify(details)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">{new Date(v.created_at).toLocaleDateString()}</p>
                      </div>
                      <button onClick={() => handleResolveViolation(v.id)}
                        className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100">
                        Resolve
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>
    </Layout>
  )
}
