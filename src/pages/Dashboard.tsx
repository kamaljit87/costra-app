import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

import { useNotification } from '../contexts/NotificationContext'
import { getCostData, getSavingsPlans, CostData, SavingsPlan } from '../services/costService'
import { cloudProvidersAPI, syncAPI, budgetsAPI, costDataAPI, goalsAPI, billingAPI } from '../services/api'
import Layout from '../components/Layout'
import Breadcrumbs from '../components/Breadcrumbs'
import TotalBillSummary from '../components/TotalBillSummary'
import ProviderSection from '../components/ProviderSection'
import SavingsPlansList from '../components/SavingsPlansList'
import OptimizationSummary from '../components/OptimizationSummary'
import { Sparkles, RefreshCw, Plus, Cloud, ArrowRight, Download, Target, Trash2 } from 'lucide-react'
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
  const [exportingFormat, setExportingFormat] = useState<'csv' | 'pdf' | null>(null)
  const [goals, setGoals] = useState<Array<{ id: number; name?: string; target_value: number; period: string }>>([])
  const [goalsProgress, setGoalsProgress] = useState<Record<number, { percentChange: number; targetPercent: number; currentSpend: number; baselineSpend: number }>>({})
  const [goalsLoading, setGoalsLoading] = useState(false)
  const [addingGoal, setAddingGoal] = useState(false)
  const [historicalDataMonths, setHistoricalDataMonths] = useState(12)

  const loadData = async () => {
    try {
      const [costs, plans, providersResponse, budgetsResponse, subscriptionResponse] = await Promise.all([
        getCostData(isDemoMode),
        getSavingsPlans(isDemoMode),
        isDemoMode ? Promise.resolve({ providers: [] }) : cloudProvidersAPI.getCloudProviders().catch(() => ({ providers: [] })),
        isDemoMode ? Promise.resolve({ budgets: [] }) : budgetsAPI.getBudgets().catch(() => ({ budgets: [] })),
        isDemoMode ? Promise.resolve(null) : billingAPI.getSubscription().catch(() => null),
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
      if (subscriptionResponse?.limits?.historicalDataMonths) {
        setHistoricalDataMonths(subscriptionResponse.limits.historicalDataMonths)
      }
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

  useEffect(() => {
    if (isDemoMode) return
    setGoalsLoading(true)
    // Single batch request for goals + progress instead of N+1 calls
    Promise.all([
      goalsAPI.getList(),
      goalsAPI.getAllProgress(),
    ]).then(([list, progressList]) => {
      setGoals(list)
      const map: Record<number, { percentChange: number; targetPercent: number; currentSpend: number; baselineSpend: number }> = {}
      for (const p of progressList) {
        if (p?.goal?.id != null) {
          map[p.goal.id] = { percentChange: p.percentChange, targetPercent: p.targetPercent, currentSpend: p.currentSpend, baselineSpend: p.baselineSpend }
        }
      }
      setGoalsProgress(map)
    }).catch(() => {}).finally(() => setGoalsLoading(false))
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

  const handleAddGoal = async () => {
    const raw = window.prompt('Target reduction (%): e.g. 10 for 10%')
    if (raw == null) return
    const n = parseFloat(raw)
    if (Number.isNaN(n) || n < 0) {
      showError('Invalid target', 'Enter a number (e.g. 10 for 10% reduction).')
      return
    }
    setAddingGoal(true)
    try {
      const goal = await goalsAPI.create({ target_value: n, period: 'quarter', baseline: 'same_period_last_year' })
      setGoals((prev) => [goal, ...prev])
      const progress = await goalsAPI.getProgress(goal.id)
      setGoalsProgress((prev) => ({ ...prev, [goal.id]: { percentChange: progress.percentChange, targetPercent: progress.targetPercent, currentSpend: progress.currentSpend, baselineSpend: progress.baselineSpend } }))
    } catch (err: any) {
      showError('Failed to add goal', err.message || 'Could not create goal.')
    } finally {
      setAddingGoal(false)
    }
  }

  const handleDeleteGoal = async (id: number) => {
    try {
      await goalsAPI.delete(id)
      setGoals((prev) => prev.filter((g) => g.id !== id))
      setGoalsProgress((prev) => { const next = { ...prev }; delete next[id]; return next })
    } catch (_) { /* ignore */ }
  }

  const handleExport = async (format: 'csv' | 'pdf') => {
    if (isDemoMode) {
      showWarning('Demo Mode', 'Export is not available in demo mode.')
      return
    }
    const now = new Date()
    const month = now.getMonth() + 1
    const year = now.getFullYear()
    setExportingFormat(format)
    try {
      await costDataAPI.exportCostData(month, year, format)
      showSuccess('Export complete', `Cost data exported as ${format.toUpperCase()}.`)
    } catch (err: any) {
      showError('Export failed', err.message || 'Could not export. You may need a Pro plan.')
    } finally {
      setExportingFormat(null)
    }
  }

  // Calculate totals (in USD — conversion happens at display time via formatCurrency)
  const totalCurrent = costData.reduce((sum, data) => sum + data.currentMonth, 0)
  const totalLastMonth = costData.reduce((sum, data) => sum + data.lastMonth, 0)
  const totalLastMonthSamePeriod = costData.reduce(
    (sum, data) => sum + (typeof data.lastMonthSamePeriod === 'number' ? data.lastMonthSamePeriod : 0),
    0
  )
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
          <div className="mb-4 bg-accent-50 dark:bg-accent-900/30 border border-accent-100 dark:border-accent-800 rounded-xl px-4 py-3 flex items-center space-x-2.5 animate-fade-in">
            <div className="w-8 h-8 rounded-lg bg-accent-100 dark:bg-accent-800/50 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-accent-500 dark:text-accent-400" />
            </div>
            <div>
              <span className="text-accent-700 dark:text-accent-300 font-semibold text-sm">Demo Mode</span>
              <span className="text-gray-500 dark:text-gray-400 text-xs ml-2">
                You're viewing sample data. Sign up to connect your cloud accounts.
              </span>
            </div>
          </div>
        )}

        {/* Header with Sync and Add Provider - Compact */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-0.5">
              Dashboard
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-300">
              Multi-cloud cost overview across all your providers
            </p>
          </div>
          {!isDemoMode && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <button
                onClick={() => navigate('/settings?tab=providers')}
                className="btn-secondary"
                title="Add a new cloud provider account"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="text-sm">Add Provider</span>
              </button>
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="btn-primary"
                title="Sync fresh data from all cloud providers (clears cache)"
              >
                {isSyncing && <Spinner variant="bars" size={16} className="shrink-0" />}
                <span className="text-sm">{isSyncing ? 'Syncing...' : 'Sync Data'}</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExport('csv')}
                  disabled={!!exportingFormat}
                  className="btn-secondary"
                  title="Export cost data as CSV"
                >
                  {exportingFormat === 'csv' ? <Spinner variant="bars" size={16} className="shrink-0" /> : <Download className="h-4 w-4 shrink-0" />}
                  <span className="text-sm">Export CSV</span>
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  disabled={!!exportingFormat}
                  className="btn-secondary"
                  title="Export cost data as PDF"
                >
                  {exportingFormat === 'pdf' ? <Spinner variant="bars" size={16} className="shrink-0" /> : <Download className="h-4 w-4 shrink-0" />}
                  <span className="text-sm">Export PDF</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 text-accent-600 dark:text-accent-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Loading cost data...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Total Bill Summary - Centered and Prominent */}
            <div className="mb-6">
              <TotalBillSummary
                totalCurrent={totalCurrent}
                totalLastMonth={totalLastMonth}
                totalLastMonthSamePeriod={totalLastMonthSamePeriod > 0 ? totalLastMonthSamePeriod : undefined}
                totalForecast={totalForecast}
                totalSavings={totalSavings}
                forecastConfidence={avgForecastConfidence}
                totalTaxCurrent={totalTaxCurrent}
                totalTaxLastMonth={totalTaxLastMonth}
              />
            </div>
            {/* Optimization Insights */}
            {!isDemoMode && <OptimizationSummary />}
            {/* Spend goals */}
            {!isDemoMode && (
              <div className="mb-6">
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-accent-600 dark:text-accent-400" />
                      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Spend goals</h2>
                    </div>
                    <button type="button" onClick={handleAddGoal} disabled={addingGoal} className="btn-secondary text-sm py-2">
                      {addingGoal ? <Spinner variant="bars" size={14} /> : <Plus className="h-4 w-4" />}
                      <span>Add goal</span>
                    </button>
                  </div>
                  {goalsLoading ? (
                    <p className="text-sm text-gray-500 dark:text-gray-300">Loading goals…</p>
                  ) : goals.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-300">Set a target (e.g. reduce spend by 10% this quarter vs same period last year).</p>
                  ) : (
                    <ul className="space-y-3">
                      {goals.map((g) => {
                        const prog = goalsProgress[g.id]
                        const label = g.name || `Reduce by ${g.target_value}%`
                        const done = prog ? prog.percentChange >= g.target_value : false
                        const pct = prog ? Math.min(100, Math.max(0, (prog.percentChange / g.target_value) * 100)) : 0
                        return (
                          <li key={g.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{label}</span>
                                {prog != null && (
                                  <span className={`text-sm shrink-0 ${done ? 'text-success-600 dark:text-success-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                    {prog.percentChange.toFixed(1)}% vs {g.target_value}% target
                                  </span>
                                )}
                              </div>
                              {prog != null && (
                                <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden">
                                  <div className={`h-full rounded-full ${done ? 'bg-success-500' : 'bg-accent-500'}`} style={{ width: `${pct}%` }} />
                                </div>
                              )}
                            </div>
                            <button type="button" onClick={() => handleDeleteGoal(g.id)} className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded" aria-label="Delete goal">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}
            {/* Provider Sections with Charts */}
            {(() => {
              const providerDataMap = new Map<string, CostData>()

              // Add providers with cost data
              costData.forEach(data => {
                providerDataMap.set(data.provider.id, data)
              })

              // Add configured providers without cost data
              if (!isDemoMode) {
                configuredProviders
                  .filter(p => p.isActive)
                  .forEach(provider => {
                    if (!providerDataMap.has(provider.providerId)) {
                      providerDataMap.set(provider.providerId, {
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

              // Only show providers that have been added (have cost data or are configured)
              const providersToShow = Array.from(providerDataMap.values())

              if (providersToShow.length === 0 && !isDemoMode) {
                return (
                  <div className="flex flex-col items-center justify-center py-16 px-4">
                    <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-6">
                      <Cloud className="h-12 w-12 text-gray-400 dark:text-gray-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">No Cloud Providers Connected</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-center max-w-md mb-6">
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

              return (
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">By Provider</h2>
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
                              lastMonthSamePeriod={typeof data.lastMonthSamePeriod === 'number' ? data.lastMonthSamePeriod : undefined}
                              taxCurrentMonth={data.taxCurrentMonth}
                              taxLastMonth={data.taxLastMonth}
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
                              maxHistoricalMonths={historicalDataMonths}
                              isExpanded={expandedProvider === data.provider.id}
                              onToggle={() => setExpandedProvider(
                                expandedProvider === data.provider.id ? null : data.provider.id
                              )}
                              />
                            ) : (
                              <div className="card group">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-4">
                                    <div className="w-14 h-14 flex items-center justify-center rounded-2xl shrink-0">
                                      <ProviderIcon providerId={data.provider.id} size={32} />
                                    </div>
                                    <div>
                                      <h2 className="text-lg font-bold text-gray-900">{data.provider.name}</h2>
                                      <div className="flex items-center space-x-3 text-sm mt-1">
                                        <span className="font-semibold text-gray-500">No cost data yet</span>
                                        <span className="text-xs text-gray-400">Sync to fetch costs</span>
                                      </div>
                                    </div>
                                  </div>
                                  <Link
                                    to={`/provider/${data.provider.id}`}
                                    className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-accent-600 hover:text-accent-700 bg-accent-50 hover:bg-accent-100 rounded-lg transition-all duration-150"
                                    title="View provider details"
                                  >
                                    <span>Details</span>
                                    <ArrowRight className="h-3.5 w-3.5" />
                                  </Link>
                                </div>
                              </div>
                            )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
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
