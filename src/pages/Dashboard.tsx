import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCurrency } from '../contexts/CurrencyContext'
import { useFilters } from '../contexts/FilterContext'
import { getCostData, getSavingsPlans, CostData, SavingsPlan } from '../services/costService'
import { cloudProvidersAPI, syncAPI } from '../services/api'
import Layout from '../components/Layout'
import TotalBillSummary from '../components/TotalBillSummary'
import ProviderSection from '../components/ProviderSection'
import SavingsPlansList from '../components/SavingsPlansList'
import FilterBar from '../components/FilterBar'
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
  const { selectedService, showCreditsOnly } = useFilters()
  const [costData, setCostData] = useState<CostData[]>([])
  const [savingsPlans, setSavingsPlans] = useState<SavingsPlan[]>([])
  const [configuredProviders, setConfiguredProviders] = useState<ConfiguredProvider[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
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
      setIsRefreshing(false)
    }
  }

  // Get all unique services from cost data
  const allServices = useMemo(() => {
    const services: string[] = []
    costData.forEach(data => {
      data.services.forEach(service => {
        if (service.name && !services.includes(service.name)) {
          services.push(service.name)
        }
      })
    })
    return services.sort()
  }, [costData])

  // Check if any provider has credits
  const hasAnyCredits = useMemo(() => {
    return costData.some(data => data.credits > 0)
  }, [costData])

  // Filter cost data based on selected filters
  const filteredCostData = useMemo(() => {
    let filtered = [...costData]

    // Filter by credits
    if (showCreditsOnly) {
      filtered = filtered.filter(data => data.credits > 0)
    }

    // Filter services within each provider if a service is selected
    if (selectedService) {
      filtered = filtered.map(data => {
        const matchingServices = data.services.filter(s => s.name === selectedService)
        if (matchingServices.length > 0) {
          // Calculate cost from matching service only
          const serviceCost = matchingServices.reduce((sum, s) => sum + s.cost, 0)
          return {
            ...data,
            currentMonth: serviceCost,
            services: matchingServices,
          }
        }
        return null
      }).filter((data): data is CostData => data !== null && data.services.length > 0)
    }

    return filtered
  }, [costData, selectedService, showCreditsOnly])

  useEffect(() => {
    loadData()
  }, [isDemoMode])

  const handleRefresh = () => {
    setIsRefreshing(true)
    loadData()
  }

  const handleSync = async () => {
    if (isDemoMode) {
      alert('Sync is not available in demo mode. Please sign up to sync your cloud providers.')
      return
    }

    setIsSyncing(true)
    try {
      const result = await syncAPI.syncAll()
      if (result.errors && result.errors.length > 0) {
        alert(`Sync completed with some errors:\n${result.errors.map((e: any) => `${e.providerId}: ${e.error}`).join('\n')}`)
      } else {
        alert('Sync completed successfully!')
      }
      // Reload data after sync
      await loadData()
    } catch (error: any) {
      console.error('Sync error:', error)
      alert(`Sync failed: ${error.message || 'Unknown error'}`)
    } finally {
      setIsSyncing(false)
    }
  }

  // Calculate totals based on filtered data
  const totalCurrent = filteredCostData.reduce((sum, data) => sum + convertAmount(data.currentMonth), 0)
  const totalLastMonth = filteredCostData.reduce((sum, data) => sum + convertAmount(data.lastMonth), 0)
  const totalForecast = filteredCostData.reduce((sum, data) => sum + convertAmount(data.forecast), 0)
  const totalCredits = filteredCostData.reduce((sum, data) => sum + convertAmount(data.credits), 0)
  const totalSavings = filteredCostData.reduce((sum, data) => sum + convertAmount(data.savings), 0)

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Demo Mode Banner */}
        {isDemoMode && (
          <div className="mb-6 bg-primary-50 border border-primary-200 rounded-lg px-4 py-3 flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-primary-600" />
            <span className="text-primary-700 font-medium">Demo Mode</span>
            <span className="text-primary-600 text-sm">
              - You're viewing sample data. Sign up to connect your cloud accounts.
            </span>
          </div>
        )}

        {/* Header with Refresh and Sync */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Cost Dashboard</h1>
            <p className="text-gray-600">
              Multi-cloud cost overview across all your providers
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {!isDemoMode && (
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Sync cost data from cloud providers"
              >
                <Cloud className={`h-5 w-5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync'}</span>
              </button>
            )}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 text-primary-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Loading cost data...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Filter Bar */}
            <FilterBar services={allServices} hasCredits={hasAnyCredits} />

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
              // Merge configured providers with cost data
              // Show all configured providers, even if they don't have cost data yet
              const allProviders = new Map<string, CostData>()
              
              // Add providers with cost data (using filtered data)
              filteredCostData.forEach(data => {
                allProviders.set(data.provider.id, data)
              })
              
              // Add configured providers without cost data (show as empty/zero)
              // Only show when no filters are active
              if (!isDemoMode && !selectedService && !showCreditsOnly) {
                configuredProviders
                  .filter(p => p.isActive)
                  .forEach(provider => {
                    if (!allProviders.has(provider.providerId)) {
                      // Create empty cost data for configured providers without cost data
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
                        chartData30Days: [],
                        chartData60Days: [],
                        chartData120Days: [],
                        chartData180Days: [],
                        chartData4Months: [],
                        chartData6Months: [],
                        allHistoricalData: [],
                      })
                    }
                  })
              }
              
              const providersToShow = Array.from(allProviders.values())
              
              if (providersToShow.length > 0) {
                return (
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">By Provider</h2>
                    <div className="space-y-8">
                      {providersToShow.map((data) => {
                        const hasData = data.currentMonth > 0 || data.services.length > 0
                        return (
                          <div key={data.provider.id}>
                            {hasData ? (
                              <ProviderSection
                                providerId={data.provider.id}
                                providerName={data.provider.name}
                                currentMonth={data.currentMonth}
                                lastMonth={data.lastMonth}
                                forecast={data.forecast}
                                credits={data.credits}
                                savings={data.savings}
                                chartData30Days={data.chartData30Days}
                                chartData60Days={data.chartData60Days}
                                chartData120Days={data.chartData120Days}
                                chartData180Days={data.chartData180Days}
                                chartData4Months={data.chartData4Months}
                                chartData6Months={data.chartData6Months}
                              />
                            ) : (
                              <div className="card">
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center space-x-3">
                                    <div 
                                      className="w-12 h-12 flex items-center justify-center rounded-xl"
                                      style={{ backgroundColor: `${getProviderColor(data.provider.id)}15` }}
                                    >
                                      <ProviderIcon providerId={data.provider.id} size={32} />
                                    </div>
                                    <div>
                                      <h2 className="text-xl font-semibold text-gray-900">{data.provider.name}</h2>
                                      <p className="text-sm text-gray-600">No cost data available yet</p>
                                    </div>
                                  </div>
                                  <Link
                                    to={`/provider/${data.provider.id}`}
                                    className="flex items-center space-x-2 px-4 py-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                                  >
                                    <span>View Details</span>
                                  </Link>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-6 text-center">
                                  <p className="text-gray-600 mb-2">Cost data will appear here once your provider is synced.</p>
                                  <p className="text-sm text-gray-500">Cost data is typically synced every 24 hours.</p>
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
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">By Provider</h2>
                    <div className="card text-center py-12">
                      {(selectedService || showCreditsOnly) ? (
                        <>
                          <p className="text-gray-600 mb-4">No providers match the current filters.</p>
                          <button
                            onClick={() => {
                              // This will be handled by the FilterBar clearFilters
                              window.location.reload()
                            }}
                            className="text-primary-600 hover:text-primary-700 font-medium"
                          >
                            Clear filters to see all providers
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="text-gray-600 mb-4">No cloud providers configured yet.</p>
                          <Link
                            to="/settings"
                            className="text-primary-600 hover:text-primary-700 font-medium"
                          >
                            Add a cloud provider in Settings →
                          </Link>
                        </>
                      )}
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
