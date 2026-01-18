import React, { useState, useEffect } from 'react'
import { useCurrency } from '../contexts/CurrencyContext'
import { insightsAPI } from '../services/api'
import { Tag, Filter, Layers, ChevronDown, X } from 'lucide-react'

interface DimensionValue {
  value: string
  resourceCount: number
}

interface DimensionData {
  dimensionValue: string
  totalCost: number
  resourceCount: number
  serviceCount: number
  regionCount: number
  services: Array<{
    serviceName: string
    cost: number
    resourceCount: number
  }>
}

interface CostByDimensionProps {
  providerId?: string
  accountId?: number
}

export default function CostByDimension({ providerId, accountId }: CostByDimensionProps) {
  const { formatCurrency } = useCurrency()
  const [dimensions, setDimensions] = useState<Record<string, DimensionValue[]>>({})
  const [selectedDimension, setSelectedDimension] = useState<string>('')
  const [selectedValue, setSelectedValue] = useState<string | null>(null)
  const [data, setData] = useState<DimensionData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchDimensions()
  }, [providerId])

  useEffect(() => {
    if (selectedDimension) {
      fetchCostByDimension()
    } else {
      setData([])
      setSelectedValue(null)
    }
  }, [selectedDimension, selectedValue, providerId, accountId])

  const fetchDimensions = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await insightsAPI.getAvailableDimensions(providerId)
      setDimensions(result.dimensions || {})
      
      // Auto-select first dimension if available
      const dimensionKeys = Object.keys(result.dimensions || {})
      if (dimensionKeys.length > 0 && !selectedDimension) {
        setSelectedDimension(dimensionKeys[0])
      }
    } catch (err: any) {
      console.error('Failed to fetch dimensions:', err)
      setError(err.message || 'Failed to load dimensions')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCostByDimension = async () => {
    if (!selectedDimension) return
    
    setIsLoadingData(true)
    setError(null)
    try {
      const result = await insightsAPI.getCostByDimension(
        selectedDimension,
        selectedValue || undefined,
        providerId,
        accountId
      )
      setData(result.data || [])
    } catch (err: any) {
      console.error('Failed to fetch cost by dimension:', err)
      setError(err.message || 'Failed to load cost data')
    } finally {
      setIsLoadingData(false)
    }
  }

  const toggleRowExpansion = (dimensionValue: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(dimensionValue)) {
      newExpanded.delete(dimensionValue)
    } else {
      newExpanded.add(dimensionValue)
    }
    setExpandedRows(newExpanded)
  }

  const dimensionKeys = Object.keys(dimensions)
  const hasDimensions = dimensionKeys.length > 0

  if (isLoading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Filter className="h-8 w-8 text-primary-600 animate-pulse mx-auto mb-4" />
            <p className="text-gray-600">Loading dimensions...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error && !hasDimensions) {
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

  if (!hasDimensions) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Cost by Dimension</h3>
            <p className="text-sm text-gray-500">View costs grouped by tags (team, product, environment)</p>
          </div>
          <Tag className="h-5 w-5 text-gray-400" />
        </div>
        <div className="flex items-center justify-center py-12 bg-blue-50 rounded-xl border border-blue-200">
          <div className="text-center">
            <Tag className="h-10 w-10 text-blue-600 mx-auto mb-3" />
            <p className="text-blue-900 font-medium mb-1">No dimension tags found</p>
            <p className="text-blue-700 text-sm">
              Tag your resources with dimensions (team, product, environment) to enable cost allocation.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const totalCost = data.reduce((sum, item) => sum + item.totalCost, 0)

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Cost by Dimension</h3>
          <p className="text-sm text-gray-500">View costs grouped by tags (team, product, environment)</p>
        </div>
        <Tag className="h-5 w-5 text-gray-400" />
      </div>

      {/* Dimension Filter */}
      <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Dimension:
          </label>
          <select
            value={selectedDimension}
            onChange={(e) => {
              setSelectedDimension(e.target.value)
              setSelectedValue(null)
              setExpandedRows(new Set())
            }}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
          >
            <option value="">Select dimension...</option>
            {dimensionKeys.map(key => (
              <option key={key} value={key}>{key}</option>
            ))}
          </select>

          {selectedDimension && dimensions[selectedDimension] && (
            <>
              <span className="text-gray-400">→</span>
              <label className="text-sm font-medium text-gray-700">Value:</label>
              <select
                value={selectedValue || ''}
                onChange={(e) => {
                  setSelectedValue(e.target.value || null)
                  setExpandedRows(new Set())
                }}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
              >
                <option value="">All values</option>
                {dimensions[selectedDimension].map(item => (
                  <option key={item.value} value={item.value}>
                    {item.value} ({item.resourceCount} resources)
                  </option>
                ))}
              </select>

              {selectedValue && (
                <button
                  onClick={() => {
                    setSelectedValue(null)
                    setExpandedRows(new Set())
                  }}
                  className="ml-2 p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 transition-colors"
                  title="Clear value filter"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isLoadingData && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      )}

      {/* Error State */}
      {error && hasDimensions && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Data Table */}
      {!isLoadingData && data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-8"></th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {selectedDimension}
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Cost
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  % of Total
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Resources
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Services
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((item) => {
                const percentage = totalCost > 0 ? (item.totalCost / totalCost) * 100 : 0
                const isExpanded = expandedRows.has(item.dimensionValue)
                
                return (
                  <React.Fragment key={item.dimensionValue}>
                    <tr 
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => toggleRowExpansion(item.dimensionValue)}
                    >
                      <td className="py-3 px-2 text-center">
                        <ChevronDown 
                          className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-gray-400" />
                          <span className="font-medium text-gray-900">{item.dimensionValue}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="font-medium text-gray-900">{formatCurrency(item.totalCost)}</div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="text-gray-600">{percentage.toFixed(1)}%</div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="text-gray-600">{item.resourceCount}</div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="text-gray-600">{item.serviceCount}</div>
                      </td>
                    </tr>

                    {/* Expanded Service Breakdown */}
                    {isExpanded && item.services.length > 0 && (
                      <tr>
                        <td colSpan={6} className="bg-gray-50 p-0">
                          <div className="px-8 py-4">
                            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
                              <Layers className="h-4 w-4" />
                              Service Breakdown
                            </h4>
                            <div className="space-y-2">
                              {item.services.map((service) => {
                                const servicePercentage = item.totalCost > 0 ? (service.cost / item.totalCost) * 100 : 0
                                return (
                                  <div
                                    key={service.serviceName}
                                    className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
                                  >
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-900">{service.serviceName}</div>
                                      <div className="text-xs text-gray-500 mt-0.5">
                                        {service.resourceCount} resource{service.resourceCount !== 1 ? 's' : ''}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <div className="w-24">
                                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                          <div 
                                            className="h-full rounded-full transition-all duration-500 bg-primary-500"
                                            style={{ width: `${servicePercentage}%` }}
                                          ></div>
                                        </div>
                                      </div>
                                      <div className="text-xs text-gray-500 w-12 text-right">
                                        {servicePercentage.toFixed(1)}%
                                      </div>
                                      <div className="text-sm font-medium text-gray-900 w-24 text-right">
                                        {formatCurrency(service.cost)}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isLoadingData && data.length === 0 && selectedDimension && (
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">No cost data found for this dimension</p>
        </div>
      )}

      {/* Summary */}
      {!isLoadingData && data.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              Showing {data.length} dimension value{data.length !== 1 ? 's' : ''}
            </span>
            <span className="font-medium text-gray-900">
              Total: {formatCurrency(totalCost)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
