import { useState, useEffect } from 'react'
import { useCurrency } from '../contexts/CurrencyContext'
import { insightsAPI } from '../services/api'
import { Activity, TrendingUp, BarChart3 } from 'lucide-react'

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

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const result = await insightsAPI.getCostVsUsage(providerId, startDate, endDate, accountId)
        setData(result.data || [])
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
      <div className="card">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Activity className="h-8 w-8 text-primary-600 animate-pulse mx-auto mb-4" />
            <p className="text-gray-600">Loading cost vs usage data...</p>
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

  if (data.length === 0) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Cost vs Usage</h3>
            <p className="text-sm text-gray-500">Cost and usage metrics side-by-side</p>
          </div>
          <BarChart3 className="h-5 w-5 text-gray-400" />
        </div>
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">No usage data available for this period</p>
        </div>
      </div>
    )
  }

  // Sort by cost descending
  const sortedData = [...data].sort((a, b) => b.cost - a.cost)

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Cost vs Usage</h3>
          <p className="text-sm text-gray-500">Cost and usage metrics side-by-side per service</p>
        </div>
        <BarChart3 className="h-5 w-5 text-gray-400" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Service
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Cost
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Usage
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
            {sortedData.map((item, index) => {
              const unitCost = item.unitCost
              const hasUnitCost = unitCost !== null && unitCost > 0
              
              return (
                <tr key={`${item.serviceName}-${item.usageType || index}`} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">{item.serviceName}</div>
                        {item.usageType && (
                          <div className="text-xs text-gray-500">{item.usageType}</div>
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
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Showing {data.length} service{data.length !== 1 ? 's' : ''} with usage data</span>
            <span className="text-xs text-gray-500">
              {startDate} to {endDate}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
