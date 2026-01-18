import { useState, useEffect } from 'react'
import { useCurrency } from '../contexts/CurrencyContext'
import { insightsAPI } from '../services/api'
import { DollarSign, Users, Activity, TrendingUp, TrendingDown } from 'lucide-react'
import { getDateRangeForPeriod, PeriodType } from '../services/costService'

interface UnitEconomicsData {
  metricType: string
  metricName: string
  unit: string | null
  totalMetricValue: number
  totalCost: number
  unitCost: number | null
  daysWithData: number
}

interface UnitEconomicsProps {
  providerId?: string
  accountId?: number
  period?: PeriodType
  startDate?: string
  endDate?: string
}

export default function UnitEconomics({ providerId, accountId, period = '1month', startDate, endDate }: UnitEconomicsProps) {
  const { formatCurrency } = useCurrency()
  const [data, setData] = useState<{totalCost: number, unitEconomics: UnitEconomicsData[], period: {startDate: string, endDate: string}} | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Calculate date range from period if not provided
  const dateRange = startDate && endDate 
    ? { startDate, endDate }
    : getDateRangeForPeriod(period)

  // Convert date range to ISO strings
  const startDateStr = typeof dateRange.startDate === 'string' 
    ? dateRange.startDate 
    : dateRange.startDate.toISOString().split('T')[0]
  const endDateStr = typeof dateRange.endDate === 'string'
    ? dateRange.endDate
    : dateRange.endDate.toISOString().split('T')[0]

  useEffect(() => {
    fetchUnitEconomics()
  }, [providerId, accountId, startDateStr, endDateStr])

  const fetchUnitEconomics = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await insightsAPI.getUnitEconomics(
        startDateStr,
        endDateStr,
        providerId,
        accountId
      )
      setData(result.data || null)
    } catch (err: any) {
      console.error('Failed to fetch unit economics:', err)
      setError(err.message || 'Failed to load unit economics data')
    } finally {
      setIsLoading(false)
    }
  }

  const getMetricIcon = (metricType: string) => {
    switch (metricType.toLowerCase()) {
      case 'customer':
      case 'customers':
      case 'user':
      case 'users':
        return Users
      case 'api':
      case 'request':
      case 'requests':
        return Activity
      default:
        return DollarSign
    }
  }

  const formatMetricValue = (value: number) => {
    if (!value) return '0'
    
    // Format large numbers
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(2)}M`
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(2)}K`
    }
    return value.toFixed(2)
  }

  if (isLoading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <DollarSign className="h-8 w-8 text-primary-600 animate-pulse mx-auto mb-4" />
            <p className="text-gray-600">Loading unit economics...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-red-600 mb-2">Error loading data</p>
            <p className="text-sm text-gray-500">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!data || data.unitEconomics.length === 0) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Unit Economics</h3>
            <p className="text-sm text-gray-500">Cost per business metric (customer, API call, transaction)</p>
          </div>
          <DollarSign className="h-5 w-5 text-gray-400" />
        </div>
        <div className="flex items-center justify-center py-12 bg-blue-50 rounded-xl border border-blue-200">
          <div className="text-center">
            <DollarSign className="h-10 w-10 text-blue-600 mx-auto mb-3" />
            <p className="text-blue-900 font-medium mb-1">No business metrics found</p>
            <p className="text-blue-700 text-sm">
              Add business metrics (customers, API calls, transactions) to calculate unit economics.
            </p>
            <p className="text-blue-600 text-xs mt-2">
              Use the API or integration to track business metrics alongside costs.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Sort by unit cost (highest first)
  const sortedEconomics = [...data.unitEconomics].sort((a, b) => {
    const costA = a.unitCost || 0
    const costB = b.unitCost || 0
    return costB - costA
  })

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Unit Economics</h3>
          <p className="text-sm text-gray-500">
            Cost per business metric • Total cost: {formatCurrency(data.totalCost)}
          </p>
        </div>
        <DollarSign className="h-5 w-5 text-gray-400" />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {sortedEconomics.slice(0, 3).map((item) => {
          const Icon = getMetricIcon(item.metricType)
          const hasUnitCost = item.unitCost !== null && item.unitCost > 0
          
          return (
            <div
              key={`${item.metricType}-${item.metricName}`}
              className="p-4 bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wider truncate">
                    {item.metricType}
                  </div>
                  <div className="text-sm font-semibold text-gray-900 truncate">
                    {item.metricName}
                  </div>
                </div>
              </div>
              
              {hasUnitCost ? (
                <div className="mt-3">
                  <div className="text-2xl font-bold text-gray-900">
                    {formatCurrency(item.unitCost!)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    per {item.unit || item.metricName}
                  </div>
                  <div className="text-xs text-gray-400 mt-2">
                    {formatMetricValue(item.totalMetricValue)} {item.unit || item.metricName}
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-gray-400 text-sm">No data</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Detailed Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Business Metric
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Total Metric Value
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Total Cost
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Unit Cost
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Efficiency
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedEconomics.map((item) => {
              const Icon = getMetricIcon(item.metricType)
              const hasUnitCost = item.unitCost !== null && item.unitCost > 0
              const isHighCost = hasUnitCost && item.unitCost! > 0.01
              
              return (
                <tr key={`${item.metricType}-${item.metricName}`} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">{item.metricName}</div>
                        <div className="text-xs text-gray-500 capitalize">{item.metricType}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="text-gray-900">
                      {formatMetricValue(item.totalMetricValue)}
                    </div>
                    {item.unit && (
                      <div className="text-xs text-gray-500">{item.unit}</div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="font-medium text-gray-900">{formatCurrency(data.totalCost)}</div>
                    <div className="text-xs text-gray-500">{item.daysWithData} days</div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {hasUnitCost ? (
                      <div className="font-medium text-gray-900">
                        {formatCurrency(item.unitCost!)}
                        {item.unit && (
                          <span className="text-xs text-gray-500"> / {item.unit}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {hasUnitCost ? (
                      <div className="flex items-center justify-end gap-1">
                        {isHighCost ? (
                          <>
                            <TrendingUp className="h-4 w-4 text-yellow-600" />
                            <span className="text-xs text-yellow-700 font-medium">High cost/unit</span>
                          </>
                        ) : (
                          <>
                            <TrendingDown className="h-4 w-4 text-green-600" />
                            <span className="text-xs text-green-700 font-medium">Efficient</span>
                          </>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {data.unitEconomics.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              Showing {data.unitEconomics.length} business metric{data.unitEconomics.length !== 1 ? 's' : ''}
            </span>
            <span className="text-xs text-gray-500">
              {startDateStr} to {endDateStr}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
