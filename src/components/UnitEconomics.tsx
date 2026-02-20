import { useState, useEffect } from 'react'
import { useCurrency } from '../contexts/CurrencyContext'
import { useNotification } from '../contexts/NotificationContext'
import { insightsAPI, billingAPI } from '../services/api'
import { DollarSign, Users, Activity, TrendingUp, TrendingDown, Info, X, Plus, Trash2 } from 'lucide-react'
import { getDateRangeForPeriod, PeriodType } from '../services/costService'
import UpgradePrompt from './UpgradePrompt'

interface UnitEconomicsData {
  metricType: string
  metricName: string
  unit: string | null
  totalMetricValue: number
  totalCost: number
  unitCost: number | null
  daysWithData: number
}

interface UnitEconomicsProps {
  providerId?: string
  accountId?: number
  period?: PeriodType
  startDate?: string
  endDate?: string
}

const METRIC_TYPE_OPTIONS = [
  { value: 'customers', label: 'Customers' },
  { value: 'users', label: 'Users' },
  { value: 'api_calls', label: 'API Calls' },
  { value: 'transactions', label: 'Transactions' },
  { value: 'orders', label: 'Orders' },
  { value: 'revenue', label: 'Revenue' },
]

interface AddMetricModalProps {
  onClose: () => void
  onSuccess: () => void
  providerId?: string
  accountId?: number
}

