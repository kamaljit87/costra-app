import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCurrency } from '../contexts/CurrencyContext'
import { getProviderCostDetails, CostData, CostDataPoint, fetchDailyCostDataForRange, getDateRangeForPeriod, aggregateToMonthly } from '../services/costService'
import { cloudProvidersAPI } from '../services/api'
import Layout from '../components/Layout'
import ProviderCostChart from '../components/ProviderCostChart'
import { ArrowLeft, TrendingUp, TrendingDown, Calendar, Filter, Gift, BarChart2, LineChart } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { ProviderIcon, getProviderColor } from '../components/CloudProviderIcons'

type PeriodType = '30days' | '60days' | '120days' | '180days' | '4months' | '6months' | 'custom'

export default function ProviderDetailPage() {
  const { providerId } = useParams<{ providerId: string }>()
  const { isDemoMode } = useAuth()
  const { formatCurrency, convertAmount } = useCurrency()
  const [providerData, setProviderData] = useState<CostData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('30days')
  const [showCustomFilter, setShowCustomFilter] = useState(false)
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [filteredData, setFilteredData] = useState<CostDataPoint[]>([])
  const [isLoadingChartData, setIsLoadingChartData] = useState(false)
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily')

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
                chartData30Days: [],
                chartData60Days: [],
                chartData120Days: [],
                chartData180Days: [],
                chartData4Months: [],
                chartData6Months: [],
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

  // Fetch data when period changes (especially for custom, 4months, 6months)
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
      // For standard periods (30days, 60days, 120days, 180days), use preloaded data
      if (['30days', '60days', '120days', '180days'].includes(selectedPeriod)) {
        setFilteredData([])
        setIsLoadingChartData(false)
        return
      }

      // For 4months, 6months, or custom, always fetch fresh data from API
      setIsLoadingChartData(true)
      setFilteredData([]) // Clear previous data

      try {
        let startDate: Date
        let endDate: Date

        if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
          const range = getDateRangeForPeriod('custom', customStartDate, customEndDate)
          startDate = range.startDate
          endDate = range.endDate
        } else if (selectedPeriod === '4months' || selectedPeriod === '6months') {
          const range = getDateRangeForPeriod(selectedPeriod)
          startDate = range.startDate
          endDate = range.endDate
        } else {
          setIsLoadingChartData(false)
          return
        }

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
            // Last resort: use preloaded chart data
            const fallbackData = selectedPeriod === '4months' 
              ? providerData.chartData4Months 
              : selectedPeriod === '6months'
              ? providerData.chartData6Months
              : []
            setFilteredData(fallbackData)
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

  const hasNoData = providerData.currentMonth === 0 && providerData.services.length === 0

  const changePercent = providerData.lastMonth > 0
    ? ((providerData.currentMonth - providerData.lastMonth) / providerData.lastMonth) * 100
    : 0

  const getDailyChartData = (): CostDataPoint[] => {
    // For custom, 4months, or 6months, prioritize filteredData (freshly fetched)
    if (selectedPeriod === 'custom' || selectedPeriod === '4months' || selectedPeriod === '6months') {
      if (filteredData.length > 0) {
        return filteredData
      }
      
      // If filteredData is empty but we're loading, return empty array
      if (isLoadingChartData) {
        return []
      }
      
      // Fallback: try to filter from allHistoricalData
      if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
        const { startDate, endDate } = getDateRangeForPeriod('custom', customStartDate, customEndDate)
        const filtered = providerData.allHistoricalData.filter(point => {
          const pointDate = new Date(point.date)
          return pointDate >= startDate && pointDate <= endDate
        })
        return filtered.length > 0 ? filtered : []
      }
      
      // For 4months or 6months, use preloaded data as fallback
      if (selectedPeriod === '4months') {
        return providerData.chartData4Months
      }
      if (selectedPeriod === '6months') {
        return providerData.chartData6Months
      }
      
      return []
    }

    // For standard periods, use preloaded data
    switch (selectedPeriod) {
      case '30days':
        return providerData.chartData30Days
      case '60days':
        return providerData.chartData60Days
      case '120days':
        return providerData.chartData120Days
      case '180days':
        return providerData.chartData180Days
      default:
        return providerData.chartData30Days
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

  const getPeriodLabel = (period: PeriodType): string => {
    switch (period) {
      case '30days': return '30 Days'
      case '60days': return '60 Days'
      case '120days': return '120 Days'
      case '180days': return '180 Days'
      case '4months': return '4 Months'
      case '6months': return '6 Months'
      case 'custom': return 'Custom Range'
      default: return '30 Days'
    }
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

  // Prepare service cost data for pie chart
  const serviceCostData = providerData.services.map(service => ({
    name: service.name,
    value: convertAmount(service.cost),
    change: service.change,
  }))

  const COLORS = ['#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7']

  const chartData = getChartData()

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link
          to="/dashboard"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Link>

        {/* Provider Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <div 
              className="w-16 h-16 flex items-center justify-center rounded-xl"
              style={{ backgroundColor: `${getProviderColor(providerId || '')}15` }}
            >
              <ProviderIcon providerId={providerId || ''} size={40} />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <h1 className="text-3xl font-bold text-gray-900">{providerData.provider.name}</h1>
                {providerData.credits > 0 && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-200">
                    <Gift className="h-4 w-4 mr-1.5" />
                    Credits Applied
                  </span>
                )}
              </div>
              <p className="text-gray-600 mt-1">Detailed cost breakdown and analytics</p>
              {providerData.credits > 0 && (
                <p className="text-sm text-green-700 mt-2 flex items-center">
                  <Gift className="h-4 w-4 mr-1.5" />
                  <span className="font-medium">-{formatCurrency(convertAmount(providerData.credits))} in credits applied to this account</span>
                </p>
              )}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid md:grid-cols-4 gap-4 mt-6">
            <div className="card">
              <div className="text-sm text-gray-600 mb-1">Current Month</div>
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

            <div className="card">
              <div className="text-sm text-gray-600 mb-1">Forecast</div>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(convertAmount(providerData.forecast))}
              </div>
            </div>

            <div className="card bg-green-50 border-green-200">
              <div className="text-sm text-gray-600 mb-1">Credits</div>
              <div className="text-2xl font-bold text-green-700">
                {formatCurrency(convertAmount(providerData.credits))}
              </div>
            </div>

            <div className="card bg-blue-50 border-blue-200">
              <div className="text-sm text-gray-600 mb-1">Savings</div>
              <div className="text-2xl font-bold text-blue-700">
                {formatCurrency(convertAmount(providerData.savings))}
              </div>
            </div>
          </div>
        </div>

        {/* No Data Message */}
        {hasNoData && (
          <div className="mb-8 card bg-blue-50 border-blue-200">
            <div className="p-6 text-center">
              <p className="text-blue-900 font-medium mb-2">No cost data available yet</p>
              <p className="text-blue-700 text-sm">
                Cost data will appear here once your provider is synced. Data is typically synced every 24 hours.
              </p>
            </div>
          </div>
        )}

        {/* Cost Trend Chart */}
        {!hasNoData && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Cost Trends</h2>
              
              {/* View Mode Toggle */}
              <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('daily')}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'daily'
                      ? 'bg-white text-primary-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <LineChart className="h-4 w-4" />
                  <span>Daily</span>
                </button>
                <button
                  onClick={() => setViewMode('monthly')}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'monthly'
                      ? 'bg-white text-primary-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
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
                  {(['30days', '60days', '120days', '180days', '4months', '6months'] as PeriodType[]).map((period) => (
                    <button
                      key={period}
                      onClick={() => {
                        console.log(`Period button clicked: ${period}`)
                        setSelectedPeriod(period)
                        setShowCustomFilter(false)
                        // Clear filtered data to trigger fresh fetch for 4months/6months
                        if (period === '4months' || period === '6months') {
                          setFilteredData([])
                        }
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedPeriod === period
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
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
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ${
                      selectedPeriod === 'custom'
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Calendar className="h-4 w-4" />
                    <span>Custom</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Custom Date Range Filter */}
            {showCustomFilter && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        max={customEndDate || new Date().toISOString().split('T')[0]}
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        min={customStartDate}
                        max={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={handleCustomFilter}
                        className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
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
                  <p className="text-gray-600">Loading chart data...</p>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost by Service</h3>
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
          </div>

          {/* Bar Chart - Service Costs */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Costs</h3>
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
                    if (value >= 1000) {
                      return `$${(value / 1000).toFixed(1)}k`
                    }
                    return `$${value}`
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Bar dataKey="value" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        )}

        {/* Service Details Table */}
        {!hasNoData && (
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Service</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">Cost</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">Change</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {providerData.services.map((service, index) => {
                    const percentage = providerData.currentMonth > 0 
                      ? (service.cost / providerData.currentMonth) * 100 
                      : 0
                    return (
                      <tr key={`service-${index}-${service.name}`} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-900">{service.name}</td>
                        <td className="py-3 px-4 text-right font-medium text-gray-900">
                          {formatCurrency(convertAmount(service.cost))}
                        </td>
                        <td className={`py-3 px-4 text-right ${
                          (service.change || 0) >= 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {(service.change || 0) >= 0 ? '+' : ''}{(service.change || 0).toFixed(1)}%
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600">
                          {percentage.toFixed(1)}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
