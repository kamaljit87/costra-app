import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCurrency } from '../contexts/CurrencyContext'
import { useNotification } from '../contexts/NotificationContext'
import { getCostData, getSavingsPlans, CostData, SavingsPlan } from '../services/costService'
import { cloudProvidersAPI, syncAPI } from '../services/api'
import Layout from '../components/Layout'
import TotalBillSummary from '../components/TotalBillSummary'
import ProviderSection from '../components/ProviderSection'
import SavingsPlansList from '../components/SavingsPlansList'
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
  const totalCredits = costData.reduce((sum, data) => sum + convertAmount(data.credits), 0)
  const totalSavings = costData.reduce((sum, data) => sum + convertAmount(data.savings), 0)

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Demo Mode Banner */}
        {isDemoMode && (
          <div className="mb-6 bg-primary-50 border border-primary-200 rounded-2xl px-5 py-4 flex items-center space-x-3 animate-fade-in">
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <span className="text-primary-700 font-semibold">Demo Mode</span>
              <span className="text-primary-600 text-sm ml-2">
                You're viewing sample data. Sign up to connect your cloud accounts.
              </span>
            </div>
          </div>
        )}

        {/* Header with Sync */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Cost Dashboard</h1>
            <p className="text-gray-500">
              Multi-cloud cost overview across all your providers
            </p>
          </div>
          {!isDemoMode && (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="btn-primary flex items-center space-x-2"
              title="Sync fresh data from all cloud providers (clears cache)"
            >
              <Cloud className={`h-5 w-5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Data'}</span>
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 text-primary-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Loading cost data...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Total Bill Summary */}
            <TotalBillSummary
              totalCurrent={totalCurrent}
              totalLastMonth={totalLastMonth}
              totalForecast={totalForecast}
              totalCredits={totalCredits}
              totalSavings={totalSavings}
            />

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
                  <div className="mb-8">
                    <h2 className="text-xl font-bold text-gray-900 mb-6">By Provider</h2>
                    <div className="space-y-6">
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
                    <h2 className="text-xl font-bold text-gray-900 mb-6">By Provider</h2>
                    <div className="card text-center py-12">
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
            <div className="mb-8">
              <SavingsPlansList plans={savingsPlans} />
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
