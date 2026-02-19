import React, { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCurrency } from '../contexts/CurrencyContext'
import { useNotification } from '../contexts/NotificationContext'
import { getProviderCostDetails, CostData, CostDataPoint, fetchDailyCostDataForRange, getDateRangeForPeriod, aggregateToMonthly, PeriodType, getPeriodLabel, ServiceCost } from '../services/costService'
import { cloudProvidersAPI, syncAPI, costDataAPI, productTeamAPI, budgetsAPI, billingAPI } from '../services/api'
import Layout from '../components/Layout'
import Breadcrumbs from '../components/Breadcrumbs'
import ProviderCostChart from '../components/ProviderCostChart'
import CostVsUsage from '../components/CostVsUsage'
import CostSummary from '../components/CostSummary'
import UntaggedResources from '../components/UntaggedResources'
import CostByDimension from '../components/CostByDimension'
import AnomalyDetection from '../components/AnomalyDetection'
import UnitEconomics from '../components/UnitEconomics'
import CostEfficiencyMetrics from '../components/CostEfficiencyMetrics'
import RightsizingRecommendations from '../components/RightsizingRecommendations'
import ProductCostCard from '../components/ProductCostCard'
import TeamCostCard from '../components/TeamCostCard'
import { ArrowLeft, TrendingUp, TrendingDown, Calendar, Filter, BarChart2, LineChart, Layers, ChevronDown, X, SlidersHorizontal, Search, ArrowUpDown, DollarSign, LayoutDashboard, Package, TrendingUp as TrendingUpIcon, Users, Download, FileText } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { ProviderIcon } from '../components/CloudProviderIcons'

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
  const location = useLocation()
  const { isDemoMode } = useAuth()
  const { formatCurrency, convertAmount, getCurrencySymbol } = useCurrency()
  const { showSuccess, showError, showWarning } = useNotification()
  const [providerData, setProviderData] = useState<CostData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [providerAccounts, setProviderAccounts] = useState<any[]>([])
  const [providerBudgetCount, setProviderBudgetCount] = useState<number>(0)
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('1month')
  const [showCustomFilter, setShowCustomFilter] = useState(false)
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [filteredData, setFilteredData] = useState<CostDataPoint[]>([])
  const [isLoadingChartData, setIsLoadingChartData] = useState(false)
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily')
  const [isSyncing, setIsSyncing] = useState(false)
  
  // Service filter state - check URL params for service filter
  const searchParams = new URLSearchParams(location.search)
  const serviceFromUrl = searchParams.get('service')
  const [selectedService, setSelectedService] = useState<string | null>(serviceFromUrl || null)
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false)
  
  // Advanced filter states
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [serviceSearch, setServiceSearch] = useState('')
  const [minCost, setMinCost] = useState<number | ''>('')
  const [maxCost, setMaxCost] = useState<number | ''>('')
  const [costChangeFilter, setCostChangeFilter] = useState<'all' | 'increase' | 'decrease'>('all')
  const [sortBy, setSortBy] = useState<'cost' | 'name' | 'change'>('cost')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  
  // Period-based services state
  const [periodServices, setPeriodServices] = useState<ServiceCost[]>([])
  const [isLoadingServices, setIsLoadingServices] = useState(false)
  
  // Sub-service details state
  const [expandedService, setExpandedService] = useState<string | null>(null)
  const [subServices, setSubServices] = useState<any[]>([])
  const [isLoadingSubServices, setIsLoadingSubServices] = useState(false)
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'analytics' | 'products' | 'teams'>('overview')
  
  // Products and Teams state
  const [products, setProducts] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [isLoadingTeams, setIsLoadingTeams] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)
  const [maxHistoricalMonths, setMaxHistoricalMonths] = useState(12)

  // Filter available periods based on subscription plan
  const periodMonthsMap: Record<string, number> = { '1month': 1, '2months': 2, '3months': 3, '4months': 4, '6months': 6, '12months': 12 }
  const availablePeriods = useMemo(() => {
    return (['1month', '2months', '3months', '4months', '6months', '12months'] as PeriodType[]).filter(
      p => periodMonthsMap[p] <= maxHistoricalMonths
    )
  }, [maxHistoricalMonths])

  // Minimum allowed start date for custom range based on plan
  const minAllowedDate = useMemo(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - maxHistoricalMonths)
    d.setDate(1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }, [maxHistoricalMonths])

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
        
        // Load provider accounts for analytics components
        if (!isDemoMode) {
          try {
            const providersResponse = await cloudProvidersAPI.getCloudProviders()
            const accounts = providersResponse.providers?.filter(
              (p: any) => p.providerId === providerId && p.isActive
            ) || []
            setProviderAccounts(accounts)
            
            // If no cost data found, check if provider is configured
            if (!data && accounts.length > 0) {
              const configuredProvider = accounts[0]
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
              }
            }
          } catch (error) {
            console.error('Failed to load configured providers:', error)
          }
        }

        // Load budgets and subscription info
        if (!isDemoMode) {
          try {
            const budgetsResponse = await budgetsAPI.getBudgets(providerId)
            const budgets = budgetsResponse.budgets || []
            setProviderBudgetCount(budgets.length)
          } catch (error) {
            console.error('Failed to load provider budgets:', error)
            setProviderBudgetCount(0)
          }
          try {
            const subResponse = await billingAPI.getSubscription()
            if (subResponse?.limits?.historicalDataMonths) {
              setMaxHistoricalMonths(subResponse.limits.historicalDataMonths)
            }
          } catch (error) {
            console.error('Failed to load subscription info:', error)
          }
        } else {
          setProviderBudgetCount(0)
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

  // Handle service filter from URL parameter
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const serviceFromUrl = searchParams.get('service')
    if (serviceFromUrl) {
      setSelectedService(decodeURIComponent(serviceFromUrl))
      // Switch to services tab if not already there
      if (activeTab !== 'services') {
        setActiveTab('services')
      }
    }
  }, [location.search, activeTab])

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
            const pointDate = new Date(point.date + 'T12:00:00')
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
            const pointDate = new Date(point.date + 'T12:00:00')
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

  // Load products and teams when tab is active
  useEffect(() => {
    if ((activeTab === 'products' || activeTab === 'teams') && !isDemoMode && providerId) {
      const loadData = async () => {
        const range = selectedPeriod === 'custom' && customStartDate && customEndDate
          ? getDateRangeForPeriod('custom', customStartDate, customEndDate)
          : getDateRangeForPeriod(selectedPeriod)
        
        const startDateStr = range.startDate.toISOString().split('T')[0]
        const endDateStr = range.endDate.toISOString().split('T')[0]
        const accountId = providerAccounts.length === 1 ? providerAccounts[0].accountId : undefined

        if (activeTab === 'products') {
          setIsLoadingProducts(true)
          try {
            const response = await productTeamAPI.getCostByProduct(startDateStr, endDateStr, providerId, accountId)
            setProducts(response.products || [])
          } catch (error) {
            console.error('Failed to load products:', error)
            setProducts([])
          } finally {
            setIsLoadingProducts(false)
          }
        } else if (activeTab === 'teams') {
          setIsLoadingTeams(true)
          try {
            const response = await productTeamAPI.getCostByTeam(startDateStr, endDateStr, providerId, accountId)
            setTeams(response.teams || [])
          } catch (error) {
            console.error('Failed to load teams:', error)
            setTeams([])
          } finally {
            setIsLoadingTeams(false)
          }
        }
      }
      loadData()
    }
  }, [activeTab, selectedPeriod, customStartDate, customEndDate, providerId, providerAccounts, isDemoMode])

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
        <div className="w-full max-w-[1920px] mx-auto px-6 lg:px-12 xl:px-16 py-10">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Spinner size={32} className="mx-auto mb-4" />
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
        <div className="w-full max-w-[1920px] mx-auto px-6 lg:px-12 xl:px-16 py-10">
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

  const hasTax = (providerData.taxCurrentMonth ?? 0) > 0 || (providerData.taxLastMonth ?? 0) > 0
  const displayCurrent = hasTax ? providerData.currentMonth + (providerData.taxCurrentMonth ?? 0) : providerData.currentMonth
  const displayLast = hasTax ? providerData.lastMonth + (providerData.taxLastMonth ?? 0) : providerData.lastMonth
  const lastMonthSamePeriod = providerData.lastMonthSamePeriod

  const changePercent = (() => {
    if (lastMonthSamePeriod != null && lastMonthSamePeriod > 0) {
      return ((providerData.currentMonth - lastMonthSamePeriod) / lastMonthSamePeriod) * 100
    }
    if (displayLast > 0) {
      return ((displayCurrent - displayLast) / displayLast) * 100
    }
    return 0
  })()

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
          const pointDate = new Date(point.date + 'T12:00:00')
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

  const chartData = getChartData()

  // Handle download report
  const handleDownloadReport = async (format: 'pdf' | 'json') => {
    if (!providerId || !providerData || isDemoMode) {
      showWarning('Download not available', 'Please sign in to download reports.')
      return
    }

    setIsDownloading(true)
    setShowDownloadMenu(false)

    try {
      // Get date range for selected period
      const range = selectedPeriod === 'custom' && customStartDate && customEndDate
        ? getDateRangeForPeriod('custom', customStartDate, customEndDate)
        : getDateRangeForPeriod(selectedPeriod)
      
      const startDate = range.startDate.toISOString().split('T')[0]
      const endDate = range.endDate.toISOString().split('T')[0]
      const accountId = providerAccounts.length === 1 ? providerAccounts[0].accountId : undefined

      // Call API to generate report
      const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/cost-data/${providerId}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          startDate,
          endDate,
          format,
          accountId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate report')
      }

      // Download the file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const periodLabel = selectedPeriod === 'custom' 
        ? `${customStartDate}_to_${customEndDate}`
        : getPeriodLabel(selectedPeriod).toLowerCase().replace(/\s+/g, '_')
      a.download = `${providerData.provider.name}_${periodLabel}_report.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      showSuccess('Report downloaded', `Your ${format.toUpperCase()} report has been downloaded.`)
    } catch (error: any) {
      console.error('Download error:', error)
      showError('Download failed', error.message || 'Failed to download report. Please try again.')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <Layout>
      <div className="w-full px-6 lg:px-8 py-6">
        {/* Breadcrumbs */}
        <Breadcrumbs />

        {/* Provider Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div
                className="w-14 h-14 flex items-center justify-center rounded-2xl shrink-0"
                title={`${providerData.provider.name} cloud provider`}
              >
                <ProviderIcon providerId={providerId || ''} size={32} />
              </div>
              <div>
                <div className="flex items-center space-x-2.5 mb-0.5">
                  <h1 className="text-2xl font-bold text-gray-900">{providerData.provider.name}</h1>
                  {providerBudgetCount > 0 && (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-medium bg-[#EFF6FF] text-accent-700 border border-[#DBEAFE]"
                      title={`You have ${providerBudgetCount} budget${providerBudgetCount === 1 ? '' : 's'} configured for this provider`}
                    >
                      <BarChart2 className="h-2.5 w-2.5 mr-1" />
                      {providerBudgetCount} budget{providerBudgetCount === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">Detailed cost breakdown and analytics</p>
              </div>
            </div>
            
            {/* Sync Button */}
            {!isDemoMode && (
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="btn-primary flex items-center space-x-2"
                title="Sync fresh data from cloud provider (clears cache)"
              >
                {isSyncing && <Spinner variant="bars" size={16} />}
                <span className="text-sm">{isSyncing ? 'Syncing...' : 'Sync Data'}</span>
              </button>
            )}
          </div>

          {/* Summary Cards - Compact, Equal Heights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="card p-4" title="Total cost for the current billing month">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Current Month</div>
              <div className="text-xl font-bold text-gray-900 mb-1">
                {formatCurrency(displayCurrent)}
              </div>
              {hasTax && (
                <div className="text-[10px] text-gray-400 mb-1">
                  {formatCurrency(providerData.currentMonth)} + {formatCurrency(providerData.taxCurrentMonth ?? 0)} tax
                </div>
              )}
              {changePercent !== 0 && (
                <div
                  className={`text-xs mt-1 flex items-center ${
                    changePercent >= 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'
                  }`}
                  title={lastMonthSamePeriod != null ? 'Compared to same period last month (e.g. 1st–today)' : undefined}
                >
                  {changePercent >= 0 ? (
                    <TrendingUp className="h-3 w-3 mr-0.5" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-0.5" />
                  )}
                  {Math.abs(changePercent).toFixed(1)}% vs last month{lastMonthSamePeriod != null ? ' (same period)' : ''}
                </div>
              )}
            </div>

            <div className="card p-4" title="Projected cost for the month based on current usage">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Forecast</div>
              <div className="text-xl font-bold text-gray-900">
                {formatCurrency(providerData.forecast)}
              </div>
            </div>

            <div className="card p-4 bg-[#EFF6FF] border-[#DBEAFE]" title="Savings from reserved instances and commitment plans">
              <div className="text-[10px] font-semibold text-accent-700 uppercase tracking-wide mb-1.5">Savings</div>
              <div className="text-xl font-bold text-accent-700">
                {formatCurrency(providerData.savings || 0)}
              </div>
            </div>
          </div>

        </div>

        {/* Inline Filter Bar */}
        {!hasNoData && (
          <div className="mb-4 bg-white rounded-2xl border border-surface-200 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Period Pills */}
              <div className="flex flex-wrap items-center gap-2">
                {availablePeriods.map((period) => (
                  <button
                    key={period}
                    onClick={() => {
                      console.log(`Period button clicked: ${period}`)
                      setSelectedPeriod(period)
                      setShowCustomFilter(false)
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      selectedPeriod === period
                        ? 'bg-gray-900 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    title={`View costs for ${getPeriodLabel(period).toLowerCase()}`}
                  >
                    {getPeriodLabel(period)}
                  </button>
                ))}
                
                {/* Custom Filter Button - Pro plan only */}
                {maxHistoricalMonths >= 12 && (
                <button
                  onClick={() => {
                    setShowCustomFilter(!showCustomFilter)
                    if (!showCustomFilter) {
                      setSelectedPeriod('custom')
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1 ${
                    selectedPeriod === 'custom'
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title="Select a custom date range"
                >
                  <Calendar className="h-3 w-3" />
                  <span>Custom</span>
                </button>
                )}
              </div>

              {/* Service Filter */}
              {allServices.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setIsServiceDropdownOpen(!isServiceDropdownOpen)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1 ${
                      selectedService 
                        ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    title="Filter charts and data by service"
                  >
                    <Layers className="h-3 w-3" />
                    <span>{selectedService || 'All Services'}</span>
                    <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isServiceDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isServiceDropdownOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setIsServiceDropdownOpen(false)}
                      />
                      <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-xl z-20 max-h-80 overflow-hidden animate-fade-in">
                        <div className="p-2 max-h-72 overflow-y-auto">
                          <button
                            onClick={() => {
                              setSelectedService(null)
                              setIsServiceDropdownOpen(false)
                            }}
                            className={`
                              w-full px-3 py-2 text-left text-xs rounded-lg transition-colors
                              ${selectedService === null 
                                ? 'bg-blue-50 text-blue-700 font-medium' 
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
                                w-full px-3 py-2 text-left text-xs rounded-lg truncate transition-colors
                                ${selectedService === service 
                                  ? 'bg-blue-50 text-blue-700 font-medium' 
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
              )}

              {/* Active Filter Pills */}
              {selectedService && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                  {selectedService}
                  <button 
                    onClick={() => setSelectedService(null)}
                    className="ml-1.5 hover:text-blue-900"
                    title="Remove this filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {/* Advanced Filters Toggle */}
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1 ${
                  showAdvancedFilters 
                    ? 'bg-gray-900 text-white shadow-sm' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title="Show advanced filtering options"
              >
                <SlidersHorizontal className="h-3 w-3" />
                <span>More Filters</span>
                <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${showAdvancedFilters ? 'rotate-180' : ''}`} />
              </button>

              {/* Download Report Button */}
              <div className="relative">
                <button
                  onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                  disabled={isDownloading || isDemoMode}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1 ${
                    isDownloading || isDemoMode
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-accent-500 text-white hover:bg-[#1ea890]'
                  }`}
                  title="Download report for selected period"
                >
                  <Download className="h-3 w-3" />
                  <span>{isDownloading ? 'Generating...' : 'Download Report'}</span>
                </button>

                {showDownloadMenu && !isDownloading && !isDemoMode && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowDownloadMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-20 animate-fade-in">
                      <button
                        onClick={() => handleDownloadReport('pdf')}
                        className="w-full px-4 py-2.5 text-left text-xs hover:bg-gray-50 flex items-center space-x-2 transition-colors"
                      >
                        <FileText className="h-4 w-4 text-red-600" />
                        <span>Download as PDF</span>
                      </button>
                      <button
                        onClick={() => handleDownloadReport('json')}
                        className="w-full px-4 py-2.5 text-left text-xs hover:bg-gray-50 flex items-center space-x-2 transition-colors border-t border-gray-100"
                      >
                        <FileText className="h-4 w-4 text-green-600" />
                        <span>Download as JSON</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Custom Date Range Input */}
            {showCustomFilter && (
              <div className="mt-2.5 p-2.5 bg-surface-50 rounded-xl border border-surface-200">
                <div className="flex items-center space-x-3">
                  <Filter className="h-3.5 w-3.5 text-gray-500" />
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={customStartDate}
                        min={minAllowedDate}
                        onChange={(e) => {
                          const val = e.target.value
                          setCustomStartDate(val < minAllowedDate ? minAllowedDate : val)
                        }}
                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => {
                          setShowCustomFilter(false)
                          setSelectedPeriod('1month')
                        }}
                        className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Advanced Filters Panel */}
            {showAdvancedFilters && (
              <div className="mt-2.5 p-3 bg-surface-50 rounded-xl border border-surface-200">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5">
                  {/* Service Search */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Search Services
                    </label>
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                      <input
                        type="text"
                        value={serviceSearch}
                        onChange={(e) => setServiceSearch(e.target.value)}
                        placeholder="Search by name..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        title="Filter services by name"
                      />
                    </div>
                  </div>

                  {/* Cost Range */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Cost Range
                    </label>
                    <div className="flex items-center space-x-2">
                      <div className="relative flex-1">
                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                        <input
                          type="number"
                          value={minCost}
                          onChange={(e) => setMinCost(e.target.value === '' ? '' : parseFloat(e.target.value))}
                          placeholder="Min"
                          min="0"
                          className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          title="Minimum cost filter"
                        />
                      </div>
                      <span className="text-gray-400 text-xs">–</span>
                      <div className="relative flex-1">
                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                        <input
                          type="number"
                          value={maxCost}
                          onChange={(e) => setMaxCost(e.target.value === '' ? '' : parseFloat(e.target.value))}
                          placeholder="Max"
                          min="0"
                          className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          title="Maximum cost filter"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Cost Change Filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Cost Trend
                    </label>
                    <select
                      value={costChangeFilter}
                      onChange={(e) => setCostChangeFilter(e.target.value as 'all' | 'increase' | 'decrease')}
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                      title="Filter by cost trend"
                    >
                      <option value="all">All Services</option>
                      <option value="increase">↑ Cost Increased</option>
                      <option value="decrease">↓ Cost Decreased</option>
                    </select>
                  </div>

                  {/* Show Credits Toggle */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Display
                    </label>
                  </div>

                  {/* Sort Options */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Sort By
                    </label>
                    <div className="flex items-center space-x-2">
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as 'cost' | 'name' | 'change')}
                        className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                        title="Sort services by"
                      >
                        <option value="cost">Cost</option>
                        <option value="name">Name</option>
                        <option value="change">Change %</option>
                      </select>
                      <button
                        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                        className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                        title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                      >
                        <ArrowUpDown className={`h-3 w-3 transition-transform ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Filter Summary & Reset */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                  <div className="text-xs text-gray-500">
                    Showing <strong className="text-gray-700">{filteredServices.length}</strong> of <strong className="text-gray-700">{providerData?.services.length || 0}</strong> services
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
                    }}
                    className="flex items-center space-x-1 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                    title="Reset all filters to default"
                  >
                    <X className="h-3 w-3" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tabs Navigation */}
        {!hasNoData && (
          <div className="mb-4 border-b border-surface-200">
            <nav className="flex space-x-6">
              <button
                onClick={() => setActiveTab('overview')}
                className={`
                  py-3 px-1 border-b-2 font-semibold text-xs transition-colors
                  ${
                    activeTab === 'overview'
                      ? 'border-accent-500 text-accent-500'
                      : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-surface-200'
                  }
                `}
              >
                <div className="flex items-center space-x-1.5">
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  <span>Overview</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('services')}
                className={`
                  py-3 px-1 border-b-2 font-semibold text-xs transition-colors
                  ${
                    activeTab === 'services'
                      ? 'border-accent-500 text-accent-500'
                      : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-surface-200'
                  }
                `}
              >
                <div className="flex items-center space-x-1.5">
                  <Package className="h-3.5 w-3.5" />
                  <span>Services</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`
                  py-3 px-1 border-b-2 font-semibold text-xs transition-colors
                  ${
                    activeTab === 'analytics'
                      ? 'border-accent-500 text-accent-500'
                      : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-surface-200'
                  }
                `}
              >
                <div className="flex items-center space-x-1.5">
                  <TrendingUpIcon className="h-3.5 w-3.5" />
                  <span>Analytics</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('products')}
                className={`
                  py-3 px-1 border-b-2 font-semibold text-xs transition-colors
                  ${
                    activeTab === 'products'
                      ? 'border-accent-500 text-accent-500'
                      : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-surface-200'
                  }
                `}
              >
                <div className="flex items-center space-x-1.5">
                  <Package className="h-3.5 w-3.5" />
                  <span>Products</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('teams')}
                className={`
                  py-3 px-1 border-b-2 font-semibold text-xs transition-colors
                  ${
                    activeTab === 'teams'
                      ? 'border-accent-500 text-accent-500'
                      : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-surface-200'
                  }
                `}
              >
                <div className="flex items-center space-x-1.5">
                  <Users className="h-3.5 w-3.5" />
                  <span>Teams</span>
                </div>
              </button>
            </nav>
          </div>
        )}

        {/* Tab Content */}
        {!hasNoData && (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-5">
                {/* Cost Summary - Plain-English Explanation */}
                {providerId && (() => {
                  // Resolve accountId: URL param when viewing specific account, or single account
                  const accountFromUrl = searchParams.get('account')
                  const parsedAccountId = accountFromUrl ? parseInt(accountFromUrl, 10) : NaN
                  const costSummaryAccountId = !isNaN(parsedAccountId)
                    ? parsedAccountId
                    : providerAccounts.length === 1
                      ? providerAccounts[0].accountId
                      : undefined

                  // Calculate the date range for the selected period
                  const range = selectedPeriod === 'custom' && customStartDate && customEndDate
                    ? getDateRangeForPeriod('custom', customStartDate, customEndDate)
                    : getDateRangeForPeriod(selectedPeriod)
                  
                  // For periods longer than 1 month, use date range
                  // For 1 month period, use month/year for backward compatibility
                  const useDateRange = selectedPeriod === 'custom' || 
                    selectedPeriod === '2months' || 
                    selectedPeriod === '3months' || 
                    selectedPeriod === '4months' || 
                    selectedPeriod === '6months' || 
                    selectedPeriod === '12months'
                  
                  if (useDateRange) {
                    const startDateStr = range.startDate.toISOString().split('T')[0]
                    const endDateStr = range.endDate.toISOString().split('T')[0]
                    
                    return (
                      <div key={`cost-summary-range-${selectedPeriod}-${startDateStr}-${endDateStr}`}>
                        <CostSummary
                          providerId={providerId}
                          startDate={startDateStr}
                          endDate={endDateStr}
                          accountId={costSummaryAccountId}
                        />
                      </div>
                    )
                  } else {
                    // For 1 month period, use month/year
                    const endDate = range.endDate
                    const summaryMonth = endDate.getMonth() + 1
                    const summaryYear = endDate.getFullYear()
                    
                    return (
                      <div key={`cost-summary-${selectedPeriod}-${summaryMonth}-${summaryYear}`}>
                        <CostSummary
                          providerId={providerId}
                          month={summaryMonth}
                          year={summaryYear}
                          accountId={costSummaryAccountId}
                        />
                      </div>
                    )
                  }
                })()}


                {/* Cost Trend Chart */}
                <div>
                  <div className="flex flex-col items-center text-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Cost Trends</h2>
                    
                    {/* View Mode Toggle - Centered */}
                    <div 
                      className="flex items-center space-x-2 bg-gray-100 rounded-xl p-1"
                      title="Toggle between daily and monthly view"
                    >
                      <button
                        onClick={() => setViewMode('daily')}
                        className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          viewMode === 'daily'
                            ? 'bg-white text-accent-600 shadow-sm'
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
                            ? 'bg-white text-accent-600 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                        title="View monthly aggregated costs"
                      >
                        <BarChart2 className="h-4 w-4" />
                        <span>Monthly</span>
                      </button>
                    </div>
                  </div>

                  {/* Chart Content */}
                  {isLoadingChartData ? (
                    <div className="card flex items-center justify-center h-64">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-600 mx-auto mb-4"></div>
                        <p className="text-gray-500">Loading chart data...</p>
                      </div>
                    </div>
                  ) : (
                    <ProviderCostChart
                      providerId={providerData.provider.id}
                      providerName={providerData.provider.name}
                      data={chartData}
                      currentMonth={displayCurrent}
                      lastMonth={displayLast}
                      lastMonthSamePeriod={lastMonthSamePeriod ?? undefined}
                      currentMonthCost={lastMonthSamePeriod != null ? providerData.currentMonth : undefined}
                      period={viewMode === 'monthly' ? 'monthly' : selectedPeriod}
                      isMonthlyView={viewMode === 'monthly'}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Services Tab */}
            {activeTab === 'services' && (
              <div className="space-y-8">
                {/* Service Breakdown */}
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Service Breakdown</h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl mx-auto mb-6">
                    {/* Pie Chart - Service Distribution */}
                    <div className="card bg-white border-surface-200">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          <BarChart2 className="h-5 w-5 text-accent-600" />
                          Cost by Service
                        </h3>
                        <span className="text-xs font-semibold text-accent-700 bg-accent-100 px-3 py-1.5 rounded-full border border-accent-200">
                          {getPeriodLabel(selectedPeriod)}
                        </span>
                      </div>
                      {isLoadingServices ? (
                        <div className="flex items-center justify-center h-64">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-600"></div>
                        </div>
                      ) : serviceCostData.length > 0 ? (
                        <div className="relative">
                          <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                              <Pie
                                data={serviceCostData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => {
                                  const percentValue = (percent * 100).toFixed(0)
                                  if (percentValue === '0') return ''
                                  return `${name.length > 15 ? name.substring(0, 15) + '...' : name}: ${percentValue}%`
                                }}
                                outerRadius={100}
                                innerRadius={40}
                                fill="#8884d8"
                                dataKey="value"
                                stroke="#ffffff"
                                strokeWidth={2}
                              >
                              {serviceCostData.map((_entry, index) => {
                                const accentColors = [
                                  '#4F5BD5', // accent-500
                                  '#3F4ABF', // accent-600
                                  '#7880E9', // accent-400
                                  '#9CA3F0', // accent-300
                                  '#2F3899', // accent-700
                                  '#C1C5F7', // accent-200
                                  '#1F2673', // accent-800
                                  '#E0E2FB', // accent-100
                                ]
                                return (
                                  <Cell 
                                    key={`cell-${index}`} 
                                    fill={accentColors[index % accentColors.length]} 
                                  />
                                )
                              })}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'white',
                                border: '2px solid #C1C5F7',
                                borderRadius: '12px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                              }}
                              formatter={(_value: number, _name: string, props: any) => formatCurrency(props?.payload?.originalCost ?? _value)}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                          <Layers className="h-12 w-12 mb-3 text-gray-300" />
                          <p className="text-sm">No services found</p>
                        </div>
                      )}
                    </div>

                    {/* Bar Chart - Service Costs */}
                    <div className="card bg-white border-surface-200">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          <BarChart2 className="h-5 w-5 text-accent-600" />
                          Service Costs
                        </h3>
                        <span className="text-xs font-semibold text-accent-700 bg-accent-100 px-3 py-1.5 rounded-full border border-accent-200">
                          {getPeriodLabel(selectedPeriod)}
                        </span>
                      </div>
                      {isLoadingServices ? (
                        <div className="flex items-center justify-center h-64">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-600"></div>
                        </div>
                      ) : serviceCostData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={serviceCostData} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E9ECEF" opacity={0.6} />
                            <XAxis
                              dataKey="name"
                              stroke="#9CA3F0"
                              fontSize={11}
                              angle={-45}
                              textAnchor="end"
                              height={80}
                              tick={{ fill: '#64748B' }}
                            />
                            <YAxis
                              stroke="#9CA3F0"
                              fontSize={11}
                              tick={{ fill: '#64748B' }}
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
                                border: '2px solid #C1C5F7',
                                borderRadius: '12px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                              }}
                              formatter={(_value: number, _name: string, props: any) => formatCurrency(props?.payload?.originalCost ?? _value)}
                              labelStyle={{ color: '#2F3899', fontWeight: '600' }}
                            />
                            <Bar
                              dataKey="value"
                              fill="#4F5BD5"
                              radius={[8, 8, 0, 0]}
                              stroke="#3F4ABF"
                              strokeWidth={1}
                            >
                              {serviceCostData.map((_entry, index) => {
                                const accentColors = [
                                  '#4F5BD5', // accent-500
                                  '#3F4ABF', // accent-600
                                  '#7880E9', // accent-400
                                  '#9CA3F0', // accent-300
                                  '#2F3899', // accent-700
                                ]
                                return (
                                  <Cell 
                                    key={`bar-cell-${index}`} 
                                    fill={accentColors[index % accentColors.length]}
                                    stroke={accentColors[index % accentColors.length]}
                                  />
                                )
                              })}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                          <BarChart2 className="h-12 w-12 mb-3 text-gray-300" />
                          <p className="text-sm">No services found</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Service Details Table */}
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">Service Details</h2>
                  <div className="card bg-gradient-to-br from-white to-accent-50/30 border-accent-100">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Layers className="h-5 w-5 text-accent-600" />
                        Service Breakdown
                        {selectedService && (
                          <span className="text-sm font-normal text-accent-700 ml-2 bg-accent-100 px-2 py-1 rounded-full">
                            (filtered by {selectedService})
                          </span>
                        )}
                      </h3>
                      <span className="text-xs font-semibold text-accent-700 bg-accent-100 px-3 py-1.5 rounded-full border border-accent-200">
                        {getPeriodLabel(selectedPeriod)}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b-2 border-accent-200 bg-accent-50/50">
                            <th className="text-left py-4 px-4 font-semibold text-accent-900 w-8"></th>
                            <th className="text-left py-4 px-4 font-semibold text-accent-900">Service</th>
                            <th className="text-right py-4 px-4 font-semibold text-accent-900">Cost</th>
                            <th className="text-right py-4 px-4 font-semibold text-accent-900">Change</th>
                            <th className="text-right py-4 px-4 font-semibold text-accent-900">% of Total</th>
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
                                <React.Fragment key={`service-${index}-${service.name}`}>
                                  <tr 
                                    className={`border-b border-accent-100 hover:bg-accent-50/50 transition-colors cursor-pointer ${isExpanded ? 'bg-accent-100/70' : ''}`}
                                    onClick={() => handleServiceExpand(service.name, service.cost)}
                                    title="Click to see sub-service breakdown"
                                  >
                                    <td className="py-4 px-2 text-center">
                                      <ChevronDown 
                                        className={`h-4 w-4 text-accent-600 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                      />
                                    </td>
                                    <td className="py-4 px-4 text-gray-900 font-medium">
                                      <div className="flex items-center gap-2">
                                        <Layers className="h-4 w-4 text-accent-500" />
                                        {service.name}
                                      </div>
                                    </td>
                                    <td className="py-4 px-4 text-right font-semibold text-gray-900">
                                      {formatCurrency(service.cost)}
                                    </td>
                                    <td className={`py-4 px-4 text-right font-medium ${
                                      (service.change || 0) >= 0 ? 'text-red-600' : 'text-green-600'
                                    }`}>
                                      {(service.change || 0) >= 0 ? '+' : ''}{(service.change || 0).toFixed(1)}%
                                    </td>
                                    <td className="py-4 px-4 text-right text-accent-700 font-medium">
                                      {percentage.toFixed(1)}%
                                    </td>
                                  </tr>
                                  
                                  {/* Sub-services expandable row */}
                                  {isExpanded && (
                                    <tr key={`sub-${index}-${service.name}`}>
                                      <td colSpan={5} className="bg-surface-50 p-0">
                                        <div className="px-8 py-6">
                                          {isLoadingSubServices ? (
                                            <div className="flex items-center justify-center py-6">
                                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-600"></div>
                                              <span className="ml-3 text-accent-700">Loading sub-service details...</span>
                                            </div>
                                          ) : subServices.length > 0 ? (
                                            <div className="space-y-3">
                                              <h4 className="text-sm font-semibold text-accent-800 flex items-center gap-2 mb-4">
                                                <BarChart2 className="h-4 w-4 text-accent-600" />
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
                                                    <div className="bg-white rounded-lg border border-accent-200 overflow-hidden shadow-sm">
                                                      {subs.map((sub: SubService, subIndex: number) => {
                                                        const subPercentage = service.cost > 0 ? (sub.cost / service.cost) * 100 : 0
                                                        return (
                                                          <div 
                                                            key={`${sub.name}-${subIndex}`}
                                                            className="flex items-center justify-between px-4 py-2.5 border-b border-accent-100 last:border-b-0 hover:bg-accent-50/50 transition-colors"
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
                                </React.Fragment>
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
                </div>
              </div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
              <div className="space-y-8">
                {/* Cost vs Usage Section */}
                {(() => {
                  const range = selectedPeriod === 'custom' && customStartDate && customEndDate
                    ? getDateRangeForPeriod('custom', customStartDate, customEndDate)
                    : getDateRangeForPeriod(selectedPeriod)
                  
                  const startDateStr = range.startDate.toISOString().split('T')[0]
                  const endDateStr = range.endDate.toISOString().split('T')[0]
                  const accountId = providerAccounts.length === 1 ? providerAccounts[0].accountId : undefined
                  
                  // Use key to force re-render when period changes
                  return (
                    <div key={`cost-vs-usage-${selectedPeriod}-${startDateStr}-${endDateStr}`}>
                      <CostVsUsage
                        providerId={providerId || undefined}
                        startDate={startDateStr}
                        endDate={endDateStr}
                        accountId={accountId}
                      />
                    </div>
                  )
                })()}

                {/* Untagged Resources - Provider Specific */}
                {!isDemoMode && providerId && (
                  <UntaggedResources 
                    providerId={providerId} 
                    accountId={providerAccounts.length === 1 ? providerAccounts[0].accountId : undefined}
                  />
                )}

                {/* Cost by Dimension - Provider Specific */}
                {!isDemoMode && providerId && (
                  <CostByDimension 
                    providerId={providerId} 
                    accountId={providerAccounts.length === 1 ? providerAccounts[0].accountId : undefined}
                  />
                )}

                {/* Cost Anomalies - Provider Specific */}
                {!isDemoMode && providerId && (
                  <AnomalyDetection 
                    providerId={providerId} 
                    thresholdPercent={20}
                    accountId={providerAccounts.length === 1 ? providerAccounts[0].accountId : undefined}
                  />
                )}

                {/* Unit Economics - Provider Specific */}
                {!isDemoMode && providerId && (() => {
                  const accountId = providerAccounts.length === 1 ? providerAccounts[0].accountId : undefined
                  if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
                    return (
                      <UnitEconomics 
                        providerId={providerId} 
                        accountId={accountId}
                        startDate={customStartDate}
                        endDate={customEndDate}
                      />
                    )
                  } else {
                    return (
                      <UnitEconomics 
                        providerId={providerId} 
                        accountId={accountId}
                        period={selectedPeriod}
                      />
                    )
                  }
                })()}

                {/* Cost Efficiency Metrics - Provider Specific */}
                {!isDemoMode && providerId && (() => {
                  const accountId = providerAccounts.length === 1 ? providerAccounts[0].accountId : undefined
                  if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
                    return (
                      <CostEfficiencyMetrics 
                        providerId={providerId} 
                        accountId={accountId}
                        startDate={customStartDate}
                        endDate={customEndDate}
                      />
                    )
                  } else {
                    return (
                      <CostEfficiencyMetrics 
                        providerId={providerId} 
                        accountId={accountId}
                        period={selectedPeriod}
                      />
                    )
                  }
                })()}

                {/* Rightsizing Recommendations - Provider Specific */}
                {!isDemoMode && providerId && (
                  <RightsizingRecommendations 
                    providerId={providerId} 
                    accountId={providerAccounts.length === 1 ? providerAccounts[0].accountId : undefined}
                  />
                )}
              </div>
            )}

            {/* Products Tab */}
            {activeTab === 'products' && (
              <div className="space-y-8">
                {(() => {
                  const range = selectedPeriod === 'custom' && customStartDate && customEndDate
                    ? getDateRangeForPeriod('custom', customStartDate, customEndDate)
                    : getDateRangeForPeriod(selectedPeriod)
                  
                  const startDateStr = range.startDate.toISOString().split('T')[0]
                  const endDateStr = range.endDate.toISOString().split('T')[0]
                  const accountId = providerAccounts.length === 1 ? providerAccounts[0].accountId : undefined

                  if (isLoadingProducts) {
                    return (
                      <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-600"></div>
                      </div>
                    )
                  }

                  if (products.length === 0) {
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
                        <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Product Costs Found</h3>
                        <p className="text-gray-600">
                          No resources with product tags found for the selected period. Tag your resources with
                          "product", "productname", or "product_name" tags to see product-level cost allocation.
                        </p>
                      </div>
                    )
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {products.map((product) => (
                        <ProductCostCard
                          key={product.productName}
                          product={product}
                          startDate={startDateStr}
                          endDate={endDateStr}
                          providerId={providerId || undefined}
                          accountId={accountId}
                        />
                      ))}
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Teams Tab */}
            {activeTab === 'teams' && (
              <div className="space-y-8">
                {(() => {
                  const range = selectedPeriod === 'custom' && customStartDate && customEndDate
                    ? getDateRangeForPeriod('custom', customStartDate, customEndDate)
                    : getDateRangeForPeriod(selectedPeriod)
                  
                  const startDateStr = range.startDate.toISOString().split('T')[0]
                  const endDateStr = range.endDate.toISOString().split('T')[0]
                  const accountId = providerAccounts.length === 1 ? providerAccounts[0].accountId : undefined

                  if (isLoadingTeams) {
                    return (
                      <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-600"></div>
                      </div>
                    )
                  }

                  if (teams.length === 0) {
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
                        <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Team Costs Found</h3>
                        <p className="text-gray-600">
                          No resources with team tags found for the selected period. Tag your resources with
                          "team", "teamname", "team_name", or "owner" tags to see team-level cost allocation.
                        </p>
                      </div>
                    )
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {teams.map((team) => (
                        <TeamCostCard
                          key={team.teamName}
                          team={team}
                          startDate={startDateStr}
                          endDate={endDateStr}
                          providerId={providerId || undefined}
                          accountId={accountId}
                        />
                      ))}
                    </div>
                  )
                })()}
              </div>
            )}
          </>
        )}

        {/* No Data Message */}
        {hasNoData && (
          <div className="mb-8 card bg-blue-50 border-blue-200 max-w-3xl mx-auto">
            <div className="p-8 text-center">
              <p className="text-blue-900 font-medium mb-2 text-lg">No cost data available yet</p>
              <p className="text-blue-700">
                Cost data will appear here once your provider is synced. Click "Sync Data" to fetch the latest costs.
              </p>
            </div>
          </div>
        )}

      </div>
    </Layout>
  )
}