function AddMetricModal({ onClose, onSuccess, providerId, accountId }: AddMetricModalProps) {
  const { showSuccess, showError } = useNotification()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [useCustomType, setUseCustomType] = useState(false)
  const [formData, setFormData] = useState({
    metricType: '',
    metricName: '',
    date: new Date().toISOString().split('T')[0],
    metricValue: '',
    unit: '',
    notes: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.metricType || !formData.metricName || !formData.date || !formData.metricValue) return

    setIsSubmitting(true)
    try {
      await insightsAPI.saveBusinessMetric({
        metricType: formData.metricType,
        metricName: formData.metricName,
        date: formData.date,
        metricValue: parseFloat(formData.metricValue),
        unit: formData.unit || undefined,
        notes: formData.notes || undefined,
        providerId: providerId || undefined,
        accountId: accountId || undefined,
      })
      showSuccess('Business metric saved successfully')
      onSuccess()
      onClose()
    } catch (err: any) {
      showError(err.message || 'Failed to save metric')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Plus className="h-5 w-5 text-accent-600" />
            Add Business Metric
          </h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Metric Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Metric Type *</label>
            {useCustomType ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.metricType}
                  onChange={(e) => setFormData({ ...formData, metricType: e.target.value })}
                  className="flex-1 px-4 py-2.5 border border-gray-300/60 rounded-xl focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500/60 transition-all text-sm"
                  placeholder="e.g., deployments"
                  required
                />
                <button
                  type="button"
                  onClick={() => { setUseCustomType(false); setFormData({ ...formData, metricType: '' }) }}
                  className="text-xs text-accent-600 hover:text-accent-700 whitespace-nowrap px-2"
                >
                  Use preset
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  value={formData.metricType}
                  onChange={(e) => setFormData({ ...formData, metricType: e.target.value })}
                  className="flex-1 px-4 py-2.5 border border-gray-300/60 rounded-xl focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500/60 transition-all text-sm bg-white"
                  required
                >
                  <option value="">Select type...</option>
                  {METRIC_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => { setUseCustomType(true); setFormData({ ...formData, metricType: '' }) }}
                  className="text-xs text-accent-600 hover:text-accent-700 whitespace-nowrap px-2"
                >
                  Custom
                </button>
              </div>
            )}
          </div>

          {/* Metric Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Metric Name *</label>
            <input
              type="text"
              value={formData.metricName}
              onChange={(e) => setFormData({ ...formData, metricName: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300/60 rounded-xl focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500/60 transition-all text-sm"
              placeholder="e.g., Monthly Active Users"
              required
            />
          </div>

          {/* Date + Value */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300/60 rounded-xl focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500/60 transition-all text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Value *</label>
              <input
                type="number"
                value={formData.metricValue}
                onChange={(e) => setFormData({ ...formData, metricValue: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300/60 rounded-xl focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500/60 transition-all text-sm"
                placeholder="e.g., 1500"
                min="0"
                step="any"
                required
              />
            </div>
          </div>

          {/* Unit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit <span className="text-gray-400 font-normal">(optional)</span></label>
            <input
              type="text"
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300/60 rounded-xl focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500/60 transition-all text-sm"
              placeholder="e.g., users, requests, transactions"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300/60 rounded-xl focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500/60 transition-all text-sm resize-none"
              rows={2}
              placeholder="Any additional notes..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 text-sm font-medium bg-accent-600 text-white rounded-xl hover:bg-accent-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Metric'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function UnitEconomics({ providerId, accountId, period = '1month', startDate, endDate }: UnitEconomicsProps) {
  const { formatCurrency } = useCurrency()
  const { showSuccess, showError } = useNotification()
  const [data, setData] = useState<{totalCost: number, unitEconomics: UnitEconomicsData[], period: {startDate: string, endDate: string}} | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInfoDialog, setShowInfoDialog] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [subscriptionStatus, setSubscriptionStatus] = useState<{ planType: string } | null>(null)
  const [rawMetrics, setRawMetrics] = useState<Array<{ id: number; metricType: string; metricName: string; date: string; metricValue: number; unit: string | null; notes: string | null }>>([])
  const [showRawMetrics, setShowRawMetrics] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Calculate date range from period if not provided
  const dateRange = startDate && endDate
    ? { startDate, endDate }
    : getDateRangeForPeriod(period)

  // Convert date range to ISO strings
  const startDateStr = typeof dateRange.startDate === 'string'
    ? dateRange.startDate
    : dateRange.startDate.toISOString().split('T')[0]
  const endDateStr = typeof dateRange.endDate === 'string'
    ? dateRange.endDate
    : dateRange.endDate.toISOString().split('T')[0]

  useEffect(() => {
    loadSubscriptionStatus()
    fetchUnitEconomics()
  }, [providerId, accountId, startDateStr, endDateStr])

  const loadSubscriptionStatus = async () => {
    try {
      const response = await billingAPI.getSubscription()
      setSubscriptionStatus(response.status)
    } catch (error) {
      console.error('Failed to load subscription status:', error)
    }
  }

  const fetchUnitEconomics = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await insightsAPI.getUnitEconomics(
        startDateStr,
        endDateStr,
        providerId,
        accountId
      )
      setData(result.data || null)
    } catch (err: any) {
      console.error('Failed to fetch unit economics:', err)
      // Check if it's a 403 (feature not available)
      if (err.message?.includes('403') || err.message?.includes('Feature not available') || err.message?.includes('Pro subscription')) {
        setError('PRO_FEATURE')
      } else {
        setError(err.message || 'Failed to load unit economics data')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const fetchRawMetrics = async () => {
    try {
      const result = await insightsAPI.getBusinessMetrics(startDateStr, endDateStr, undefined, undefined, providerId)
      setRawMetrics(result.metrics || [])
    } catch (err) {
      console.error('Failed to fetch raw metrics:', err)
    }
  }

  const handleDeleteMetric = async (id: number) => {
    setDeletingId(id)
    try {
      await insightsAPI.deleteBusinessMetric(id)
      showSuccess('Metric deleted')
      setRawMetrics(prev => prev.filter(m => m.id !== id))
      fetchUnitEconomics()
    } catch (err: any) {
      showError(err.message || 'Failed to delete metric')
    } finally {
      setDeletingId(null)
    }
  }

  const handleToggleRawMetrics = () => {
    if (!showRawMetrics) {
      fetchRawMetrics()
    }
    setShowRawMetrics(!showRawMetrics)
  }

  const getMetricIcon = (metricType: string) => {
    switch (metricType.toLowerCase()) {
      case 'customer':
      case 'customers':
      case 'user':
      case 'users':
        return Users
      case 'api':
      case 'request':
      case 'requests':
        return Activity
      default:
        return DollarSign
    }
  }

  const formatMetricValue = (value: number) => {
    if (!value) return '0'

    // Format large numbers
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(2)}M`
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(2)}K`
    }
    return value.toFixed(2)
  }

  if (isLoading) {
    return (
      <div className="card bg-white border-accent-100">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <DollarSign className="h-8 w-8 text-accent-600 animate-pulse mx-auto mb-4" />
            <p className="text-accent-700">Loading unit economics...</p>
          </div>
        </div>
      </div>
    )
  }

  // Show upgrade prompt if feature not available
  if (error === 'PRO_FEATURE' || (subscriptionStatus && subscriptionStatus.planType !== 'pro' && error?.includes('403'))) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <UpgradePrompt
          feature="Unit Economics"
          requiredPlan="Pro"
          description="Track cost per business metric (customers, API calls, transactions) to understand unit economics and optimize spending."
        />
      </div>
    )
  }

  if (error) {
    return (
      <div className="card bg-white border-accent-100">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-red-600 mb-2">Error loading data</p>
            <p className="text-sm text-accent-600">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  // Header with Add button (used in both empty and data states)
  const headerSection = (
    <div className="flex items-center justify-between mb-6">
      <div className="flex-1">
        <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-accent-600" />
          Unit Economics
          <button
            onClick={() => setShowInfoDialog(true)}
            className="ml-2 p-1 rounded-full hover:bg-accent-100 transition-colors group"
            title="Learn more about Unit Economics"
          >
            <Info className="h-4 w-4 text-accent-600 group-hover:text-accent-700" />
          </button>
        </h3>
        <p className="text-sm text-accent-600">
          {data && data.unitEconomics.length > 0
            ? `Cost per business metric • Total cost: ${formatCurrency(data.totalCost)}`
            : 'Cost per business metric (customer, API call, transaction)'}
        </p>
      </div>
      <button
        onClick={() => setShowAddModal(true)}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-accent-700 bg-accent-50 hover:bg-accent-100 border border-accent-200 rounded-xl transition-colors"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">Add Metric</span>
      </button>
    </div>
  )

  // Raw metrics table (expandable)
  const rawMetricsSection = showRawMetrics && rawMetrics.length > 0 && (
    <div className="mt-4 border-t border-accent-200 pt-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">Individual Metric Entries</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-accent-200">
              <th className="text-left py-2 px-3 text-xs font-semibold text-accent-700 uppercase">Type</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-accent-700 uppercase">Name</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-accent-700 uppercase">Date</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-accent-700 uppercase">Value</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-accent-700 uppercase w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-accent-100">
            {rawMetrics.map((m) => (
              <tr key={m.id} className="hover:bg-accent-50/50 transition-colors">
                <td className="py-2 px-3 capitalize text-gray-700">{m.metricType}</td>
                <td className="py-2 px-3 text-gray-900">{m.metricName}</td>
                <td className="py-2 px-3 text-gray-600">{typeof m.date === 'string' ? m.date.split('T')[0] : m.date}</td>
                <td className="py-2 px-3 text-right text-gray-900 font-medium">
                  {formatMetricValue(m.metricValue)}
                  {m.unit && <span className="text-gray-500 ml-1">{m.unit}</span>}
                </td>
                <td className="py-2 px-3 text-right">
                  <button
                    onClick={() => handleDeleteMetric(m.id)}
                    disabled={deletingId === m.id}
                    className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    title="Delete metric"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  // Info Dialog (shared between empty and data states)
  const infoDialog = showInfoDialog && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md animate-fade-in" onClick={() => setShowInfoDialog(false)}>
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] max-w-lg w-full mx-4 border border-gray-200/50" onClick={(e) => e.stopPropagation()}>
        <div className="p-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-accent-600" />
              What are Unit Economics?
            </h3>
            <button
              onClick={() => setShowInfoDialog(false)}
              className="p-1 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <div className="space-y-4 text-gray-700">
            <p>
              <strong className="text-accent-700">Unit Economics</strong> measures the cost per unit of business value,
              helping you understand how efficiently you're spending money relative to your business metrics.
            </p>

            <div className="bg-accent-50 rounded-2xl p-5 border border-accent-200/50">
              <h4 className="font-semibold text-accent-800 mb-2">Examples:</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-accent-600 mt-0.5">•</span>
                  <span><strong>Cost per Customer:</strong> Total cloud costs ÷ Number of customers</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent-600 mt-0.5">•</span>
                  <span><strong>Cost per API Call:</strong> Total cloud costs ÷ Number of API requests</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent-600 mt-0.5">•</span>
                  <span><strong>Cost per Transaction:</strong> Total cloud costs ÷ Number of transactions processed</span>
                </li>
              </ul>
            </div>

            <div className="bg-blue-50 rounded-2xl p-5 border border-blue-200/50">
              <h4 className="font-semibold text-blue-800 mb-2">How to Get Started:</h4>
              <p className="text-sm text-blue-700 mb-2">
                Click the <strong>"Add Metric"</strong> button to start tracking business metrics alongside your cloud costs.
              </p>
              <ul className="space-y-1 text-sm text-blue-700">
                <li>• Add your key business metrics (customers, API calls, transactions)</li>
                <li>• Enter values for specific dates to track trends</li>
                <li>• Unit economics will be calculated automatically</li>
              </ul>
            </div>

            <div className="bg-yellow-50 rounded-2xl p-5 border border-yellow-200/50">
              <h4 className="font-semibold text-yellow-800 mb-2">Why It Matters:</h4>
              <p className="text-sm text-yellow-700">
                Unit economics helps you understand if your cloud costs are scaling efficiently with your business growth.
                If cost per customer is increasing, it might indicate inefficiencies or opportunities for optimization.
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setShowInfoDialog(false)}
              className="btn-primary px-6 py-2.5"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (!data || data.unitEconomics.length === 0) {
    return (
      <div className="card bg-white border-accent-100">
        {headerSection}
        <div className="flex items-center justify-center py-12 bg-accent-50 rounded-xl border border-accent-200">
          <div className="text-center">
            <DollarSign className="h-10 w-10 text-accent-600 mx-auto mb-3" />
            <p className="text-accent-900 font-medium mb-1">No business metrics found</p>
            <p className="text-accent-700 text-sm mb-4">
              Add business metrics to calculate unit economics for your cloud costs.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-accent-600 text-white rounded-xl hover:bg-accent-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Your First Metric
            </button>
          </div>
        </div>

        {showAddModal && (
          <AddMetricModal
            onClose={() => setShowAddModal(false)}
            onSuccess={fetchUnitEconomics}
            providerId={providerId}
            accountId={accountId}
          />
        )}
        {infoDialog}
      </div>
    )
  }

  // Sort by unit cost (highest first)
  const sortedEconomics = [...data.unitEconomics].sort((a, b) => {
    const costA = a.unitCost || 0
    const costB = b.unitCost || 0
    return costB - costA
  })

  return (
    <div className="card bg-white border-accent-100">
      {headerSection}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {sortedEconomics.slice(0, 3).map((item) => {
          const Icon = getMetricIcon(item.metricType)
          const hasUnitCost = item.unitCost !== null && item.unitCost > 0

          return (
            <div
              key={`${item.metricType}-${item.metricName}`}
              className="p-4 bg-gradient-to-br from-white to-accent-50/50 rounded-xl border border-accent-200 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-accent-100 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-accent-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wider truncate">
                    {item.metricType}
                  </div>
                  <div className="text-sm font-semibold text-gray-900 truncate">
                    {item.metricName}
                  </div>
                </div>
              </div>

              {hasUnitCost ? (
                <div className="mt-3">
                  <div className="text-2xl font-bold text-gray-900">
                    {formatCurrency(item.unitCost!)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    per {item.unit || item.metricName}
                  </div>
                  <div className="text-xs text-gray-400 mt-2">
                    {formatMetricValue(item.totalMetricValue)} {item.unit || item.metricName}
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-gray-400 text-sm">No data</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Detailed Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-accent-200">
              <th className="text-left py-3 px-4 text-xs font-semibold text-accent-700 uppercase tracking-wider">
                Business Metric
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-accent-700 uppercase tracking-wider">
                Total Metric Value
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-accent-700 uppercase tracking-wider">
                Total Cost
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-accent-700 uppercase tracking-wider">
                Unit Cost
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-accent-700 uppercase tracking-wider">
                Efficiency
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-accent-100">
            {sortedEconomics.map((item) => {
              const Icon = getMetricIcon(item.metricType)
              const hasUnitCost = item.unitCost !== null && item.unitCost > 0
              const isHighCost = hasUnitCost && item.unitCost! > 0.01

              return (
                <tr key={`${item.metricType}-${item.metricName}`} className="hover:bg-accent-50/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-accent-500" />
                      <div>
                        <div className="font-medium text-gray-900">{item.metricName}</div>
                        <div className="text-xs text-gray-500 capitalize">{item.metricType}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="text-gray-900">
                      {formatMetricValue(item.totalMetricValue)}
                    </div>
                    {item.unit && (
                      <div className="text-xs text-gray-500">{item.unit}</div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="font-medium text-gray-900">{formatCurrency(data.totalCost)}</div>
                    <div className="text-xs text-gray-500">{item.daysWithData} days</div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {hasUnitCost ? (
                      <div className="font-medium text-gray-900">
                        {formatCurrency(item.unitCost!)}
                        {item.unit && (
                          <span className="text-xs text-gray-500"> / {item.unit}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {hasUnitCost ? (
                      <div className="flex items-center justify-end gap-1">
                        {isHighCost ? (
                          <>
                            <TrendingUp className="h-4 w-4 text-yellow-600" />
                            <span className="text-xs text-yellow-700 font-medium">High cost/unit</span>
                          </>
                        ) : (
                          <>
                            <TrendingDown className="h-4 w-4 text-green-600" />
                            <span className="text-xs text-green-700 font-medium">Efficient</span>
                          </>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {data.unitEconomics.length > 0 && (
        <div className="mt-4 pt-4 border-t border-accent-200">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <span className="text-accent-700">
                {data.unitEconomics.length} metric{data.unitEconomics.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={handleToggleRawMetrics}
                className="text-xs text-accent-600 hover:text-accent-700 underline underline-offset-2"
              >
                {showRawMetrics ? 'Hide entries' : 'View entries'}
              </button>
            </div>
            <span className="text-xs text-accent-600">
              {startDateStr} to {endDateStr}
            </span>
          </div>
          {rawMetricsSection}
        </div>
      )}

      {showAddModal && (
        <AddMetricModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            fetchUnitEconomics()
            if (showRawMetrics) fetchRawMetrics()
          }}
          providerId={providerId}
          accountId={accountId}
        />
      )}
      {infoDialog}
    </div>
  )
}
