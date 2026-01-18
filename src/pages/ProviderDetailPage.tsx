import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCurrency } from '../contexts/CurrencyContext'
import { useNotification } from '../contexts/NotificationContext'
import { getProviderCostDetails, CostData, CostDataPoint, fetchDailyCostDataForRange, getDateRangeForPeriod, aggregateToMonthly, PeriodType, getPeriodLabel, ServiceCost } from '../services/costService'
import { cloudProvidersAPI, syncAPI, costDataAPI } from '../services/api'
import Layout from '../components/Layout'
import ProviderCostChart from '../components/ProviderCostChart'
import CostVsUsage from '../components/CostVsUsage'
import CostSummary from '../components/CostSummary'
import { ArrowLeft, TrendingUp, TrendingDown, Calendar, Filter, Gift, BarChart2, LineChart, Cloud, Layers, ChevronDown, X, SlidersHorizontal, Search, ArrowUpDown, DollarSign } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { ProviderIcon, getProviderColor } from '../components/CloudProviderIcons'

// Helper function to get colors for sub-service categories
const getCategoryColor = (category: string): string => {
  const categoryColors: Record<string, string> = {
    'Compute': '#3B82F6',      // Blue
    'Storage': '#10B981',      // Green
    'Data Transfer': '#8B5CF6', // Purple
    'Networking': '#F59E0B',   // Amber
    'Load Balancing': '#EF4444', // Red
    'Requests': '#EC4899',     // Pink
    'IP Addresses': '#6366F1', // Indigo
    'Other': '#6B7280',        // Gray
  }
  return categoryColors[category] || categoryColors['Other']
}

