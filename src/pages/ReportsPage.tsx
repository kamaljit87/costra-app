import { useState, useEffect, useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import {
  FileText,
  Download,
  Trash2,
  RefreshCw,
  Info,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  Calendar,
  BarChart3,
  Loader2,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'
import { reportsAPI, productTeamAPI, cloudProvidersAPI } from '../services/api'
import Layout from '../components/Layout'

interface Report {
  id: number
  reportType: 'showback' | 'chargeback'
  reportName: string
  startDate: string
  endDate: string
  providerId?: string
  accountId?: number
  teamName?: string
  productName?: string
  fileFormat?: 'csv' | 'pdf'
  status: 'pending' | 'generating' | 'completed' | 'failed'
  createdAt: string
  completedAt?: string
}

interface CloudProviderAccount {
  id: number
  accountId: number
  providerId: string
  providerName: string
  accountAlias: string
  isActive: boolean
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending: { label: 'Pending', color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/30 dark:border-yellow-800', icon: Clock },
  generating: { label: 'Generating', color: 'text-accent-700 dark:text-accent-400', bg: 'bg-accent-50 border-accent-200 dark:bg-accent-900/30 dark:border-accent-800', icon: RefreshCw },
  completed: { label: 'Completed', color: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-800', icon: CheckCircle },
  failed: { label: 'Failed', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 border-red-200 dark:bg-red-900/30 dark:border-red-800', icon: XCircle },
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  const Icon = config.icon
  const isSpinning = status === 'generating'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${config.bg} ${config.color}`}>
      <Icon className={`h-3 w-3 ${isSpinning ? 'animate-spin' : ''}`} />
      {config.label}
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  const isShowback = type === 'showback'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
      isShowback
        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
        : 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    }`}>
      {isShowback ? 'Visibility' : 'Allocation'}
    </span>
  )
}

const INPUT_CLASS = 'w-full px-4 py-2.5 border border-gray-300/60 rounded-xl bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500/60 text-sm transition-colors'

export default function ReportsPage() {
  const { isDemoMode } = useAuth()
  const { showSuccess, showError } = useNotification()
  const [reports, setReports] = useState<Report[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [providers, setProviders] = useState<CloudProviderAccount[]>([])
  const [teams, setTeams] = useState<string[]>([])
  const [products, setProducts] = useState<string[]>([])
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [reportType, setReportType] = useState<'showback' | 'chargeback'>('showback')
  const [reportName, setReportName] = useState('')
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - 1)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [selectedAccount, setSelectedAccount] = useState<number | undefined>()
  const [selectedTeam, setSelectedTeam] = useState<string>('')
  const [selectedProduct, setSelectedProduct] = useState<string>('')
  const [format, setFormat] = useState<'csv' | 'pdf'>('pdf')
  const [subscriptionStatus, setSubscriptionStatus] = useState<{ planType: string } | null>(null)

  const stats = useMemo(() => ({
    total: reports.length,
    completed: reports.filter(r => r.status === 'completed').length,
    inProgress: reports.filter(r => r.status === 'generating' || r.status === 'pending').length,
  }), [reports])

  useEffect(() => {
    if (!isDemoMode) {
      loadReports()
      loadProviders()
      loadTeamsAndProducts()
      loadSubscriptionStatus()
    }
  }, [isDemoMode])

  const loadSubscriptionStatus = async () => {
    try {
      const { billingAPI } = await import('../services/api')
      const response = await billingAPI.getSubscription()
      setSubscriptionStatus(response.status)
    } catch (error) {
      console.error('Failed to load subscription status:', error)
    }
  }

  useEffect(() => {
    if (!isDemoMode && reports.some(r => r.status === 'generating' || r.status === 'pending')) {
      const interval = setInterval(() => {
        loadReports()
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [isDemoMode, reports])

  const loadReports = async () => {
    try {
      const response = await reportsAPI.getReports()
      setReports(response.data || response.reports || [])
    } catch (error) {
      console.error('Failed to load reports:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadProviders = async () => {
    try {
      const response = await cloudProvidersAPI.getCloudProviders()
      setProviders(response.providers || [])
    } catch (error) {
      console.error('Failed to load providers:', error)
    }
  }

  const loadTeamsAndProducts = async () => {
    try {
      const [teamsResponse, productsResponse] = await Promise.all([
        productTeamAPI.getCostByTeam(startDate, endDate).catch(() => ({ teams: [] })),
        productTeamAPI.getCostByProduct(startDate, endDate).catch(() => ({ products: [] }))
      ])
      setTeams((teamsResponse.teams || []).map((t: any) => t.teamName))
      setProducts((productsResponse.products || []).map((p: any) => p.productName))
    } catch (error) {
      console.error('Failed to load teams/products:', error)
    }
  }

  const handleGenerateReport = async () => {
    if (!reportName.trim()) {
      showError('Please enter a report name')
      return
    }

    setIsGenerating(true)
    try {
      const reportData = {
        reportName: reportName.trim(),
        startDate,
        endDate,
        providerId: selectedProvider || undefined,
        accountId: selectedAccount,
        teamName: selectedTeam || undefined,
        productName: selectedProduct || undefined,
        format
      }

      if (reportType === 'showback') {
        await reportsAPI.generateShowbackReport(reportData)
      } else {
        await reportsAPI.generateChargebackReport(reportData)
      }

      showSuccess('Report generation started')
      setReportName('')
      setShowForm(false)
      loadReports()
    } catch (error: any) {
      showError(error.message || 'Failed to generate report')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = async (report: Report) => {
    try {
      await reportsAPI.downloadReport(report.id)
      showSuccess('Report downloaded')
    } catch (error: any) {
      showError(error.message || 'Failed to download report')
    }
  }

  const handleDelete = async (reportId: number) => {
    if (!confirm('Are you sure you want to delete this report?')) return

    try {
      await reportsAPI.deleteReport(reportId)
      showSuccess('Report deleted')
      loadReports()
    } catch (error: any) {
      showError(error.message || 'Failed to delete report')
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatTimestamp = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const filteredAccounts = selectedProvider
    ? providers.filter(p => p.providerId === selectedProvider)
    : providers

  if (isDemoMode) {
    return (
      <Layout>
        <Helmet><title>Reports | Costra</title></Helmet>
        <div className="max-w-6xl mx-auto">
          <div className="mt-8 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6 text-center">
            <FileText className="h-12 w-12 text-yellow-600 dark:text-yellow-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Reports Not Available in Demo Mode</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Please sign in to create cost visibility and allocation reports.
            </p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <Helmet><title>Reports | Costra</title></Helmet>

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="h-6 w-6 text-accent-600" />
              Reports
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Generate cost visibility and allocation reports
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent-600 text-white text-sm font-medium rounded-xl hover:bg-accent-700 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            New Report
          </button>
        </div>

        {/* Create Report Form (collapsible) */}
        {showForm && (
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Create New Report</h2>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Report Type */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Report Type</label>
                  <select value={reportType} onChange={(e) => setReportType(e.target.value as 'showback' | 'chargeback')} className={INPUT_CLASS}>
                    <option value="showback">Cost Breakdown (Showback)</option>
                    <option value="chargeback">Cost Allocation (Chargeback)</option>
                  </select>
                  <div className="mt-2 flex items-start gap-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2.5">
                    <Info className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {reportType === 'showback'
                        ? 'See how costs are distributed across teams and products — for awareness only, no billing involved.'
                        : 'Assign and allocate costs to teams or cost centers for internal billing and accounting.'}
                    </p>
                  </div>
                </div>

                {/* Report Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Report Name</label>
                  <input
                    type="text"
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
                    className={INPUT_CLASS}
                    placeholder="e.g., Q1 2026 Team Costs"
                  />
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Start Date</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={INPUT_CLASS} />
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">End Date</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={INPUT_CLASS} />
                </div>

                {/* Provider */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Provider <span className="text-gray-400 font-normal">(optional)</span></label>
                  <select
                    value={selectedProvider}
                    onChange={(e) => { setSelectedProvider(e.target.value); setSelectedAccount(undefined) }}
                    className={INPUT_CLASS}
                  >
                    <option value="">All Providers</option>
                    {Array.from(new Set(providers.map(p => p.providerId))).map(providerId => (
                      <option key={providerId} value={providerId}>{providerId.toUpperCase()}</option>
                    ))}
                  </select>
                </div>

                {/* Account */}
                {selectedProvider && filteredAccounts.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Account <span className="text-gray-400 font-normal">(optional)</span></label>
                    <select
                      value={selectedAccount || ''}
                      onChange={(e) => setSelectedAccount(e.target.value ? parseInt(e.target.value) : undefined)}
                      className={INPUT_CLASS}
                    >
                      <option value="">All Accounts</option>
                      {filteredAccounts.map(account => (
                        <option key={account.accountId} value={account.accountId}>
                          {account.accountAlias || `${account.providerName} - Account ${account.accountId}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Team */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Team <span className="text-gray-400 font-normal">(optional)</span></label>
                  <select
                    value={selectedTeam}
                    onChange={(e) => { setSelectedTeam(e.target.value); setSelectedProduct('') }}
                    className={INPUT_CLASS}
                  >
                    <option value="">All Teams</option>
                    {teams.map(team => (<option key={team} value={team}>{team}</option>))}
                  </select>
                </div>

                {/* Product */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Product <span className="text-gray-400 font-normal">(optional)</span></label>
                  <select
                    value={selectedProduct}
                    onChange={(e) => { setSelectedProduct(e.target.value); setSelectedTeam('') }}
                    className={INPUT_CLASS}
                  >
                    <option value="">All Products</option>
                    {products.map(product => (<option key={product} value={product}>{product}</option>))}
                  </select>
                </div>

                {/* Format */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Format</label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value as 'csv' | 'pdf')}
                    className={INPUT_CLASS}
                  >
                    <option value="pdf">PDF</option>
                    {subscriptionStatus?.planType === 'pro' && (
                      <option value="csv">CSV</option>
                    )}
                  </select>
                  {subscriptionStatus?.planType !== 'pro' && (
                    <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                      CSV export available on Pro plan. <a href="/settings/billing" className="underline text-accent-600 dark:text-accent-400">Upgrade</a>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={handleGenerateReport}
                  disabled={isGenerating || !reportName.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-600 text-white text-sm font-medium rounded-xl hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isGenerating ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                  ) : (
                    <>Generate Report</>
                  )}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats bar */}
        {!isLoading && reports.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3">
              <p className="text-xs text-green-600 dark:text-green-400">Completed</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.completed}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3">
              <p className="text-xs text-accent-600 dark:text-accent-400">In Progress</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.inProgress}</p>
            </div>
          </div>
        )}

        {/* Report History */}
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Report History</h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 text-accent-600 animate-spin" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <BarChart3 className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400 font-medium">No reports yet</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                Click "New Report" to generate your first cost report
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-5 py-4 flex items-center gap-4 hover:shadow-sm transition-shadow"
                >
                  {/* Report info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900 dark:text-white text-sm truncate">{report.reportName}</h3>
                      <TypeBadge type={report.reportType} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(report.startDate)} – {formatDate(report.endDate)}
                      </span>
                      {report.teamName && <span>Team: {report.teamName}</span>}
                      {report.productName && <span>Product: {report.productName}</span>}
                      {report.providerId && <span>{report.providerId.toUpperCase()}</span>}
                      {report.fileFormat && (
                        <span className="uppercase font-medium text-gray-400 dark:text-gray-500">{report.fileFormat}</span>
                      )}
                      <span className="text-gray-400 dark:text-gray-500">
                        {formatTimestamp(report.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Status */}
                  <StatusBadge status={report.status} />

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {report.status === 'completed' && (
                      <button
                        onClick={() => handleDownload(report)}
                        className="p-2 text-accent-600 dark:text-accent-400 hover:bg-accent-50 dark:hover:bg-accent-900/30 rounded-lg transition-colors"
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(report.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
