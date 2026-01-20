import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCurrency } from '../contexts/CurrencyContext'
import { useNotification } from '../contexts/NotificationContext'
import { getCostData, getSavingsPlans, CostData, SavingsPlan } from '../services/costService'
import { cloudProvidersAPI, syncAPI } from '../services/api'
import Layout from '../components/Layout'
import Breadcrumbs from '../components/Breadcrumbs'
import TotalBillSummary from '../components/TotalBillSummary'
import ProviderSection from '../components/ProviderSection'
import SavingsPlansList from '../components/SavingsPlansList'
import BudgetWidget from '../components/BudgetWidget'
import { Sparkles, RefreshCw, Cloud } from 'lucide-react'
import { ProviderIcon, getProviderColor } from '../components/CloudProviderIcons'

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
  const { convertAmount } = useCurrency()
  const { showSuccess, showError, showWarning } = useNotification()
  const [costData, setCostData] = useState<CostData[]>([])
  const [savingsPlans, setSavingsPlans] = useState<SavingsPlan[]>([])
  const [configuredProviders, setConfiguredProviders] = useState<ConfiguredProvider[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)

  const loadData = async () => {
    try {
      const [costs, plans, providersResponse] = await Promise.all([
        getCostData(isDemoMode),
        getSavingsPlans(isDemoMode),
        isDemoMode ? Promise.resolve({ providers: [] }) : cloudProvidersAPI.getCloudProviders().catch(() => ({ providers: [] })),
      ])
      setCostData(costs)
      setSavingsPlans(plans)
      setConfiguredProviders(providersResponse.providers || [])
    } catch (error) {
      console.error('Failed to load data:', error)
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
      if (result.errors && result.errors.length > 0) {
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

  // Calculate totals
  const totalCurrent = costData.reduce((sum, data) => sum + convertAmount(data.currentMonth), 0)
  const totalLastMonth = costData.reduce((sum, data) => sum + convertAmount(data.lastMonth), 0)
  const totalForecast = costData.reduce((sum, data) => sum + convertAmount(data.forecast), 0)
  
  // Calculate credits - ensure they're always positive (credits reduce cost)
  // Credits from API might be negative (AWS returns them as negative), so we use Math.abs
  // IMPORTANT: Sum credits from all accounts - each account has its own credits
  // If there are multiple accounts for the same provider, each account's credits are separate
  const totalCredits = costData.reduce((sum, data) => {
    const creditValue = convertAmount(data.credits || 0)
    // Credits should always be positive - they reduce your bill
    const positiveCredit = Math.abs(creditValue)
    return sum + positiveCredit
  }, 0)
  
  // Debug logging to help identify duplicate credits issue
  if (costData.length > 0 && totalCredits > 0) {
    const creditsBreakdown = costData
      .filter(d => d.credits && Math.abs(convertAmount(d.credits || 0)) > 0)
      .map(d => ({
        provider: d.provider.name,
        providerId: d.provider.id,
        rawCredits: d.credits,
        converted: convertAmount(d.credits || 0),
        abs: Math.abs(convertAmount(d.credits || 0))
      }))
    
    console.log('[Dashboard] Credit calculation:', {
      totalCostDataEntries: costData.length,
      entriesWithCredits: creditsBreakdown.length,
      creditsBreakdown,
      totalCredits,
      note: 'If totalCredits seems too high, check for duplicate entries or multiple accounts'
    })
  }
  
  const totalSavings = costData.reduce((sum, data) => sum + Math.abs(convertAmount(data.savings || 0)), 0)

  return (
    <Layout>
      <div className="w-full px-6 lg:px-8 py-8">
        {/* Breadcrumbs */}
        <Breadcrumbs />

        {/* Demo Mode Banner */}
        {isDemoMode && (
          <div className="mb-4 bg-[#F0FDFA] border border-[#BBF7D0] rounded-2xl px-4 py-3 flex items-center space-x-2.5 animate-fade-in">
            <div className="w-8 h-8 rounded-xl bg-[#CCFBF1] flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-[#22B8A0]" />
            </div>
            <div>
              <span className="text-[#0F766E] font-semibold text-sm">Demo Mode</span>
              <span className="text-[#64748B] text-xs ml-2">
                You're viewing sample data. Sign up to connect your cloud accounts.
              </span>
            </div>
          </div>
        )}

        {/* Header with Sync - Compact */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A] mb-0.5">
              Dashboard
            </h1>
            <p className="text-xs text-[#64748B]">
              Multi-cloud cost overview across all your providers
            </p>
          </div>
          {!isDemoMode && (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Sync fresh data from all cloud providers (clears cache)"
            >
              <Cloud className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="text-sm">{isSyncing ? 'Syncing...' : 'Sync Data'}</span>
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 text-frozenWater-600 animate-spin mx-auto mb-4" />
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
                totalCredits={totalCredits}
                totalSavings={totalSavings}
              />
            </div>

            {/* Budget Widget */}
            {!isDemoMode && (
              <div className="mb-5">
                <BudgetWidget />
              </div>
            )}


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
              
              if (providersToShow.length > 0) {
                return (
                  <div className="mb-6">
                    <h2 className="text-xl font-bold text-[#0F172A] mb-4">By Provider</h2>
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
                                chartData1Month={data.chartData1Month}
                                chartData2Months={data.chartData2Months}
                                chartData3Months={data.chartData3Months}
                                chartData4Months={data.chartData4Months}
                                chartData6Months={data.chartData6Months}
                                chartData12Months={data.chartData12Months}
                              />
                            ) : (
                              <div className="card">
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center space-x-4">
                                    <div 
                                      className="w-14 h-14 flex items-center justify-center rounded-2xl"
                                      style={{ backgroundColor: `${getProviderColor(data.provider.id)}15` }}
                                    >
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
                                <div className="bg-surface-50 rounded-xl p-6 text-center border border-gray-100">
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
                        to="/settings"
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

            {/* Floating Action Button */}
            <button
              onClick={handleSync}
              disabled={isSyncing || isDemoMode}
              className="fixed bottom-8 right-8 w-14 h-14 bg-frozenWater-600 text-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed z-50"
              title="Quick sync"
            >
              <Sparkles className={`h-6 w-6 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
          </>
        )}
      </div>
    </Layout>
  )
}
