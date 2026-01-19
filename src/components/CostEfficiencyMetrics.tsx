import { useState, useEffect } from 'react'
import { useCurrency } from '../contexts/CurrencyContext'
import { insightsAPI } from '../services/api'
import { TrendingUp, TrendingDown, Minus, Activity, Database, Zap, Info, X } from 'lucide-react'
import { getDateRangeForPeriod, PeriodType } from '../services/costService'

interface EfficiencyMetric {
  serviceName: string
  serviceType: string
  totalCost: number
  totalUsage: number
  unit: string
  efficiency: number | null
  previousEfficiency: number | null
  trend: 'improving' | 'stable' | 'degrading'
  efficiencyChange: number | null
  efficiencyChangePercent: number | null
  daysWithData: number
}

interface CostEfficiencyMetricsProps {
  providerId?: string
  accountId?: number
  period?: PeriodType
  startDate?: string
  endDate?: string
}

export default function CostEfficiencyMetrics({ providerId, accountId, period = '1month', startDate, endDate }: CostEfficiencyMetricsProps) {
  const { formatCurrency } = useCurrency()
  const [data, setData] = useState<{efficiencyMetrics: EfficiencyMetric[], period: {startDate: string, endDate: string}} | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInfoDialog, setShowInfoDialog] = useState(false)

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
    fetchEfficiencyMetrics()
  }, [providerId, accountId, startDateStr, endDateStr])

  const fetchEfficiencyMetrics = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await insightsAPI.getCostEfficiency(
        startDateStr,
        endDateStr,
        providerId,
        accountId
      )
      setData(result.data || null)
    } catch (err: any) {
      console.error('Failed to fetch cost efficiency metrics:', err)
      setError(err.message || 'Failed to load cost efficiency metrics')
    } finally {
      setIsLoading(false)
    }
  }

  const getServiceTypeIcon = (serviceType: string) => {
    switch (serviceType.toLowerCase()) {
      case 'storage':
        return Database
      case 'compute':
        return Zap
      case 'api':
      case 'transaction':
        return Activity
      default:
        return Activity
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return TrendingDown // Lower cost per unit is better
      case 'degrading':
        return TrendingUp // Higher cost per unit is worse
      default:
        return Minus
    }
  }

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving':
        return 'text-green-600'
      case 'degrading':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const formatEfficiency = (efficiency: number | null, unit: string) => {
    if (efficiency === null) return 'N/A'
    return `${formatCurrency(efficiency)}/${unit}`
  }

  const formatUsage = (usage: number, unit: string) => {
    if (usage >= 1000000) {
      return `${(usage / 1000000).toFixed(2)}M ${unit}`
    } else if (usage >= 1000) {
      return `${(usage / 1000).toFixed(2)}K ${unit}`
    }
    return `${usage.toFixed(2)} ${unit}`
  }

  if (isLoading) {
    return (
      <div className="card bg-gradient-to-br from-white to-frozenWater-50/30 border-frozenWater-100">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Activity className="h-8 w-8 text-frozenWater-600 animate-pulse mx-auto mb-4" />
            <p className="text-frozenWater-700">Loading efficiency metrics...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card bg-gradient-to-br from-white to-frozenWater-50/30 border-frozenWater-100">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-red-600 mb-2">Error loading data</p>
            <p className="text-sm text-frozenWater-600">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!data || data.efficiencyMetrics.length === 0) {
    return (
      <div className="card bg-gradient-to-br from-white to-frozenWater-50/30 border-frozenWater-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Activity className="h-5 w-5 text-frozenWater-600" />
              Cost Efficiency Metrics
              <button
                onClick={() => setShowInfoDialog(true)}
                className="ml-2 p-1 rounded-full hover:bg-frozenWater-100 transition-colors group"
                title="Learn more about Cost Efficiency"
              >
                <Info className="h-4 w-4 text-frozenWater-600 group-hover:text-frozenWater-700" />
              </button>
            </h3>
            <p className="text-sm text-frozenWater-600">Cost per unit of usage (GB, hour, request)</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12 bg-frozenWater-50 rounded-xl border border-frozenWater-200">
          <div className="text-center">
            <Activity className="h-10 w-10 text-frozenWater-600 mx-auto mb-3" />
            <p className="text-frozenWater-900 font-medium mb-1">No efficiency data available</p>
            <p className="text-frozenWater-700 text-sm">
              Efficiency metrics require usage data. Sync your cost data to see efficiency metrics.
            </p>
          </div>
        </div>

        {/* Info Dialog */}
        {showInfoDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowInfoDialog(false)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 border-2 border-frozenWater-200" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Activity className="h-6 w-6 text-frozenWater-600" />
                    What are Cost Efficiency Metrics?
                  </h3>
                  <button
                    onClick={() => setShowInfoDialog(false)}
                    className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                </div>
                
                <div className="space-y-4 text-gray-700">
                  <p>
                    <strong className="text-frozenWater-700">Cost Efficiency Metrics</strong> measure how efficiently 
                    you're spending money relative to your usage. They help identify services that appear cheap 
                    but are inefficient at scale.
                  </p>
                  
                  <div className="bg-frozenWater-50 rounded-lg p-4 border border-frozenWater-200">
                    <h4 className="font-semibold text-frozenWater-800 mb-2">Examples:</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-frozenWater-600 mt-0.5">•</span>
                        <span><strong>Storage:</strong> Cost per GB/month (e.g., $0.023/GB)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-frozenWater-600 mt-0.5">•</span>
                        <span><strong>Compute:</strong> Cost per compute hour (e.g., $0.05/hour)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-frozenWater-600 mt-0.5">•</span>
                        <span><strong>API:</strong> Cost per request (e.g., $0.002/request)</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <h4 className="font-semibold text-blue-800 mb-2">💡 How It Works:</h4>
                    <p className="text-sm text-blue-700 mb-2">
                      Efficiency is calculated by dividing total cost by total usage for each service. 
                      Trends show whether efficiency is improving (lower cost per unit) or degrading (higher cost per unit).
                    </p>
                  </div>
                  
                  <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                    <h4 className="font-semibold text-yellow-800 mb-2">🎯 Why It Matters:</h4>
                    <p className="text-sm text-yellow-700">
                      A service might have low total costs but poor efficiency. For example, spending $100 
                      on 1,000 GB of storage ($0.10/GB) is less efficient than spending $200 on 10,000 GB 
                      ($0.02/GB). Efficiency metrics help identify optimization opportunities.
                    </p>
                  </div>
                </div>
                
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setShowInfoDialog(false)}
                    className="px-4 py-2 bg-frozenWater-600 hover:bg-frozenWater-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Got it
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Sort by efficiency (worst first) or by cost if no efficiency
  const sortedMetrics = [...data.efficiencyMetrics].sort((a, b) => {
    if (a.efficiency === null && b.efficiency === null) return b.totalCost - a.totalCost
    if (a.efficiency === null) return 1
    if (b.efficiency === null) return -1
    return b.efficiency - a.efficiency // Worst efficiency first
  })

  return (
    <div className="card bg-gradient-to-br from-white to-frozenWater-50/30 border-frozenWater-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Activity className="h-5 w-5 text-frozenWater-600" />
            Cost Efficiency Metrics
            <button
              onClick={() => setShowInfoDialog(true)}
              className="ml-2 p-1 rounded-full hover:bg-frozenWater-100 transition-colors group"
              title="Learn more about Cost Efficiency"
            >
              <Info className="h-4 w-4 text-frozenWater-600 group-hover:text-frozenWater-700" />
            </button>
          </h3>
          <p className="text-sm text-frozenWater-600">
            Cost per unit of usage • {startDateStr} to {endDateStr}
          </p>
        </div>
      </div>

      {/* Efficiency Metrics Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-frozenWater-200">
              <th className="text-left py-3 px-4 text-xs font-semibold text-frozenWater-700 uppercase tracking-wider">
                Service
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-frozenWater-700 uppercase tracking-wider">
                Total Cost
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-frozenWater-700 uppercase tracking-wider">
                Total Usage
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-frozenWater-700 uppercase tracking-wider">
                Efficiency
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-frozenWater-700 uppercase tracking-wider">
                Trend
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-frozenWater-100">
            {sortedMetrics.map((metric, index) => {
              const ServiceIcon = getServiceTypeIcon(metric.serviceType)
              const TrendIcon = getTrendIcon(metric.trend)
              const trendColor = getTrendColor(metric.trend)
              
              return (
                <tr key={`${metric.serviceName}-${metric.unit}-${index}`} className="hover:bg-frozenWater-50/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <ServiceIcon className="h-4 w-4 text-frozenWater-500" />
                      <div>
                        <div className="font-medium text-gray-900">{metric.serviceName}</div>
                        <div className="text-xs text-frozenWater-600 capitalize">{metric.serviceType}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="font-medium text-gray-900">{formatCurrency(metric.totalCost)}</div>
                    <div className="text-xs text-frozenWater-600">{metric.daysWithData} days</div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="text-gray-900">{formatUsage(metric.totalUsage, metric.unit)}</div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {metric.efficiency !== null ? (
                      <div>
                        <div className="font-medium text-gray-900">
                          {formatEfficiency(metric.efficiency, metric.unit)}
                        </div>
                        {metric.previousEfficiency !== null && metric.efficiencyChangePercent !== null && (
                          <div className={`text-xs ${trendColor}`}>
                            {metric.efficiencyChangePercent > 0 ? '+' : ''}{metric.efficiencyChangePercent.toFixed(1)}%
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {metric.efficiency !== null && metric.trend !== 'stable' ? (
                      <div className="flex items-center justify-end gap-1">
                        <TrendIcon className={`h-4 w-4 ${trendColor}`} />
                        <span className={`text-xs font-medium capitalize ${trendColor}`}>
                          {metric.trend}
                        </span>
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

      {data.efficiencyMetrics.length > 0 && (
        <div className="mt-4 pt-4 border-t border-frozenWater-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-frozenWater-700">
              Showing {data.efficiencyMetrics.length} service{data.efficiencyMetrics.length !== 1 ? 's' : ''} with efficiency data
            </span>
            <span className="text-xs text-frozenWater-600">
              {startDateStr} to {endDateStr}
            </span>
          </div>
        </div>
      )}

      {/* Info Dialog */}
      {showInfoDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowInfoDialog(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 border-2 border-frozenWater-200" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Activity className="h-6 w-6 text-frozenWater-600" />
                  What are Cost Efficiency Metrics?
                </h3>
                <button
                  onClick={() => setShowInfoDialog(false)}
                  className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              
              <div className="space-y-4 text-gray-700">
                <p>
                  <strong className="text-frozenWater-700">Cost Efficiency Metrics</strong> measure how efficiently 
                  you're spending money relative to your usage. They help identify services that appear cheap 
                  but are inefficient at scale.
                </p>
                
                <div className="bg-frozenWater-50 rounded-lg p-4 border border-frozenWater-200">
                  <h4 className="font-semibold text-frozenWater-800 mb-2">Examples:</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-frozenWater-600 mt-0.5">•</span>
                      <span><strong>Storage:</strong> Cost per GB/month (e.g., $0.023/GB)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-frozenWater-600 mt-0.5">•</span>
                      <span><strong>Compute:</strong> Cost per compute hour (e.g., $0.05/hour)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-frozenWater-600 mt-0.5">•</span>
                      <span><strong>API:</strong> Cost per request (e.g., $0.002/request)</span>
                    </li>
                  </ul>
                </div>
                
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h4 className="font-semibold text-blue-800 mb-2">💡 How It Works:</h4>
                  <p className="text-sm text-blue-700 mb-2">
                    Efficiency is calculated by dividing total cost by total usage for each service. 
                    Trends show whether efficiency is improving (lower cost per unit) or degrading (higher cost per unit).
                  </p>
                </div>
                
                <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                  <h4 className="font-semibold text-yellow-800 mb-2">🎯 Why It Matters:</h4>
                  <p className="text-sm text-yellow-700">
                    A service might have low total costs but poor efficiency. For example, spending $100 
                    on 1,000 GB of storage ($0.10/GB) is less efficient than spending $200 on 10,000 GB 
                    ($0.02/GB). Efficiency metrics help identify optimization opportunities.
                  </p>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowInfoDialog(false)}
                  className="px-4 py-2 bg-frozenWater-600 hover:bg-frozenWater-700 text-white rounded-lg font-medium transition-colors"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
