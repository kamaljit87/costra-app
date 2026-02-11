import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

import { useNotification } from '../contexts/NotificationContext'
import { getCostData, getSavingsPlans, CostData, SavingsPlan } from '../services/costService'
import { cloudProvidersAPI, syncAPI, budgetsAPI } from '../services/api'
import Layout from '../components/Layout'
import Breadcrumbs from '../components/Breadcrumbs'
import TotalBillSummary from '../components/TotalBillSummary'
import ProviderSection from '../components/ProviderSection'
import SavingsPlansList from '../components/SavingsPlansList'
import { Sparkles, RefreshCw, Plus, Cloud } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { ProviderIcon } from '../components/CloudProviderIcons'

interface ConfiguredProvider {
  id: number
  accountId: number
  providerId: string
  providerName: string
  accountAlias: string
  isActive: boolean
}

export default function Dashboard() {
  const { isDemoMode } = useAuth()
  const navigate = useNavigate()

  const { showSuccess, showError, showWarning } = useNotification()
  const [costData, setCostData] = useState<CostData[]>([])
  const [savingsPlans, setSavingsPlans] = useState<SavingsPlan[]>([])
  const [configuredProviders, setConfiguredProviders] = useState<ConfiguredProvider[]>([])
  const [providerBudgetCounts, setProviderBudgetCounts] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null)

  const loadData = async () => {
    try {
      const [costs, plans, providersResponse, budgetsResponse] = await Promise.all([
        getCostData(isDemoMode),
        getSavingsPlans(isDemoMode),
        isDemoMode ? Promise.resolve({ providers: [] }) : cloudProvidersAPI.getCloudProviders().catch(() => ({ providers: [] })),
        isDemoMode ? Promise.resolve({ budgets: [] }) : budgetsAPI.getBudgets().catch(() => ({ budgets: [] })),
      ])
      setCostData(costs)
      setSavingsPlans(plans)
      setConfiguredProviders(providersResponse.providers || [])

      // Calculate budget counts per provider for dashboard display
      const budgets = (budgetsResponse as any).budgets || []
      const counts: Record<string, number> = {}
      budgets.forEach((b: any) => {
        if (b.providerId) {
          counts[b.providerId] = (counts[b.providerId] || 0) + 1
        }
      })
      setProviderBudgetCounts(counts)
    } catch (error: any) {
      console.error('Failed to load data:', error)
      showError('Failed to Load Data', error.message || 'Could not load dashboard data. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [isDemoMode])

  const handleSync = async () => {
    if (isDemoMode) {
      showWarning(
        'Demo Mode',
        'Sync is not available in demo mode. Please sign up to sync your cloud providers.'
      )
      return
    }

    setIsSyncing(true)
    try {
      // Clear cache and sync fresh data
      const result = await syncAPI.syncAll()
      if (result.noProviders) {
        showWarning(
          'No Providers Connected',
          'Add a cloud provider in Settings to start syncing cost data.'
        )
      } else if (result.errors && result.errors.length > 0) {
        showWarning(
          'Sync Completed with Errors',
          result.errors.map((e: any) => `${e.providerId || e.accountAlias}: ${e.error}`).join('\n')
        )
      } else {
        showSuccess(
          'Sync Completed Successfully',
          'Data refreshed from cloud providers.'
        )
      }
      // Reload data after sync
      await loadData()
    } catch (error: any) {
      console.error('Sync error:', error)
      showError(
        'Sync Failed',
        error.message || 'Unknown error occurred while syncing.'
      )
    } finally {
      setIsSyncing(false)
    }
  }

  // Calculate totals (in USD — conversion happens at display time via formatCurrency)
  const totalCurrent = costData.reduce((sum, data) => sum + data.currentMonth, 0)
  const totalLastMonth = costData.reduce((sum, data) => sum + data.lastMonth, 0)
  const totalForecast = costData.reduce((sum, data) => sum + data.forecast, 0)
  const totalSavings = costData.reduce((sum, data) => sum + Math.abs(data.savings || 0), 0)
  const totalTaxCurrent = costData.reduce((sum, data) => sum + (data.taxCurrentMonth || 0), 0)
  const totalTaxLastMonth = costData.reduce((sum, data) => sum + (data.taxLastMonth || 0), 0)

  // Average forecast confidence across providers (weighted by forecast amount)
  const avgForecastConfidence = (() => {
    const withConfidence = costData.filter((d: any) => d.forecastConfidence != null)
    if (withConfidence.length === 0) return null
    const totalWeight = withConfidence.reduce((s: number, d: any) => s + (d.forecast || 1), 0)
    return Math.round(withConfidence.reduce((s: number, d: any) => s + d.forecastConfidence * ((d.forecast || 1) / totalWeight), 0))
  })()

  return (
    <Layout>
      <div className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Breadcrumbs */}
        <Breadcrumbs />

        {/* Demo Mode Banner */}
        {isDemoMode && (
          <div className="mb-4 bg-accent-50 border border-accent-100 rounded-xl px-4 py-3 flex items-center space-x-2.5 animate-fade-in">
            <div className="w-8 h-8 rounded-lg bg-accent-100 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-accent-500" />
            </div>
            <div>
              <span className="text-accent-700 font-semibold text-sm">Demo Mode</span>
              <span className="text-gray-500 text-xs ml-2">
                You're viewing sample data. Sign up to connect your cloud accounts.
              </span>
            </div>
          </div>
        )}

        {/* Header with Sync and Add Provider - Compact */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5">
              Dashboard
            </h1>
            <p className="text-xs text-gray-500">
              Multi-cloud cost overview across all your providers
            </p>
          </div>
          {!isDemoMode && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-3 sm:space-y-0">
              <button
                onClick={() => navigate('/settings?tab=providers')}
                className="btn-secondary flex items-center justify-center space-x-2 min-h-[44px]"
                title="Add a new cloud provider account"
              >
                <Plus className="h-4 w-4" />
                <span className="text-sm">Add Provider</span>
              </button>
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="btn-primary flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                title="Sync fresh data from all cloud providers (clears cache)"
              >
                {isSyncing && <Spinner variant="bars" size={16} />}
                <span className="text-sm">{isSyncing ? 'Syncing...' : 'Sync Data'}</span>
              </button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 text-accent-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Loading cost data...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Total Bill Summary - Centered and Prominent */}
            <div className="mb-6">
              <TotalBillSummary
                totalCurrent={totalCurrent}
                totalLastMonth={totalLastMonth}
                totalForecast={totalForecast}
                totalSavings={totalSavings}
                forecastConfidence={avgForecastConfidence}
                totalTaxCurrent={totalTaxCurrent}
                totalTaxLastMonth={totalTaxLastMonth}
              />
            </div>
            {/* Provider Sections with Charts */}
            {(() => {
              const allProviders = new Map<string, CostData>()

              // Add providers with cost data
              costData.forEach(data => {
                allProviders.set(data.provider.id, data)
              })

              // Add configured providers without cost data
              if (!isDemoMode) {
                configuredProviders
                  .filter(p => p.isActive)
                  .forEach(provider => {
                    if (!allProviders.has(provider.providerId)) {
                      allProviders.set(provider.providerId, {
                        provider: {
                          id: provider.providerId,
                          name: provider.accountAlias || provider.providerName,
                        },
                        currentMonth: 0,
                        lastMonth: 0,
                        forecast: 0,
                        credits: 0,
                        savings: 0,
                        taxCurrentMonth: 0,
                        taxLastMonth: 0,
                        services: [],
                        chartData1Month: [],
                        chartData2Months: [],
                        chartData3Months: [],
                        chartData4Months: [],
                        chartData6Months: [],
                        chartData12Months: [],
                        allHistoricalData: [],
                      })
                    }
                  })
              }

              const providersToShow = Array.from(allProviders.values())

              // Show empty state if no providers exist
              if (providersToShow.length === 0 && !isDemoMode) {
                return (
                  <div className="flex flex-col items-center justify-center py-16 px-4">
                    <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mb-6">
                      <Cloud className="h-12 w-12 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No Cloud Providers Connected</h3>
                    <p className="text-gray-600 text-center max-w-md mb-6">
                      Connect your cloud provider accounts to start tracking costs and managing your cloud spending.
                    </p>
                    <button
                      onClick={() => navigate('/settings?tab=providers')}
                      className="btn-primary flex items-center space-x-2"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Your First Provider</span>
                    </button>
                  </div>
                )
              }

              if (providersToShow.length > 0) {
                return (
                  <div className="mb-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">By Provider</h2>
                    <div className="space-y-4">
                      {providersToShow.map((data) => {
                        const hasData = data.currentMonth > 0 || data.services.length > 0
                        return (
                          <div key={data.provider.id} className="animate-fade-in">
                            {hasData ? (
                              <ProviderSection
                                providerId={data.provider.id}
                                providerName={data.provider.name}
                                currentMonth={data.currentMonth}
                                lastMonth={data.lastMonth}
                                forecast={data.forecast}
                                credits={data.credits}
                                savings={data.savings}
                                budgetCount={providerBudgetCounts[data.provider.id] || 0}
                                chartData1Month={data.chartData1Month}
                                chartData2Months={data.chartData2Months}
                                chartData3Months={data.chartData3Months}
                                chartData4Months={data.chartData4Months}
                                chartData6Months={data.chartData6Months}
                                chartData12Months={data.chartData12Months}
                                isExpanded={expandedProvider === data.provider.id}
                                onToggle={() => setExpandedProvider(
                                  expandedProvider === data.provider.id ? null : data.provider.id
                                )}
                              />
                            ) : (
                              <div className="card">
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center space-x-4">
                                    <div className="w-14 h-14 flex items-center justify-center rounded-2xl shrink-0">
                                      <ProviderIcon providerId={data.provider.id} size={32} />
                                    </div>
                                    <div>
                                      <h2 className="text-xl font-bold text-gray-900">{data.provider.name}</h2>
                                      <p className="text-sm text-gray-500">No cost data available yet</p>
                                    </div>
                                  </div>
                                  <Link
                                    to={`/provider/${data.provider.id}`}
                                    className="btn-secondary"
                                    title="View provider details"
                                  >
                                    View Details
                                  </Link>
                                </div>
                                <div className="bg-surface-50 rounded-xl p-6 text-center border border-surface-100">
                                  <p className="text-gray-600 mb-2">Cost data will appear here once your provider is synced.</p>
                                  <p className="text-sm text-gray-400">Click "Sync Data" to fetch the latest costs from your cloud provider.</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              } else {
                return (
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">By Provider</h2>
                    <div className="card text-center py-16">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
                        <Cloud className="h-8 w-8 text-gray-400" />
                      </div>
                      <p className="text-gray-600 mb-4">No cloud providers configured yet.</p>
                      <Link
                        to="/settings?tab=providers"
                        className="btn-primary inline-flex"
                      >
                        Add Cloud Provider
                      </Link>
                    </div>
                  </div>
                )
              }
            })()}

            {/* Savings Plans */}
            <div className="mb-5">
              <SavingsPlansList plans={savingsPlans} />
            </div>
          </>
        )}

      </div>
    </Layout>
  )
}
