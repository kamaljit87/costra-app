import { useState, useEffect } from 'react'
import { FileText, Download, Trash2, RefreshCw, Info, CheckCircle, XCircle, Clock } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'
import { reportsAPI, productTeamAPI, cloudProvidersAPI } from '../services/api'
import Layout from '../components/Layout'
import Breadcrumbs from '../components/Breadcrumbs'

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

export default function ReportsPage() {
  const { isDemoMode } = useAuth()
  const { showSuccess, showError } = useNotification()
  const [reports, setReports] = useState<Report[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [providers, setProviders] = useState<CloudProviderAccount[]>([])
  const [teams, setTeams] = useState<string[]>([])
  const [products, setProducts] = useState<string[]>([])
  
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
  const [format, setFormat] = useState<'csv' | 'pdf'>('csv')
  const [subscriptionStatus, setSubscriptionStatus] = useState<{ planType: string } | null>(null)

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
      }, 3000) // Poll every 3 seconds
      return () => clearInterval(interval)
    }
  }, [isDemoMode, reports])

  const loadReports = async () => {
    try {
      const response = await reportsAPI.getReports()
      setReports(response.reports || [])
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />
      case 'generating':
        return <RefreshCw className="h-5 w-5 text-accent-600 animate-spin" />
      default:
        return <Clock className="h-5 w-5 text-yellow-600" />
    }
  }

  const filteredAccounts = selectedProvider
    ? providers.filter(p => p.providerId === selectedProvider)
    : providers

  if (isDemoMode) {
    return (
      <Layout>
        <div className="p-6">
          <Breadcrumbs />
          <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <FileText className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Reports Not Available in Demo Mode</h2>
            <p className="text-gray-600">
              Please sign in to create cost visibility and allocation reports.
            </p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-6">
        <Breadcrumbs />

        {/* Header */}
        <div className="mt-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FileText className="h-8 w-8 text-accent-600" />
            Reports
          </h1>
          <p className="mt-2 text-gray-600">
            Create cost visibility and allocation reports for teams and products
          </p>
        </div>

        {/* Info Section */}
        <div className="mb-8 bg-accent-50 border border-accent-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-accent-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-700">
              <p className="font-medium mb-1">About Reports</p>
              <p>
                <strong>Cost Visibility Report:</strong> Shows how much each team or product spent - for viewing only, no billing involved. 
                <strong>Cost Allocation Report:</strong> Allocates costs to teams or products for actual billing and accounting.
                Reports can be generated as CSV or PDF and include detailed cost breakdowns by team, product, and service.
              </p>
            </div>
          </div>
        </div>

        {/* Generate Report Form */}
        <div className="mb-8 bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Create New Report</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Report Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Report Type *</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as 'showback' | 'chargeback')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
              >
                <option value="showback">Cost Visibility Report (View Only)</option>
                <option value="chargeback">Cost Allocation Report (For Billing)</option>
              </select>
            </div>

            {/* Report Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Report Name *</label>
              <input
                type="text"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
                placeholder="e.g., Q1 2025 Team Costs"
              />
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
              />
            </div>

            {/* Provider */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Provider (Optional)</label>
              <select
                value={selectedProvider}
                onChange={(e) => {
                  setSelectedProvider(e.target.value)
                  setSelectedAccount(undefined)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
              >
                <option value="">All Providers</option>
                {Array.from(new Set(providers.map(p => p.providerId))).map(providerId => (
                  <option key={providerId} value={providerId}>
                    {providerId.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Account */}
            {selectedProvider && filteredAccounts.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account (Optional)</label>
                <select
                  value={selectedAccount || ''}
                  onChange={(e) => setSelectedAccount(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Team (Optional)</label>
              <select
                value={selectedTeam}
                onChange={(e) => {
                  setSelectedTeam(e.target.value)
                  setSelectedProduct('')
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
              >
                <option value="">All Teams</option>
                {teams.map(team => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
            </div>

            {/* Product */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product (Optional)</label>
              <select
                value={selectedProduct}
                onChange={(e) => {
                  setSelectedProduct(e.target.value)
                  setSelectedTeam('')
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
              >
                <option value="">All Products</option>
                {products.map(product => (
                  <option key={product} value={product}>{product}</option>
                ))}
              </select>
            </div>

            {/* Format */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Format *</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as 'csv' | 'pdf')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
                disabled={subscriptionStatus?.planType !== 'pro' && format === 'csv'}
              >
                <option value="csv" disabled={subscriptionStatus?.planType !== 'pro'}>
                  CSV {subscriptionStatus?.planType !== 'pro' ? '(Pro only)' : ''}
                </option>
                <option value="pdf">PDF</option>
              </select>
              {subscriptionStatus?.planType !== 'pro' && format === 'csv' && (
                <p className="mt-1 text-xs text-amber-600">
                  CSV export requires Pro subscription. <a href="/settings/billing" className="underline">Upgrade now</a>
                </p>
              )}
            </div>
          </div>

          <button
            onClick={handleGenerateReport}
            disabled={isGenerating || !reportName.trim()}
            className="mt-6 px-6 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? 'Generating...' : 'Generate Report'}
          </button>
        </div>

        {/* Reports List */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Report History</h2>
          
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-8 w-8 text-accent-600 animate-spin" />
            </div>
          ) : reports.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Reports Yet</h3>
              <p className="text-gray-600">
                Generate your first report to start tracking cost allocation.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Report</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Format</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reports.map((report) => (
                    <tr key={report.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{report.reportName}</div>
                        <div className="text-sm text-gray-500">
                          {report.teamName && `Team: ${report.teamName}`}
                          {report.productName && `Product: ${report.productName}`}
                          {report.providerId && ` • ${report.providerId.toUpperCase()}`}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          report.reportType === 'showback'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {report.reportType === 'showback' ? 'Visibility' : 'Allocation'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {report.startDate} to {report.endDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(report.status)}
                          <span className="text-sm text-gray-700 capitalize">{report.status}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 uppercase">
                        {report.fileFormat || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          {report.status === 'completed' && (
                            <button
                              onClick={() => handleDownload(report)}
                              className="text-accent-600 hover:text-accent-700"
                            >
                              <Download className="h-5 w-5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(report.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