export default function ProviderDetailPage() {
  const { providerId } = useParams<{ providerId: string }>()
  const { isDemoMode } = useAuth()
  const { formatCurrency, convertAmount, getCurrencySymbol } = useCurrency()
  const { showSuccess, showError, showWarning } = useNotification()
  const [providerData, setProviderData] = useState<CostData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('1month')
  const [showCustomFilter, setShowCustomFilter] = useState(false)
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [filteredData, setFilteredData] = useState<CostDataPoint[]>([])
  const [isLoadingChartData, setIsLoadingChartData] = useState(false)
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily')
  const [isSyncing, setIsSyncing] = useState(false)
  
  // Service filter state
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false)
  
  // Advanced filter states
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [serviceSearch, setServiceSearch] = useState('')
  const [minCost, setMinCost] = useState<number | ''>('')
  const [maxCost, setMaxCost] = useState<number | ''>('')
  const [costChangeFilter, setCostChangeFilter] = useState<'all' | 'increase' | 'decrease'>('all')
  const [sortBy, setSortBy] = useState<'cost' | 'name' | 'change'>('cost')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showCredits, setShowCredits] = useState(true)
  
  // Period-based services state
  const [periodServices, setPeriodServices] = useState<ServiceCost[]>([])
  const [isLoadingServices, setIsLoadingServices] = useState(false)
  
  // Sub-service details state
  const [expandedService, setExpandedService] = useState<string | null>(null)
  const [subServices, setSubServices] = useState<any[]>([])
  const [isLoadingSubServices, setIsLoadingSubServices] = useState(false)

  // Define sub-service type
  interface SubService {
    name: string
    cost: number
    category: string
    usageType?: string
    percentage?: number
  }

  useEffect(() => {
    const loadData = async () => {
      if (!providerId) return
      
      try {
        setIsLoading(true)
        let data = await getProviderCostDetails(providerId, isDemoMode)
        
        // If no cost data found, check if provider is configured
        if (!data && !isDemoMode) {
          try {
            const providersResponse = await cloudProvidersAPI.getCloudProviders()
            const configuredProvider = providersResponse.providers?.find(
              (p: any) => p.providerId === providerId && p.isActive
            )
            
            if (configuredProvider) {
              // Create empty cost data structure for configured provider without cost data
              data = {
                provider: {
                  id: configuredProvider.providerId,
                  name: configuredProvider.providerName,
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
              }
            }
          } catch (error) {
            console.error('Failed to load configured providers:', error)
          }
        }
        
        setProviderData(data)
        
        // Set default dates for custom filter (last 30 days)
        if (data) {
          const endDate = new Date()
          const startDate = new Date()
          startDate.setDate(startDate.getDate() - 30)
          setCustomEndDate(endDate.toISOString().split('T')[0])
          setCustomStartDate(startDate.toISOString().split('T')[0])
        }
      } catch (error) {
        console.error('Failed to load provider data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [providerId, isDemoMode])

  // Fetch data when period changes (especially for custom, 4months, 6months, 12months)
  useEffect(() => {
    if (!providerData || !providerId) {
      setFilteredData([])
      setIsLoadingChartData(false)
      return
    }

    // In demo mode, use preloaded data for all periods
    if (isDemoMode) {
      setFilteredData([])
      setIsLoadingChartData(false)
      return
    }

    const fetchDataForPeriod = async () => {
      // For standard periods with preloaded data, use them directly
      if (['1month', '2months', '3months', '4months', '6months', '12months'].includes(selectedPeriod)) {
        setFilteredData([])
        setIsLoadingChartData(false)
        return
      }

      // For custom periods, fetch fresh data from API
      if (selectedPeriod !== 'custom' || !customStartDate || !customEndDate) {
        setIsLoadingChartData(false)
        return
      }

      setIsLoadingChartData(true)
      setFilteredData([]) // Clear previous data

      try {
        const range = getDateRangeForPeriod('custom', customStartDate, customEndDate)
        const startDate = range.startDate
        const endDate = range.endDate

        console.log(`Fetching data for ${selectedPeriod}:`, {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          providerId
        })

        const data = await fetchDailyCostDataForRange(providerId, startDate, endDate, isDemoMode)
        
        console.log(`Fetched ${data.length} data points for ${selectedPeriod}`)

        if (data.length > 0) {
          setFilteredData(data)
        } else {
          // If no data from API, try to filter from allHistoricalData as fallback
          console.warn(`No data returned from API for ${selectedPeriod}, using preloaded data`)
          const filtered = providerData.allHistoricalData.filter(point => {
            const pointDate = new Date(point.date)
            return pointDate >= startDate && pointDate <= endDate
          })
          
          if (filtered.length > 0) {
            setFilteredData(filtered)
          } else {
            // No data available for this custom range
            setFilteredData([])
          }
        }
      } catch (error) {
        console.error(`Failed to fetch ${selectedPeriod} data:`, error)
        // Fallback to filtering from allHistoricalData
        try {
          const range = selectedPeriod === 'custom' && customStartDate && customEndDate
            ? getDateRangeForPeriod('custom', customStartDate, customEndDate)
            : getDateRangeForPeriod(selectedPeriod)
          
          const filtered = providerData.allHistoricalData.filter(point => {
            const pointDate = new Date(point.date)
            return pointDate >= range.startDate && pointDate <= range.endDate
          })
          setFilteredData(filtered.length > 0 ? filtered : [])
        } catch (fallbackError) {
          console.error('Fallback filtering also failed:', fallbackError)
          setFilteredData([])
        }
      } finally {
        setIsLoadingChartData(false)
      }
    }

    fetchDataForPeriod()
  }, [selectedPeriod, customStartDate, customEndDate, providerData, providerId, isDemoMode])

  // Fetch services when period changes
  useEffect(() => {
    if (!providerData || !providerId) {
      setPeriodServices([])
      return
    }

    // In demo mode, use provider's services directly
    if (isDemoMode) {
      setPeriodServices(providerData.services)
      return
    }

    const fetchServicesForPeriod = async () => {
      setIsLoadingServices(true)
      setPeriodServices([]) // Clear previous data to show loading state
      
      try {
        // Get the date range for the selected period
        const range = selectedPeriod === 'custom' && customStartDate && customEndDate
          ? getDateRangeForPeriod('custom', customStartDate, customEndDate)
          : getDateRangeForPeriod(selectedPeriod)
        
        const startDateStr = range.startDate.toISOString().split('T')[0]
        const endDateStr = range.endDate.toISOString().split('T')[0]
        
        console.log(`[Services] Fetching services for ${selectedPeriod}: ${startDateStr} to ${endDateStr}`)
        
        const response = await costDataAPI.getServicesForDateRange(providerId, startDateStr, endDateStr)
        const services = response.services || []
        const totalCost = response.totalCost || 0
        
        console.log(`[Services] Fetched ${services.length} services for period, total: $${totalCost.toFixed(2)}`)
        
        // Always set the services - even if empty or zero cost
        // This ensures the UI updates to reflect the current period
        setPeriodServices(services.length > 0 ? services : [])
      } catch (error) {
        console.error('Failed to fetch services for period:', error)
        // On error, show empty services rather than stale data
        setPeriodServices([])
      } finally {
        setIsLoadingServices(false)
      }
    }

    fetchServicesForPeriod()
  }, [selectedPeriod, customStartDate, customEndDate, providerData, providerId, isDemoMode])

  // Handle service expansion to show sub-services
  const handleServiceExpand = async (serviceName: string, serviceCost: number) => {
    if (expandedService === serviceName) {
      // Collapse if already expanded
      setExpandedService(null)
      setSubServices([])
      return
    }

    setExpandedService(serviceName)
    setIsLoadingSubServices(true)
    setSubServices([])

    try {
      const range = selectedPeriod === 'custom' && customStartDate && customEndDate
        ? getDateRangeForPeriod('custom', customStartDate, customEndDate)
        : getDateRangeForPeriod(selectedPeriod)
      
      const startDateStr = range.startDate.toISOString().split('T')[0]
      const endDateStr = range.endDate.toISOString().split('T')[0]

      console.log(`[SubServices] Fetching details for ${serviceName}`)
      
      const response = await costDataAPI.getServiceDetails(providerId!, serviceName, startDateStr, endDateStr)
      let fetchedSubServices = response.subServices || []
      
      // If sub-services have percentages but no costs, calculate costs from parent
      fetchedSubServices = fetchedSubServices.map((sub: SubService) => ({
        ...sub,
        cost: sub.cost > 0 ? sub.cost : (serviceCost * (sub.percentage || 0) / 100),
      }))

      console.log(`[SubServices] Fetched ${fetchedSubServices.length} sub-services`)
      setSubServices(fetchedSubServices)
    } catch (error) {
      console.error('Failed to fetch sub-service details:', error)
      setSubServices([])
    } finally {
      setIsLoadingSubServices(false)
    }
  }

  // Get unique services from period services
  const allServices = useMemo(() => {
    const services = periodServices.length > 0 ? periodServices : (providerData?.services || [])
    return [...new Set(services.map(s => s.name))].sort()
  }, [periodServices, providerData])

  // Filter and sort services based on all filter criteria
  const filteredServices = useMemo(() => {
    // Use period services if available, otherwise fall back to provider data
    const sourceServices = periodServices.length > 0 ? periodServices : (providerData?.services || [])
    if (sourceServices.length === 0) return []
    
    let services = [...sourceServices]
    
    // Filter by selected service
    if (selectedService) {
      services = services.filter(s => s.name === selectedService)
    }
    
    // Filter by search term
    if (serviceSearch) {
      const searchLower = serviceSearch.toLowerCase()
      services = services.filter(s => s.name.toLowerCase().includes(searchLower))
    }
    
    // Filter by cost range
    if (minCost !== '' && minCost > 0) {
      services = services.filter(s => s.cost >= minCost)
    }
    if (maxCost !== '' && maxCost > 0) {
      services = services.filter(s => s.cost <= maxCost)
    }
    
    // Filter by cost change
    if (costChangeFilter === 'increase') {
      services = services.filter(s => s.change > 0)
    } else if (costChangeFilter === 'decrease') {
      services = services.filter(s => s.change < 0)
    }
    
    // Sort services
    services.sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'cost':
          comparison = a.cost - b.cost
          break
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'change':
          comparison = a.change - b.change
          break
      }
      return sortOrder === 'desc' ? -comparison : comparison
    })
    
    return services
  }, [periodServices, providerData, selectedService, serviceSearch, minCost, maxCost, costChangeFilter, sortBy, sortOrder])

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
      const result = await syncAPI.syncAll()
      if (result.errors && result.errors.length > 0) {
        showWarning(
          'Sync Completed with Errors',
          result.errors.map((e: any) => `${e.providerId || e.accountAlias}: ${e.error}`).join('\n')
        )
      } else {
        showSuccess(
          'Sync Completed Successfully',
          'Refreshing data...'
        )
      }
      // Reload data after sync
      const data = await getProviderCostDetails(providerId!, isDemoMode)
      setProviderData(data)
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

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading provider data...</p>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  if (!providerData) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            to="/dashboard"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Link>
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">Provider not found</p>
            <Link to="/dashboard" className="text-primary-600 hover:text-primary-700">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </Layout>
    )
  }

  // Use period services for determining if we have data to show
  const currentServices = periodServices.length > 0 ? periodServices : providerData.services
  const hasNoData = providerData.currentMonth === 0 && currentServices.length === 0

  const changePercent = providerData.lastMonth > 0
    ? ((providerData.currentMonth - providerData.lastMonth) / providerData.lastMonth) * 100
    : 0

  const getDailyChartData = (): CostDataPoint[] => {
    // For custom periods, prioritize filteredData (freshly fetched)
    if (selectedPeriod === 'custom') {
      if (filteredData.length > 0) {
        return filteredData
      }
      
      // If filteredData is empty but we're loading, return empty array
      if (isLoadingChartData) {
        return []
      }
      
      // Fallback: try to filter from allHistoricalData
      if (customStartDate && customEndDate) {
        const { startDate, endDate } = getDateRangeForPeriod('custom', customStartDate, customEndDate)
        const filtered = providerData.allHistoricalData.filter(point => {
          const pointDate = new Date(point.date)
          return pointDate >= startDate && pointDate <= endDate
        })
        return filtered.length > 0 ? filtered : []
      }
      
      return []
    }

    // For standard periods, use preloaded data
    switch (selectedPeriod) {
      case '1month':
        return providerData.chartData1Month
      case '2months':
        return providerData.chartData2Months
      case '3months':
        return providerData.chartData3Months
      case '4months':
        return providerData.chartData4Months
      case '6months':
        return providerData.chartData6Months
      case '12months':
        return providerData.chartData12Months
      default:
        return providerData.chartData1Month
    }
  }

  // Get chart data - daily or aggregated to monthly
  const getChartData = (): CostDataPoint[] => {
    const dailyData = getDailyChartData()
    
    if (viewMode === 'monthly') {
      return aggregateToMonthly(dailyData)
    }
    
    return dailyData
  }

  const handleCustomFilter = async () => {
    if (customStartDate && customEndDate) {
      const start = new Date(customStartDate)
      const end = new Date(customEndDate)
      
      if (start > end) {
        alert('Start date must be before end date')
        return
      }
      
      setSelectedPeriod('custom')
      setShowCustomFilter(false)
      // The useEffect will handle fetching the data
    }
  }

  // Calculate total from services (in case currentMonth is 0)
  const serviceTotalCost = filteredServices.reduce((sum, s) => sum + (s.cost || 0), 0)
  const effectiveTotal = providerData.currentMonth > 0 ? providerData.currentMonth : serviceTotalCost

  // Prepare service cost data for pie chart (already converted to selected currency)
  const serviceCostData = filteredServices.map(service => ({
    name: service.name,
    value: convertAmount(service.cost),
    originalCost: service.cost, // Keep original for percentage calculation
    change: service.change,
  }))

  const COLORS = ['#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e']

  const chartData = getChartData()

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with Back and Sync */}
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            title="Return to dashboard"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Link>
          
          {!isDemoMode && (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="btn-primary flex items-center space-x-2"
              title="Sync fresh data from cloud provider (clears cache)"
            >
              <Cloud className={`h-5 w-5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Data'}</span>
            </button>
          )}
        </div>

        {/* Provider Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <div 
              className="w-16 h-16 flex items-center justify-center rounded-2xl shadow-sm"
              style={{ backgroundColor: `${getProviderColor(providerId || '')}15` }}
              title={`${providerData.provider.name} cloud provider`}
            >
              <ProviderIcon providerId={providerId || ''} size={40} />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <h1 className="text-3xl font-bold text-gray-900">{providerData.provider.name}</h1>
                {showCredits && providerData.credits > 0 && (
                  <span 
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-200"
                    title="This account has credits applied"
                  >
                    <Gift className="h-4 w-4 mr-1.5" />
                    Credits Applied
                  </span>
                )}
              </div>
              <p className="text-gray-500 mt-1">Detailed cost breakdown and analytics</p>
              {showCredits && providerData.credits > 0 && (
                <p className="text-sm text-green-700 mt-2 flex items-center">
                  <Gift className="h-4 w-4 mr-1.5" />
                  <span className="font-medium">-{formatCurrency(convertAmount(providerData.credits))} in credits applied to this account</span>
                </p>
              )}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid md:grid-cols-4 gap-4 mt-6">
            <div className="card" title="Total cost for the current billing month">
              <div className="text-sm text-gray-500 mb-1">Current Month</div>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(convertAmount(providerData.currentMonth))}
              </div>
              {changePercent !== 0 && (
                <div className={`text-sm mt-1 flex items-center ${
                  changePercent >= 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {changePercent >= 0 ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  {Math.abs(changePercent).toFixed(1)}% vs last month
                </div>
              )}
            </div>

            <div className="card" title="Projected cost for the month based on current usage">
              <div className="text-sm text-gray-500 mb-1">Forecast</div>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(convertAmount(providerData.forecast))}
              </div>
            </div>

            {showCredits && (
              <div className="card bg-green-50 border-green-200" title="Credits applied to this account">
                <div className="text-sm text-gray-600 mb-1">Credits</div>
                <div className="text-2xl font-bold text-green-700">
                  {formatCurrency(convertAmount(providerData.credits))}
                </div>
              </div>
            )}

            <div className="card bg-blue-50 border-blue-200" title="Savings from reserved instances and commitment plans">
              <div className="text-sm text-gray-600 mb-1">Savings</div>
              <div className="text-2xl font-bold text-blue-700">
                {formatCurrency(convertAmount(providerData.savings))}
              </div>
            </div>
          </div>
        </div>

        {/* Cost Summary - Plain-English Explanation */}
        {!hasNoData && providerId && (() => {
          // Calculate the most recent month in the selected period
          const range = selectedPeriod === 'custom' && customStartDate && customEndDate
            ? getDateRangeForPeriod('custom', customStartDate, customEndDate)
            : getDateRangeForPeriod(selectedPeriod)
          
          // Get the most recent month in the range
          const endDate = range.endDate
          const summaryMonth = endDate.getMonth() + 1
          const summaryYear = endDate.getFullYear()
          
          return (
            <div className="mb-8" key={`cost-summary-${selectedPeriod}-${summaryMonth}-${summaryYear}`}>
              <CostSummary
                providerId={providerId}
                month={summaryMonth}
                year={summaryYear}
              />
            </div>
          )
        })()}

        {/* No Data Message */}
        {hasNoData && (
          <div className="mb-8 card bg-blue-50 border-blue-200">
            <div className="p-6 text-center">
              <p className="text-blue-900 font-medium mb-2">No cost data available yet</p>
              <p className="text-blue-700 text-sm">
                Cost data will appear here once your provider is synced. Click "Sync Data" to fetch the latest costs.
              </p>
            </div>
          </div>
        )}

        {/* Service Filter Section */}
        {!hasNoData && allServices.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 mb-6 animate-fade-in">
            <div className="flex items-center space-x-2 text-gray-500">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-medium">Filter by Service</span>
            </div>

            {/* Service Filter Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsServiceDropdownOpen(!isServiceDropdownOpen)}
                className={`
                  flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200
                  ${selectedService 
                    ? 'bg-primary-50 border-2 border-primary-200 text-primary-700' 
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                  }
                `}
                title="Filter charts and data by service"
              >
                <Layers className="h-4 w-4" />
                <span>{selectedService || 'All Services'}</span>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isServiceDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isServiceDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setIsServiceDropdownOpen(false)}
                  />
                  <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-gray-200 rounded-2xl shadow-xl z-20 max-h-80 overflow-hidden animate-fade-in">
                    <div className="p-2 max-h-72 overflow-y-auto">
                      <button
                        onClick={() => {
                          setSelectedService(null)
                          setIsServiceDropdownOpen(false)
                        }}
                        className={`
                          w-full px-4 py-2.5 text-left text-sm rounded-xl transition-colors
                          ${selectedService === null 
                            ? 'bg-primary-50 text-primary-700 font-medium' 
                            : 'text-gray-700 hover:bg-gray-50'
                          }
                        `}
                      >
                        All Services
                      </button>
                      {allServices.map((service) => (
                        <button
                          key={service}
                          onClick={() => {
                            setSelectedService(service)
                            setIsServiceDropdownOpen(false)
                          }}
                          className={`
                            w-full px-4 py-2.5 text-left text-sm rounded-xl truncate transition-colors
                            ${selectedService === service 
                              ? 'bg-primary-50 text-primary-700 font-medium' 
                              : 'text-gray-700 hover:bg-gray-50'
                            }
                          `}
                        >
                          {service}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Clear Filter Button */}
            {selectedService && (
              <button
                onClick={() => setSelectedService(null)}
                className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                title="Clear service filter"
              >
                <X className="h-4 w-4" />
                <span>Clear filter</span>
              </button>
            )}

            {/* Active Filter Tag */}
            {selectedService && (
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                {selectedService}
                <button 
                  onClick={() => setSelectedService(null)}
                  className="ml-2 hover:text-primary-900"
                  title="Remove this filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {/* Advanced Filters Toggle */}
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`
                flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200
                ${showAdvancedFilters 
                  ? 'bg-primary-50 border-2 border-primary-200 text-primary-700' 
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                }
              `}
              title="Show advanced filtering options"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Advanced Filters</span>
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showAdvancedFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>
        )}

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && !hasNoData && (
          <div className="mb-6 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl border border-gray-200 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {/* Service Search */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Search Services
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    placeholder="Search by name..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    title="Filter services by name"
                  />
                </div>
              </div>

              {/* Cost Range */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Cost Range (USD)
                </label>
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="number"
                      value={minCost}
                      onChange={(e) => setMinCost(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      placeholder="Min"
                      min="0"
                      className="w-full pl-7 pr-2 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      title="Minimum cost filter"
                    />
                  </div>
                  <span className="text-gray-400">–</span>
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="number"
                      value={maxCost}
                      onChange={(e) => setMaxCost(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      placeholder="Max"
                      min="0"
                      className="w-full pl-7 pr-2 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      title="Maximum cost filter"
                    />
                  </div>
                </div>
              </div>

              {/* Cost Change Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Cost Trend
                </label>
                <select
                  value={costChangeFilter}
                  onChange={(e) => setCostChangeFilter(e.target.value as 'all' | 'increase' | 'decrease')}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                  title="Filter by cost trend"
                >
                  <option value="all">All Services</option>
                  <option value="increase">↑ Cost Increased</option>
                  <option value="decrease">↓ Cost Decreased</option>
                </select>
              </div>

              {/* Show Credits Toggle */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Display
                </label>
                <label className="flex items-center space-x-3 px-4 py-2.5 rounded-xl border border-gray-200 bg-white cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={showCredits}
                    onChange={(e) => setShowCredits(e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <Gift className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-gray-700">Show Credits</span>
                </label>
              </div>

              {/* Sort Options */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Sort By
                </label>
                <div className="flex items-center space-x-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'cost' | 'name' | 'change')}
                    className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                    title="Sort services by"
                  >
                    <option value="cost">Cost</option>
                    <option value="name">Name</option>
                    <option value="change">Change %</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                    title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                  >
                    <ArrowUpDown className={`h-4 w-4 transition-transform ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Filter Summary & Reset */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <span>Showing <strong className="text-gray-700">{filteredServices.length}</strong> of <strong className="text-gray-700">{providerData?.services.length || 0}</strong> services</span>
              </div>
              <button
                onClick={() => {
                  setServiceSearch('')
                  setMinCost('')
                  setMaxCost('')
                  setCostChangeFilter('all')
                  setSortBy('cost')
                  setSortOrder('desc')
                  setSelectedService(null)
                  setShowCredits(true)
                }}
                className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Reset all filters to default"
              >
                <X className="h-4 w-4" />
                <span>Reset Filters</span>
              </button>
            </div>
          </div>
        )}

        {/* Cost Trend Chart */}
        {!hasNoData && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Cost Trends</h2>
              
              {/* View Mode Toggle */}
              <div 
                className="flex items-center space-x-2 bg-gray-100 rounded-xl p-1"
                title="Toggle between daily and monthly view"
              >
                <button
                  onClick={() => setViewMode('daily')}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    viewMode === 'daily'
                      ? 'bg-white text-primary-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="View daily cost breakdown"
                >
                  <LineChart className="h-4 w-4" />
                  <span>Daily</span>
                </button>
                <button
                  onClick={() => setViewMode('monthly')}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    viewMode === 'monthly'
                      ? 'bg-white text-primary-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="View monthly aggregated costs"
                >
                  <BarChart2 className="h-4 w-4" />
                  <span>Monthly</span>
                </button>
              </div>
            </div>

            {/* Period Selector */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                {/* Period Buttons */}
                <div className="flex flex-wrap gap-2">
                  {(['1month', '2months', '3months', '4months', '6months', '12months'] as PeriodType[]).map((period) => (
                    <button
                      key={period}
                      onClick={() => {
                        console.log(`Period button clicked: ${period}`)
                        setSelectedPeriod(period)
                        setShowCustomFilter(false)
                      }}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                        selectedPeriod === period
                          ? 'bg-primary-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      title={`View costs for ${getPeriodLabel(period).toLowerCase()}`}
                    >
                      {getPeriodLabel(period)}
                    </button>
                  ))}
                  
                  {/* Custom Filter Button */}
                  <button
                    onClick={() => {
                      setShowCustomFilter(!showCustomFilter)
                      if (!showCustomFilter) {
                        setSelectedPeriod('custom')
                      }
                    }}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center space-x-2 ${
                      selectedPeriod === 'custom'
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    title="Select a custom date range"
                  >
                    <Calendar className="h-4 w-4" />
                    <span>Custom</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Custom Date Range Filter */}
            {showCustomFilter && (
              <div className="mb-4 p-4 bg-gray-50 rounded-2xl border border-gray-200">
                <div className="flex items-center space-x-4">
                  <Filter className="h-5 w-5 text-gray-600" />
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="input-field"
                        max={customEndDate || new Date().toISOString().split('T')[0]}
                        title="Select the start date for your custom range"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="input-field"
                        min={customStartDate}
                        max={new Date().toISOString().split('T')[0]}
                        title="Select the end date for your custom range"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={handleCustomFilter}
                        className="btn-primary w-full"
                        title="Apply the selected date range"
                      >
                        Apply Filter
                      </button>
                    </div>
                  </div>
                  {selectedPeriod === 'custom' && (
                    <div className="mt-3 text-sm text-gray-600">
                      {isLoadingChartData ? (
                        <span>Loading data...</span>
                      ) : filteredData.length > 0 ? (
                        <span>Showing {filteredData.length} data points from {new Date(customStartDate).toLocaleDateString()} to {new Date(customEndDate).toLocaleDateString()}</span>
                      ) : (
                        <span className="text-yellow-600">No data available for the selected date range</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {isLoadingChartData ? (
              <div className="card flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
                  <p className="text-gray-500">Loading chart data...</p>
                </div>
              </div>
            ) : (
              <ProviderCostChart
                providerId={providerData.provider.id}
                providerName={providerData.provider.name}
                data={chartData}
                currentMonth={providerData.currentMonth}
                lastMonth={providerData.lastMonth}
                period={viewMode === 'monthly' ? 'monthly' : selectedPeriod}
                isMonthlyView={viewMode === 'monthly'}
              />
            )}
          </div>
        )}

        {/* Service Breakdown */}
        {!hasNoData && (
          <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Pie Chart - Service Distribution */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Cost by Service</h3>
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {getPeriodLabel(selectedPeriod)}
              </span>
            </div>
            {isLoadingServices ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : serviceCostData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={serviceCostData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {serviceCostData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                No services found
              </div>
            )}
          </div>

          {/* Bar Chart - Service Costs */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Service Costs</h3>
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {getPeriodLabel(selectedPeriod)}
              </span>
            </div>
            {isLoadingServices ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : serviceCostData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={serviceCostData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="name"
                    stroke="#6b7280"
                    fontSize={12}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis
                    stroke="#6b7280"
                    fontSize={12}
                    tickFormatter={(value) => {
                      const symbol = getCurrencySymbol()
                      if (value >= 1000000) {
                        return `${symbol}${(value / 1000000).toFixed(1)}M`
                      }
                      if (value >= 1000) {
                        return `${symbol}${(value / 1000).toFixed(1)}k`
                      }
                      return `${symbol}${value.toFixed(0)}`
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Bar dataKey="value" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                No services found
              </div>
            )}
          </div>
        </div>
        )}

        {/* Cost vs Usage Section */}
        {!hasNoData && (() => {
          const range = selectedPeriod === 'custom' && customStartDate && customEndDate
            ? getDateRangeForPeriod('custom', customStartDate, customEndDate)
            : getDateRangeForPeriod(selectedPeriod)
          
          const startDateStr = range.startDate.toISOString().split('T')[0]
          const endDateStr = range.endDate.toISOString().split('T')[0]
          
          // Use key to force re-render when period changes
          return (
            <div className="mb-8" key={`cost-vs-usage-${selectedPeriod}-${startDateStr}-${endDateStr}`}>
              <CostVsUsage
                providerId={providerId || undefined}
                startDate={startDateStr}
                endDate={endDateStr}
              />
            </div>
          )
        })()}

        {/* Service Details Table */}
        {!hasNoData && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                Service Breakdown
                {selectedService && (
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    (filtered by {selectedService})
                  </span>
                )}
              </h3>
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {getPeriodLabel(selectedPeriod)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 w-8"></th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Service</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">Cost</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">Change</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredServices.length > 0 ? (
                    filteredServices.map((service, index) => {
                      const percentage = effectiveTotal > 0 
                        ? (service.cost / effectiveTotal) * 100 
                        : 0
                      const isExpanded = expandedService === service.name
                      return (
                        <>
                          <tr 
                            key={`service-${index}-${service.name}`} 
                            className={`border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${isExpanded ? 'bg-blue-50' : ''}`}
                            onClick={() => handleServiceExpand(service.name, service.cost)}
                            title="Click to see sub-service breakdown"
                          >
                            <td className="py-3 px-2 text-center">
                              <ChevronDown 
                                className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                              />
                            </td>
                            <td className="py-3 px-4 text-gray-900 font-medium">
                              <div className="flex items-center gap-2">
                                <Layers className="h-4 w-4 text-gray-400" />
                                {service.name}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-medium text-gray-900">
                              {formatCurrency(service.cost)}
                            </td>
                            <td className={`py-3 px-4 text-right ${
                              (service.change || 0) >= 0 ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {(service.change || 0) >= 0 ? '+' : ''}{(service.change || 0).toFixed(1)}%
                            </td>
                            <td className="py-3 px-4 text-right text-gray-500">
                              {percentage.toFixed(1)}%
                            </td>
                          </tr>
                          
                          {/* Sub-services expandable row */}
                          {isExpanded && (
                            <tr key={`sub-${index}-${service.name}`}>
                              <td colSpan={5} className="bg-gradient-to-b from-blue-50 to-gray-50 p-0">
                                <div className="px-8 py-4">
                                  {isLoadingSubServices ? (
                                    <div className="flex items-center justify-center py-6">
                                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                      <span className="ml-3 text-gray-500">Loading sub-service details...</span>
                                    </div>
                                  ) : subServices.length > 0 ? (
                                    <div className="space-y-3">
                                      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
                                        <BarChart2 className="h-4 w-4" />
                                        Sub-service Breakdown
                                      </h4>
                                      
                                      {/* Group by category */}
                                      {(() => {
                                        const categories = new Map<string, typeof subServices>()
                                        subServices.forEach(sub => {
                                          const cat = sub.category || 'Other'
                                          if (!categories.has(cat)) categories.set(cat, [])
                                          categories.get(cat)!.push(sub)
                                        })
                                        
                                        return Array.from(categories.entries()).map(([category, subs]) => (
                                          <div key={category} className="mb-4">
                                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                              {category}
                                            </div>
                                            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                              {subs.map((sub: SubService, subIndex: number) => {
                                                const subPercentage = service.cost > 0 ? (sub.cost / service.cost) * 100 : 0
                                                return (
                                                  <div 
                                                    key={`${sub.name}-${subIndex}`}
                                                    className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                                                  >
                                                    <div className="flex items-center gap-3">
                                                      <div className="w-2 h-2 rounded-full" style={{ 
                                                        backgroundColor: getCategoryColor(category) 
                                                      }}></div>
                                                      <span className="text-sm text-gray-700">{sub.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-6">
                                                      <div className="w-24">
                                                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                          <div 
                                                            className="h-full rounded-full transition-all duration-500"
                                                            style={{ 
                                                              width: `${subPercentage}%`,
                                                              backgroundColor: getCategoryColor(category)
                                                            }}
                                                          ></div>
                                                        </div>
                                                      </div>
                                                      <span className="text-xs text-gray-500 w-12 text-right">
                                                        {subPercentage.toFixed(1)}%
                                                      </span>
                                                      <span className="text-sm font-medium text-gray-900 w-24 text-right">
                                                        {formatCurrency(sub.cost)}
                                                      </span>
                                                    </div>
                                                  </div>
                                                )
                                              })}
                                            </div>
                                          </div>
                                        ))
                                      })()}
                                    </div>
                                  ) : (
                                    <div className="text-center py-6 text-gray-500">
                                      <Layers className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                                      <p className="text-sm">No detailed sub-service data available</p>
                                      <p className="text-xs text-gray-400 mt-1">Sub-service breakdown may not be available for all services</p>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">
                        No services found {selectedService ? `matching "${selectedService}"` : ''}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
