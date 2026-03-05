import { useState, useEffect } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useAuth } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'
import { savingsPlansAPI } from '../services/api'
import Layout from '../components/Layout'
import Breadcrumbs from '../components/Breadcrumbs'
import FeatureInfoButton from '../components/FeatureInfoButton'
import { Percent, Plus, Trash2, AlertTriangle } from 'lucide-react'

interface SavingsPlan {
  id: number
  name: string
  provider: string
  discount: number
  status: string
  expiresAt: string | null
  commitmentAmount: number | null
  utilizationPercent: number | null
  coveragePercent: number | null
  unusedValue: number | null
  planType: string | null
  service: string | null
  region: string | null
  recentHistory?: { date: string; utilization_percent: number }[]
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  expired: 'bg-red-100 text-red-700',
}

function UtilizationGauge({ percent, label }: { percent: number | null; label: string }) {
  const value = percent ?? 0
  const color = value >= 80 ? 'text-green-600' : value >= 50 ? 'text-yellow-600' : 'text-red-600'
  return (
    <div className="text-center">
      <div className="relative w-20 h-20 mx-auto mb-1">
        <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 36 36">
          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none" stroke="#e5e7eb" strokeWidth="3" />
          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${value}, 100`}
            className={color} />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${color}`}>
          {value.toFixed(0)}%
        </span>
      </div>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  )
}

export default function SavingsPlansPage() {
  const { isDemoMode } = useAuth()
  const { showSuccess, showError } = useNotification()
  const [plans, setPlans] = useState<SavingsPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; onConfirm: () => void }>({ open: false, onConfirm: () => {} })
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formProvider, setFormProvider] = useState('aws')
  const [formDiscount, setFormDiscount] = useState('')
  const [formExpiry, setFormExpiry] = useState('')

  useEffect(() => {
    if (!isDemoMode) loadData()
  }, [isDemoMode])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const res = await savingsPlansAPI.getUtilization()
      setPlans(res.plans || [])
    } catch {
      showError('Failed to load savings plans')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!formName.trim() || !formDiscount) return
    try {
      await savingsPlansAPI.create({
        name: formName.trim(), provider: formProvider, discount: parseFloat(formDiscount),
        status: 'active', expiresAt: formExpiry || undefined,
      })
      showSuccess('Savings plan created')
      setShowCreateForm(false)
      setFormName('')
      setFormDiscount('')
      setFormExpiry('')
      await loadData()
    } catch {
      showError('Failed to create savings plan')
    }
  }

  const handleDelete = (id: number) => {
    setConfirmDialog({
      open: true,
      onConfirm: async () => {
        try {
          await savingsPlansAPI.delete(id)
          showSuccess('Savings plan deleted')
          await loadData()
        } catch {
          showError('Failed to delete savings plan')
        }
      }
    })
  }

  if (isDemoMode) {
    return (
      <Layout><div className="p-6"><Breadcrumbs />
        <div className="text-center py-12 text-gray-500">Savings plans are not available in demo mode.</div>
      </div></Layout>
    )
  }

  const activePlans = plans.filter(p => p.status === 'active')
  const avgUtilization = activePlans.length > 0
    ? activePlans.reduce((sum, p) => sum + (p.utilizationPercent || 0), 0) / activePlans.length
    : 0
  const totalUnused = plans.reduce((sum, p) => sum + (p.unusedValue || 0), 0)
  const expiringSoon = plans.filter(p => {
    if (!p.expiresAt) return false
    const daysUntil = (new Date(p.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return daysUntil > 0 && daysUntil <= 30
  })

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <Breadcrumbs />
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Percent className="h-8 w-8 text-indigo-600" />
              RI/SP Utilization
              <FeatureInfoButton featureId="savings-plans" />
            </h1>
            <p className="text-sm text-gray-500 mt-1">Track Reserved Instance and Savings Plan coverage and utilization</p>
          </div>
          <button onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 text-sm">
            <Plus className="h-4 w-4" /> Add Plan
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4 text-center">
            <UtilizationGauge percent={avgUtilization} label="Avg Utilization" />
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 mb-1">Total Unused Value</p>
            <p className="text-2xl font-bold text-red-600">${totalUnused.toFixed(2)}</p>
            <p className="text-xs text-gray-400">This month</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 mb-1">Expiring Soon</p>
            <p className="text-2xl font-bold text-yellow-600">{expiringSoon.length}</p>
            <p className="text-xs text-gray-400">Within 30 days</p>
          </div>
        </div>

        {showCreateForm && (
          <div className="mb-6 p-5 bg-white rounded-xl border shadow-sm">
            <h3 className="font-semibold mb-4">Add Savings Plan / Reserved Instance</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Name</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. 1yr EC2 Compute SP" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Provider</label>
                <select value={formProvider} onChange={e => setFormProvider(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                  <option value="aws">AWS</option>
                  <option value="azure">Azure</option>
                  <option value="gcp">GCP</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Discount %</label>
                <input type="number" value={formDiscount} onChange={e => setFormDiscount(e.target.value)}
                  placeholder="30" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Expiry Date</label>
                <input type="date" value={formExpiry} onChange={e => setFormExpiry(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} className="px-4 py-2 bg-accent-600 text-white rounded-lg text-sm">Save</button>
              <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 rounded-full border-2 border-gray-200 border-t-gray-600 animate-spin" />
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border">
            <Percent className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-lg font-medium text-gray-700">No savings plans yet</p>
            <p className="text-sm text-gray-500 mt-1">Add your Reserved Instances and Savings Plans to track utilization.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {plans.map(plan => {
              const daysUntilExpiry = plan.expiresAt
                ? Math.ceil((new Date(plan.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : null
              return (
                <div key={plan.id} className="bg-white rounded-xl border p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{plan.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[plan.status] || ''}`}>
                          {plan.status}
                        </span>
                        <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">{plan.provider}</span>
                        {plan.planType && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">{plan.planType.toUpperCase()}</span>}
                      </div>
                      <div className="text-xs text-gray-400">
                        {plan.discount}% discount
                        {plan.service && <> &middot; {plan.service}</>}
                        {plan.region && <> &middot; {plan.region}</>}
                        {daysUntilExpiry !== null && (
                          <span className={daysUntilExpiry <= 30 ? ' text-red-500 font-medium' : ''}>
                            {' '}&middot; {daysUntilExpiry > 0 ? `Expires in ${daysUntilExpiry}d` : 'Expired'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {plan.utilizationPercent !== null && (
                        <UtilizationGauge percent={plan.utilizationPercent} label="Utilization" />
                      )}
                      {plan.coveragePercent !== null && (
                        <UtilizationGauge percent={plan.coveragePercent} label="Coverage" />
                      )}
                      {daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry > 0 && (
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      )}
                      <button onClick={() => handleDelete(plan.id)} className="p-1.5 text-gray-400 hover:text-red-500">
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
        title="Delete Savings Plan"
        description="Delete this savings plan?"
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDialog.onConfirm}
      />
    </Layout>
  )
}
