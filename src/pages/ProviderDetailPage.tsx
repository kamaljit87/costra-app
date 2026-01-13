import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCurrency } from '../contexts/CurrencyContext'
import { getProviderCostDetails, CostData, CostDataPoint } from '../services/costService'
import { cloudProvidersAPI } from '../services/api'
import Layout from '../components/Layout'
import ProviderCostChart from '../components/ProviderCostChart'
import { ArrowLeft, TrendingUp, TrendingDown, Calendar, Filter, Gift } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

const PROVIDER_ICONS: { [key: string]: string } = {
  aws: '☁️',
  azure: '🔷',
  gcp: '🔵',
  digitalocean: '🌊',
  linode: '🟢',
  vultr: '⚡',
}

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
                  icon: PROVIDER_ICONS[configuredProvider.providerId] || '☁️',
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

  useEffect(() => {
    if (!providerData) return

    // Apply custom date filter if selected
    if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
      const start = new Date(customStartDate)
      const end = new Date(customEndDate)
      end.setHours(23, 59, 59, 999) // Include the entire end date

      const filtered = providerData.allHistoricalData.filter(point => {
        const pointDate = new Date(point.date)
        return pointDate >= start && pointDate <= end
      })

      setFilteredData(filtered)
    } else {
      setFilteredData([])
    }
  }, [selectedPeriod, customStartDate, customEndDate, providerData])

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

  const getChartData = (): CostDataPoint[] => {
    if (selectedPeriod === 'custom' && filteredData.length > 0) {
      return filteredData
    }

    switch (selectedPeriod) {
      case '30days':
        return providerData.chartData30Days
      case '60days':
        return providerData.chartData60Days
      case '120days':
        return providerData.chartData120Days
      case '180days':
        return providerData.chartData180Days
      case '4months':
        return providerData.chartData4Months
      case '6months':
        return providerData.chartData6Months
      default:
        return providerData.chartData30Days
    }
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

  const handleCustomFilter = () => {
    if (customStartDate && customEndDate) {
      const start = new Date(customStartDate)
      const end = new Date(customEndDate)
      
      if (start > end) {
        alert('Start date must be before end date')
        return
      }
      
      setSelectedPeriod('custom')
      setShowCustomFilter(false)
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
  const isDailyData = selectedPeriod !== '4months' && selectedPeriod !== '6months' && selectedPeriod !== 'custom'

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
            <span className="text-4xl">{providerData.provider.icon}</span>
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
              <div className="flex items-center space-x-2">
                {/* Period Buttons */}
                <div className="flex flex-wrap gap-2">
                  {(['30days', '60days', '120days', '180days', '4months', '6months'] as PeriodType[]).map((period) => (
                    <button
                      key={period}
                      onClick={() => {
                        setSelectedPeriod(period)
                        setShowCustomFilter(false)
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
                  {selectedPeriod === 'custom' && filteredData.length > 0 && (
                    <div className="mt-3 text-sm text-gray-600">
                      Showing {filteredData.length} data points from {new Date(customStartDate).toLocaleDateString()} to {new Date(customEndDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            )}

            <ProviderCostChart
              providerName={providerData.provider.name}
              providerIcon={providerData.provider.icon}
              data={chartData}
              currentMonth={providerData.currentMonth}
              lastMonth={providerData.lastMonth}
              period={isDailyData ? '30days' : selectedPeriod === '4months' ? '4months' : '6months'}
            />
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
                  {serviceCostData.map((entry, index) => (
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
