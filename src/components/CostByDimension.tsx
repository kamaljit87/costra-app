import React, { useState, useEffect } from 'react'
import { useCurrency } from '../contexts/CurrencyContext'
import { insightsAPI } from '../services/api'
import { Tag, Filter, Layers, ChevronDown, X, Info } from 'lucide-react'

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
  const [showInfoDialog, setShowInfoDialog] = useState(false)

  useEffect(() => {
    fetchDimensions()
  }, [providerId, accountId])

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
      const result = await insightsAPI.getAvailableDimensions(providerId, accountId)
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
      <div className="card bg-gradient-to-br from-white to-frozenWater-50/30 border-frozenWater-100">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Filter className="h-8 w-8 text-frozenWater-600 animate-pulse mx-auto mb-4" />
            <p className="text-frozenWater-700">Loading dimensions...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error && !hasDimensions) {
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

  if (!hasDimensions) {
    return (
      <div className="card bg-gradient-to-br from-white to-frozenWater-50/30 border-frozenWater-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Tag className="h-5 w-5 text-frozenWater-600" />
              Cost by Dimension
              <button
                onClick={() => setShowInfoDialog(true)}
                className="ml-2 p-1 rounded-full hover:bg-frozenWater-100 transition-colors group"
                title="Learn more about Cost by Dimension"
              >
                <Info className="h-4 w-4 text-frozenWater-600 group-hover:text-frozenWater-700" />
              </button>
            </h3>
            <p className="text-sm text-frozenWater-600">View costs grouped by tags (team, product, environment)</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12 bg-frozenWater-50 rounded-xl border border-frozenWater-200">
          <div className="text-center">
            <Tag className="h-10 w-10 text-frozenWater-600 mx-auto mb-3" />
            <p className="text-frozenWater-900 font-medium mb-1">No dimension tags found</p>
            <p className="text-frozenWater-700 text-sm">
              Tag your resources with dimensions (team, product, environment) to enable cost allocation.
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
                    <Tag className="h-6 w-6 text-frozenWater-600" />
                    What is Cost by Dimension?
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
                    <strong className="text-frozenWater-700">Cost by Dimension</strong> allows you to view and analyze your cloud costs 
                    grouped by tags or dimensions (like team, product, environment, etc.). This is essential for cost allocation 
                    and understanding who or what is responsible for your cloud spending.
                  </p>
                  
                  <div className="bg-frozenWater-50 rounded-lg p-4 border border-frozenWater-200">
                    <h4 className="font-semibold text-frozenWater-800 mb-2">How It Works:</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-frozenWater-600 mt-0.5">•</span>
                        <span>Select a <strong>dimension</strong> (tag key) like "Team", "Product", or "Environment"</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-frozenWater-600 mt-0.5">•</span>
                        <span>View costs grouped by <strong>dimension values</strong> (tag values) like "Engineering", "Production", etc.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-frozenWater-600 mt-0.5">•</span>
                        <span>See total cost, percentage of total, and resource counts for each value</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-frozenWater-600 mt-0.5">•</span>
                        <span>Expand rows to see service-level breakdowns within each dimension value</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <h4 className="font-semibold text-blue-800 mb-2">💡 Use Cases:</h4>
                    <ul className="space-y-1 text-sm text-blue-700">
                      <li>• <strong>Cost Allocation:</strong> See which team or product is spending the most</li>
                      <li>• <strong>Budget Management:</strong> Track spending by environment (prod, staging, dev)</li>
                      <li>• <strong>Chargeback:</strong> Allocate costs to different departments or projects</li>
                      <li>• <strong>Optimization:</strong> Identify high-cost areas by dimension for targeted optimization</li>
                    </ul>
                  </div>
                  
                  <p className="text-sm text-gray-600">
                    <strong>Note:</strong> This feature requires your cloud resources to be tagged. If you don't see any dimensions, 
                    make sure your resources have tags applied. Common dimension keys include: Team, Product, Environment, Project, Owner.
                  </p>
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

  const totalCost = data.reduce((sum, item) => sum + item.totalCost, 0)

  return (
    <div className="card bg-gradient-to-br from-white to-frozenWater-50/30 border-frozenWater-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Tag className="h-5 w-5 text-frozenWater-600" />
            Cost by Dimension
            <button
              onClick={() => setShowInfoDialog(true)}
              className="ml-2 p-1 rounded-full hover:bg-frozenWater-100 transition-colors group"
              title="Learn more about Cost by Dimension"
            >
              <Info className="h-4 w-4 text-frozenWater-600 group-hover:text-frozenWater-700" />
            </button>
          </h3>
          <p className="text-sm text-frozenWater-600">View costs grouped by tags (team, product, environment)</p>
        </div>
      </div>

      {/* Info Dialog */}
      {showInfoDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowInfoDialog(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 border-2 border-frozenWater-200" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Tag className="h-6 w-6 text-frozenWater-600" />
                  What is Cost by Dimension?
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
                  <strong className="text-frozenWater-700">Cost by Dimension</strong> allows you to view and analyze your cloud costs 
                  grouped by tags or dimensions (like team, product, environment, etc.). This is essential for cost allocation 
                  and understanding who or what is responsible for your cloud spending.
                </p>
                
                <div className="bg-frozenWater-50 rounded-lg p-4 border border-frozenWater-200">
                  <h4 className="font-semibold text-frozenWater-800 mb-2">How It Works:</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-frozenWater-600 mt-0.5">•</span>
                      <span>Select a <strong>dimension</strong> (tag key) like "Team", "Product", or "Environment"</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-frozenWater-600 mt-0.5">•</span>
                      <span>View costs grouped by <strong>dimension values</strong> (tag values) like "Engineering", "Production", etc.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-frozenWater-600 mt-0.5">•</span>
                      <span>See total cost, percentage of total, and resource counts for each value</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-frozenWater-600 mt-0.5">•</span>
                      <span>Expand rows to see service-level breakdowns within each dimension value</span>
                    </li>
                  </ul>
                </div>
                
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h4 className="font-semibold text-blue-800 mb-2">💡 Use Cases:</h4>
                  <ul className="space-y-1 text-sm text-blue-700">
                    <li>• <strong>Cost Allocation:</strong> See which team or product is spending the most</li>
                    <li>• <strong>Budget Management:</strong> Track spending by environment (prod, staging, dev)</li>
                    <li>• <strong>Chargeback:</strong> Allocate costs to different departments or projects</li>
                    <li>• <strong>Optimization:</strong> Identify high-cost areas by dimension for targeted optimization</li>
                  </ul>
                </div>
                
                <p className="text-sm text-gray-600">
                  <strong>Note:</strong> This feature requires your cloud resources to be tagged. If you don't see any dimensions, 
                  make sure your resources have tags applied. Common dimension keys include: Team, Product, Environment, Project, Owner.
                </p>
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

      {/* Dimension Filter */}
      <div className="mb-6 p-4 bg-frozenWater-50 rounded-xl border border-frozenWater-200">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-frozenWater-800 flex items-center gap-2">
            <Filter className="h-4 w-4 text-frozenWater-600" />
            Dimension:
          </label>
          <select
            value={selectedDimension}
            onChange={(e) => {
              setSelectedDimension(e.target.value)
              setSelectedValue(null)
              setExpandedRows(new Set())
            }}
            className="px-3 py-2 rounded-lg border border-frozenWater-200 text-sm focus:outline-none focus:ring-2 focus:ring-frozenWater-500 focus:border-transparent bg-white text-gray-900"
          >
            <option value="">Select dimension...</option>
            {dimensionKeys.map(key => (
              <option key={key} value={key}>{key}</option>
            ))}
          </select>

          {selectedDimension && dimensions[selectedDimension] && (
            <>
              <span className="text-frozenWater-400">→</span>
              <label className="text-sm font-medium text-frozenWater-800">Value:</label>
              <select
                value={selectedValue || ''}
                onChange={(e) => {
                  setSelectedValue(e.target.value || null)
                  setExpandedRows(new Set())
                }}
                className="px-3 py-2 rounded-lg border border-frozenWater-200 text-sm focus:outline-none focus:ring-2 focus:ring-frozenWater-500 focus:border-transparent bg-white text-gray-900"
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
                  className="ml-2 p-1.5 text-frozenWater-400 hover:text-frozenWater-600 rounded hover:bg-frozenWater-100 transition-colors"
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-frozenWater-600"></div>
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
              <tr className="border-b-2 border-frozenWater-200 bg-frozenWater-50/50">
                <th className="text-left py-4 px-4 text-xs font-semibold text-frozenWater-900 uppercase tracking-wider w-8"></th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-frozenWater-900 uppercase tracking-wider">
                  {selectedDimension}
                </th>
                <th className="text-right py-4 px-4 text-xs font-semibold text-frozenWater-900 uppercase tracking-wider">
                  Cost
                </th>
                <th className="text-right py-4 px-4 text-xs font-semibold text-frozenWater-900 uppercase tracking-wider">
                  % of Total
                </th>
                <th className="text-right py-4 px-4 text-xs font-semibold text-frozenWater-900 uppercase tracking-wider">
                  Resources
                </th>
                <th className="text-right py-4 px-4 text-xs font-semibold text-frozenWater-900 uppercase tracking-wider">
                  Services
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-frozenWater-100">
              {data.map((item) => {
                const percentage = totalCost > 0 ? (item.totalCost / totalCost) * 100 : 0
                const isExpanded = expandedRows.has(item.dimensionValue)
                
                return (
                  <React.Fragment key={item.dimensionValue}>
                    <tr 
                      className="hover:bg-frozenWater-50/50 transition-colors cursor-pointer"
                      onClick={() => toggleRowExpansion(item.dimensionValue)}
                    >
                      <td className="py-4 px-2 text-center">
                        <ChevronDown 
                          className={`h-4 w-4 text-frozenWater-600 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-frozenWater-500" />
                          <span className="font-medium text-gray-900">{item.dimensionValue}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="font-semibold text-gray-900">{formatCurrency(item.totalCost)}</div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="text-frozenWater-700 font-medium">{percentage.toFixed(1)}%</div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="text-frozenWater-700">{item.resourceCount}</div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="text-frozenWater-700">{item.serviceCount}</div>
                      </td>
                    </tr>

                    {/* Expanded Service Breakdown */}
                    {isExpanded && item.services.length > 0 && (
                      <tr>
                        <td colSpan={6} className="bg-gradient-to-b from-frozenWater-50/70 to-frozenWater-50/30 p-0">
                          <div className="px-8 py-6">
                            <h4 className="text-sm font-semibold text-frozenWater-800 flex items-center gap-2 mb-4">
                              <Layers className="h-4 w-4 text-frozenWater-600" />
                              Service Breakdown
                            </h4>
                            <div className="space-y-2">
                              {item.services.map((service) => {
                                const servicePercentage = item.totalCost > 0 ? (service.cost / item.totalCost) * 100 : 0
                                return (
                                  <div
                                    key={service.serviceName}
                                    className="flex items-center justify-between p-3 bg-white rounded-lg border border-frozenWater-200 shadow-sm hover:shadow-md transition-shadow"
                                  >
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-900">{service.serviceName}</div>
                                      <div className="text-xs text-frozenWater-600 mt-0.5">
                                        {service.resourceCount} resource{service.resourceCount !== 1 ? 's' : ''}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <div className="w-24">
                                        <div className="h-1.5 bg-frozenWater-100 rounded-full overflow-hidden">
                                          <div 
                                            className="h-full rounded-full transition-all duration-500 bg-frozenWater-500"
                                            style={{ width: `${servicePercentage}%` }}
                                          ></div>
                                        </div>
                                      </div>
                                      <div className="text-xs text-frozenWater-700 w-12 text-right font-medium">
                                        {servicePercentage.toFixed(1)}%
                                      </div>
                                      <div className="text-sm font-semibold text-gray-900 w-24 text-right">
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
          <p className="text-frozenWater-600">No cost data found for this dimension</p>
        </div>
      )}

      {/* Summary */}
      {!isLoadingData && data.length > 0 && (
        <div className="mt-4 pt-4 border-t border-frozenWater-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-frozenWater-700">
              Showing {data.length} dimension value{data.length !== 1 ? 's' : ''}
            </span>
            <span className="font-semibold text-gray-900">
              Total: {formatCurrency(totalCost)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
