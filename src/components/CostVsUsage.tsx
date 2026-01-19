import { useState, useEffect } from 'react'
import { useCurrency } from '../contexts/CurrencyContext'
import { insightsAPI } from '../services/api'
import { Activity, TrendingUp, BarChart3, Info, X } from 'lucide-react'

interface CostVsUsageData {
  serviceName: string
  cost: number
  usage: number
  usageUnit: string
  usageType: string
  unitCost: number | null
  daysWithData: number
}

interface CostVsUsageProps {
  providerId?: string
  startDate: string
  endDate: string
  accountId?: number
}

export default function CostVsUsage({ providerId, startDate, endDate, accountId }: CostVsUsageProps) {
  const { formatCurrency } = useCurrency()
  const [data, setData] = useState<CostVsUsageData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInfoDialog, setShowInfoDialog] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const result = await insightsAPI.getCostVsUsage(providerId, startDate, endDate, accountId)
        // Handle both array and object with data property
        const dataArray = Array.isArray(result) ? result : (result.data || result)
        setData(dataArray)
      } catch (err: any) {
        console.error('Failed to fetch cost vs usage:', err)
        setError(err.message || 'Failed to load cost vs usage data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [providerId, startDate, endDate, accountId])

  const formatUsage = (usage: number, unit: string | null) => {
    if (!usage || !unit) return 'N/A'
    
    // Format large numbers
    if (usage >= 1000000) {
      return `${(usage / 1000000).toFixed(2)}M ${unit}`
    } else if (usage >= 1000) {
      return `${(usage / 1000).toFixed(2)}K ${unit}`
    }
    return `${usage.toFixed(2)} ${unit}`
  }

  if (isLoading) {
    return (
      <div className="card bg-white border-frozenWater-100">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Activity className="h-8 w-8 text-frozenWater-600 animate-pulse mx-auto mb-4" />
            <p className="text-frozenWater-700">Loading cost vs usage data...</p>
          </div>
        </div>
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

  if (data.length === 0) {
    return (
      <div className="card bg-white border-frozenWater-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-frozenWater-600" />
              Cost vs Usage
              <button
                onClick={() => setShowInfoDialog(true)}
                className="ml-2 p-1 rounded-full hover:bg-frozenWater-100 transition-colors group"
                title="Learn more about Cost vs Usage"
              >
                <Info className="h-4 w-4 text-frozenWater-600 group-hover:text-frozenWater-700" />
              </button>
            </h3>
            <p className="text-sm text-frozenWater-600">Cost and usage metrics side-by-side</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 text-frozenWater-300 mx-auto mb-3" />
            <p className="text-frozenWater-600 mb-1">No usage data available for this period</p>
            <p className="text-xs text-frozenWater-500">Usage metrics are collected from cloud provider APIs. Make sure your credentials have the necessary permissions.</p>
          </div>
        </div>

        {/* Info Dialog */}
        {showInfoDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md animate-fade-in" onClick={() => setShowInfoDialog(false)}>
            <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] max-w-lg w-full mx-4 border border-gray-200/50" onClick={(e) => e.stopPropagation()}>
              <div className="p-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <BarChart3 className="h-6 w-6 text-frozenWater-600" />
                    What is Cost vs Usage?
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
                    <strong className="text-frozenWater-700">Cost vs Usage</strong> is a FinOps metric that helps you understand the relationship between what you spend and what you actually use in your cloud infrastructure.
                  </p>
                  
                  <div className="bg-frozenWater-50 rounded-2xl p-5 border border-frozenWater-200/50">
                    <h4 className="font-semibold text-frozenWater-800 mb-2">Key Metrics:</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-frozenWater-600 mt-0.5">•</span>
                        <span><strong>Cost:</strong> Total spending for each service</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-frozenWater-600 mt-0.5">•</span>
                        <span><strong>Usage:</strong> Actual consumption (e.g., GB-hours, requests, compute hours)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-frozenWater-600 mt-0.5">•</span>
                        <span><strong>Unit Cost:</strong> Cost per unit of usage (e.g., $/GB, $/request)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-frozenWater-600 mt-0.5">•</span>
                        <span><strong>Efficiency:</strong> Indicates if you're getting good value for your spend</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="bg-blue-50 rounded-2xl p-5 border border-blue-200/50">
                    <h4 className="font-semibold text-blue-800 mb-2">💡 Why It Matters:</h4>
                    <p className="text-sm text-blue-700">
                      By comparing cost and usage together, you can identify services with high costs but low usage (waste), 
                      or services with high usage but low costs (efficient). This helps optimize your cloud spending and 
                      make data-driven decisions about resource allocation.
                    </p>
                  </div>
                  
                  <p className="text-sm text-gray-600">
                    <strong>Note:</strong> Usage data is collected from cloud provider APIs. If you don't see usage metrics, 
                    the system will show cost data only. Make sure your cloud provider credentials have the necessary permissions 
                    to access usage metrics.
                  </p>
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

  // Sort by cost descending
  const sortedData = [...data].sort((a, b) => b.cost - a.cost)

  return (
    <div className="card bg-white border-frozenWater-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-frozenWater-600" />
            Cost vs Usage
            <button
              onClick={() => setShowInfoDialog(true)}
              className="ml-2 p-1 rounded-full hover:bg-frozenWater-100 transition-colors group"
              title="Learn more about Cost vs Usage"
            >
              <Info className="h-4 w-4 text-frozenWater-600 group-hover:text-frozenWater-700" />
            </button>
          </h3>
          <p className="text-sm text-frozenWater-600">Cost and usage metrics side-by-side per service</p>
        </div>
      </div>

      {/* Info Dialog */}
      {showInfoDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md animate-fade-in" onClick={() => setShowInfoDialog(false)}>
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] max-w-lg w-full mx-4 border border-gray-200/50" onClick={(e) => e.stopPropagation()}>
            <div className="p-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <BarChart3 className="h-6 w-6 text-frozenWater-600" />
                  What is Cost vs Usage?
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
                  <strong className="text-frozenWater-700">Cost vs Usage</strong> is a FinOps metric that helps you understand the relationship between what you spend and what you actually use in your cloud infrastructure.
                </p>
                
                <div className="bg-frozenWater-50 rounded-2xl p-5 border border-frozenWater-200/50">
                  <h4 className="font-semibold text-frozenWater-800 mb-2">Key Metrics:</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-frozenWater-600 mt-0.5">•</span>
                      <span><strong>Cost:</strong> Total spending for each service</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-frozenWater-600 mt-0.5">•</span>
                      <span><strong>Usage:</strong> Actual consumption (e.g., GB-hours, requests, compute hours)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-frozenWater-600 mt-0.5">•</span>
                      <span><strong>Unit Cost:</strong> Cost per unit of usage (e.g., $/GB, $/request)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-frozenWater-600 mt-0.5">•</span>
                      <span><strong>Efficiency:</strong> Indicates if you're getting good value for your spend</span>
                    </li>
                  </ul>
                </div>
                
                <div className="bg-blue-50 rounded-2xl p-5 border border-blue-200/50">
                  <h4 className="font-semibold text-blue-800 mb-2">💡 Why It Matters:</h4>
                  <p className="text-sm text-blue-700">
                    By comparing cost and usage together, you can identify services with high costs but low usage (waste), 
                    or services with high usage but low costs (efficient). This helps optimize your cloud spending and 
                    make data-driven decisions about resource allocation.
                  </p>
                </div>
                
                <p className="text-sm text-gray-600">
                  <strong>Note:</strong> Usage data is collected from cloud provider APIs. If you don't see usage metrics, 
                  the system will show cost data only. Make sure your cloud provider credentials have the necessary permissions 
                  to access usage metrics.
                </p>
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

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-frozenWater-200 bg-frozenWater-50/50">
              <th className="text-left py-4 px-4 text-xs font-semibold text-frozenWater-900 uppercase tracking-wider">
                Service
              </th>
              <th className="text-right py-4 px-4 text-xs font-semibold text-frozenWater-900 uppercase tracking-wider">
                Cost
              </th>
              <th className="text-right py-4 px-4 text-xs font-semibold text-frozenWater-900 uppercase tracking-wider">
                Usage
              </th>
              <th className="text-right py-4 px-4 text-xs font-semibold text-frozenWater-900 uppercase tracking-wider">
                Unit Cost
              </th>
              <th className="text-right py-4 px-4 text-xs font-semibold text-frozenWater-900 uppercase tracking-wider">
                Efficiency
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-frozenWater-100">
            {sortedData.map((item, index) => {
              const unitCost = item.unitCost
              const hasUnitCost = unitCost !== null && unitCost > 0
              
              return (
                <tr key={`${item.serviceName}-${item.usageType || index}`} className="hover:bg-frozenWater-50/50 transition-colors">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-frozenWater-500" />
                      <div>
                        <div className="font-medium text-gray-900">{item.serviceName}</div>
                        {item.usageType && (
                          <div className="text-xs text-frozenWater-600">{item.usageType}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="font-medium text-gray-900">{formatCurrency(item.cost)}</div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="text-gray-900">{formatUsage(item.usage, item.usageUnit)}</div>
                    {item.usageUnit && (
                      <div className="text-xs text-gray-500">{item.usageUnit}</div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {hasUnitCost ? (
                      <div className="font-medium text-gray-900">
                        {formatCurrency(unitCost!)}
                        <span className="text-xs text-gray-500"> / {item.usageUnit}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {hasUnitCost ? (
                      <div className="flex items-center justify-end gap-1">
                        {item.unitCost! > 0.01 ? (
                          <>
                            <TrendingUp className="h-4 w-4 text-yellow-600" />
                            <span className="text-xs text-yellow-700 font-medium">High cost/unit</span>
                          </>
                        ) : (
                          <>
                            <TrendingUp className="h-4 w-4 text-green-600 rotate-180" />
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

      {data.length > 0 && (
        <div className="mt-4 pt-4 border-t border-frozenWater-200">
          <div className="flex items-center justify-between text-sm text-frozenWater-700">
            <span>Showing {data.length} service{data.length !== 1 ? 's' : ''} with usage data</span>
            <span className="text-xs text-frozenWater-600">
              {startDate} to {endDate}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
