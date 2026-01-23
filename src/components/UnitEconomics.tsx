import { useState, useEffect } from 'react'
import { useCurrency } from '../contexts/CurrencyContext'
import { insightsAPI, billingAPI } from '../services/api'
import { DollarSign, Users, Activity, TrendingUp, TrendingDown, Info, X } from 'lucide-react'
import { getDateRangeForPeriod, PeriodType } from '../services/costService'
import UpgradePrompt from './UpgradePrompt'

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
  const [showInfoDialog, setShowInfoDialog] = useState(false)
  const [subscriptionStatus, setSubscriptionStatus] = useState<{ planType: string } | null>(null)

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
    loadSubscriptionStatus()
    fetchUnitEconomics()
  }, [providerId, accountId, startDateStr, endDateStr])
  
  const loadSubscriptionStatus = async () => {
    try {
      const response = await billingAPI.getSubscription()
      setSubscriptionStatus(response.status)
    } catch (error) {
      console.error('Failed to load subscription status:', error)
    }
  }

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
      // Check if it's a 403 (feature not available)
      if (err.message?.includes('403') || err.message?.includes('Feature not available') || err.message?.includes('Pro subscription')) {
        setError('PRO_FEATURE')
      } else {
        setError(err.message || 'Failed to load unit economics data')
      }
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
      <div className="card bg-white border-frozenWater-100">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <DollarSign className="h-8 w-8 text-frozenWater-600 animate-pulse mx-auto mb-4" />
            <p className="text-frozenWater-700">Loading unit economics...</p>
          </div>
        </div>
      </div>
    )
  }

  // Show upgrade prompt if feature not available
  if (error === 'PRO_FEATURE' || (subscriptionStatus && subscriptionStatus.planType !== 'pro' && error?.includes('403'))) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <UpgradePrompt
          feature="Unit Economics"
          requiredPlan="Pro"
          description="Track cost per business metric (customers, API calls, transactions) to understand unit economics and optimize spending."
        />
      </div>
    )
  }

  if (error) {
    return (
      <div className="card bg-white border-frozenWater-100">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-red-600 mb-2">Error loading data</p>
            <p className="text-sm text-frozenWater-600">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!data || data.unitEconomics.length === 0) {
    return (
      <div className="card bg-white border-frozenWater-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-frozenWater-600" />
              Unit Economics
              <button
                onClick={() => setShowInfoDialog(true)}
                className="ml-2 p-1 rounded-full hover:bg-frozenWater-100 transition-colors group"
                title="Learn more about Unit Economics"
              >
                <Info className="h-4 w-4 text-frozenWater-600 group-hover:text-frozenWater-700" />
              </button>
            </h3>
            <p className="text-sm text-frozenWater-600">Cost per business metric (customer, API call, transaction)</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12 bg-frozenWater-50 rounded-xl border border-frozenWater-200">
          <div className="text-center">
            <DollarSign className="h-10 w-10 text-frozenWater-600 mx-auto mb-3" />
            <p className="text-frozenWater-900 font-medium mb-1">No business metrics found</p>
            <p className="text-frozenWater-700 text-sm mb-2">
              Add business metrics (customers, API calls, transactions) to calculate unit economics.
            </p>
            <p className="text-frozenWater-600 text-xs">
              Use the API or integration to track business metrics alongside costs.
            </p>
          </div>
        </div>

        {/* Info Dialog */}
        {showInfoDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md animate-fade-in" onClick={() => setShowInfoDialog(false)}>
            <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] max-w-lg w-full mx-4 border border-gray-200/50" onClick={(e) => e.stopPropagation()}>
              <div className="p-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <DollarSign className="h-6 w-6 text-frozenWater-600" />
                    What are Unit Economics?
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
                    <strong className="text-frozenWater-700">Unit Economics</strong> measures the cost per unit of business value, 
                    helping you understand how efficiently you're spending money relative to your business metrics.
                  </p>
                  
                  <div className="bg-frozenWater-50 rounded-2xl p-5 border border-frozenWater-200/50">
                    <h4 className="font-semibold text-frozenWater-800 mb-2">Examples:</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-frozenWater-600 mt-0.5">•</span>
                        <span><strong>Cost per Customer:</strong> Total cloud costs ÷ Number of customers</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-frozenWater-600 mt-0.5">•</span>
                        <span><strong>Cost per API Call:</strong> Total cloud costs ÷ Number of API requests</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-frozenWater-600 mt-0.5">•</span>
                        <span><strong>Cost per Transaction:</strong> Total cloud costs ÷ Number of transactions processed</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="bg-blue-50 rounded-2xl p-5 border border-blue-200/50">
                    <h4 className="font-semibold text-blue-800 mb-2">💡 How to Get Started:</h4>
                    <p className="text-sm text-blue-700 mb-2">
                      To calculate unit economics, you need to track business metrics alongside your cloud costs:
                    </p>
                    <ul className="space-y-1 text-sm text-blue-700">
                      <li>• Use the API to send business metrics (customers, API calls, transactions)</li>
                      <li>• Integrate with your application to automatically track metrics</li>
                      <li>• Once metrics are tracked, unit economics will be calculated automatically</li>
                    </ul>
                  </div>
                  
                  <div className="bg-yellow-50 rounded-2xl p-5 border border-yellow-200/50">
                    <h4 className="font-semibold text-yellow-800 mb-2">🎯 Why It Matters:</h4>
                    <p className="text-sm text-yellow-700">
                      Unit economics helps you understand if your cloud costs are scaling efficiently with your business growth. 
                      If cost per customer is increasing, it might indicate inefficiencies or opportunities for optimization.
                    </p>
                  </div>
                </div>
                
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setShowInfoDialog(false)}
                    className="btn-primary px-6 py-2.5"
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

  // Sort by unit cost (highest first)
  const sortedEconomics = [...data.unitEconomics].sort((a, b) => {
    const costA = a.unitCost || 0
    const costB = b.unitCost || 0
    return costB - costA
  })

  return (
    <div className="card bg-white border-frozenWater-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-frozenWater-600" />
            Unit Economics
            <button
              onClick={() => setShowInfoDialog(true)}
              className="ml-2 p-1 rounded-full hover:bg-frozenWater-100 transition-colors group"
              title="Learn more about Unit Economics"
            >
              <Info className="h-4 w-4 text-frozenWater-600 group-hover:text-frozenWater-700" />
            </button>
          </h3>
          <p className="text-sm text-frozenWater-600">
            Cost per business metric • Total cost: {formatCurrency(data.totalCost)}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {sortedEconomics.slice(0, 3).map((item) => {
          const Icon = getMetricIcon(item.metricType)
          const hasUnitCost = item.unitCost !== null && item.unitCost > 0
          
          return (
            <div
              key={`${item.metricType}-${item.metricName}`}
              className="p-4 bg-gradient-to-br from-white to-frozenWater-50/50 rounded-xl border border-frozenWater-200 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-frozenWater-100 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-frozenWater-600" />
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
            <tr className="border-b border-frozenWater-200">
              <th className="text-left py-3 px-4 text-xs font-semibold text-frozenWater-700 uppercase tracking-wider">
                Business Metric
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-frozenWater-700 uppercase tracking-wider">
                Total Metric Value
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-frozenWater-700 uppercase tracking-wider">
                Total Cost
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-frozenWater-700 uppercase tracking-wider">
                Unit Cost
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-frozenWater-700 uppercase tracking-wider">
                Efficiency
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-frozenWater-100">
            {sortedEconomics.map((item) => {
              const Icon = getMetricIcon(item.metricType)
              const hasUnitCost = item.unitCost !== null && item.unitCost > 0
              const isHighCost = hasUnitCost && item.unitCost! > 0.01
              
              return (
                <tr key={`${item.metricType}-${item.metricName}`} className="hover:bg-frozenWater-50/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-frozenWater-500" />
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
        <div className="mt-4 pt-4 border-t border-frozenWater-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-frozenWater-700">
              Showing {data.unitEconomics.length} business metric{data.unitEconomics.length !== 1 ? 's' : ''}
            </span>
            <span className="text-xs text-frozenWater-600">
              {startDateStr} to {endDateStr}
            </span>
          </div>
        </div>
      )}

      {/* Info Dialog */}
      {showInfoDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md animate-fade-in" onClick={() => setShowInfoDialog(false)}>
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] max-w-lg w-full mx-4 border border-gray-200/50" onClick={(e) => e.stopPropagation()}>
            <div className="p-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <DollarSign className="h-6 w-6 text-frozenWater-600" />
                  What are Unit Economics?
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
                  <strong className="text-frozenWater-700">Unit Economics</strong> measures the cost per unit of business value, 
                  helping you understand how efficiently you're spending money relative to your business metrics.
                </p>
                
                <div className="bg-frozenWater-50 rounded-2xl p-5 border border-frozenWater-200/50">
                  <h4 className="font-semibold text-frozenWater-800 mb-2">Examples:</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-frozenWater-600 mt-0.5">•</span>
                      <span><strong>Cost per Customer:</strong> Total cloud costs ÷ Number of customers</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-frozenWater-600 mt-0.5">•</span>
                      <span><strong>Cost per API Call:</strong> Total cloud costs ÷ Number of API requests</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-frozenWater-600 mt-0.5">•</span>
                      <span><strong>Cost per Transaction:</strong> Total cloud costs ÷ Number of transactions processed</span>
                    </li>
                  </ul>
                </div>
                
                <div className="bg-blue-50 rounded-2xl p-5 border border-blue-200/50">
                  <h4 className="font-semibold text-blue-800 mb-2">💡 How to Get Started:</h4>
                  <p className="text-sm text-blue-700 mb-2">
                    To calculate unit economics, you need to track business metrics alongside your cloud costs:
                  </p>
                  <ul className="space-y-1 text-sm text-blue-700">
                    <li>• Use the API to send business metrics (customers, API calls, transactions)</li>
                    <li>• Integrate with your application to automatically track metrics</li>
                    <li>• Once metrics are tracked, unit economics will be calculated automatically</li>
                  </ul>
                </div>
                
                <div className="bg-yellow-50 rounded-2xl p-5 border border-yellow-200/50">
                  <h4 className="font-semibold text-yellow-800 mb-2">🎯 Why It Matters:</h4>
                  <p className="text-sm text-yellow-700">
                    Unit economics helps you understand if your cloud costs are scaling efficiently with your business growth. 
                    If cost per customer is increasing, it might indicate inefficiencies or opportunities for optimization.
                  </p>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowInfoDialog(false)}
                  className="btn-primary px-6 py-2.5"
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
