import { useState, useEffect } from 'react'
import { useCurrency } from '../contexts/CurrencyContext'
import { insightsAPI } from '../services/api'
import { AlertTriangle, Tag, Calendar, MapPin, DollarSign, Activity, Info, X } from 'lucide-react'

interface UntaggedResource {
  id: number
  resourceId: string
  resourceName: string | null
  resourceType: string
  serviceName: string
  region: string | null
  cost: number
  providerId: string
  firstSeenDate: string | null
  lastSeenDate: string | null
  ageDays: number | null
}

interface UntaggedResourcesProps {
  providerId?: string
  limit?: number
  accountId?: number
}

export default function UntaggedResources({ providerId, limit = 50, accountId }: UntaggedResourcesProps) {
  const { formatCurrency } = useCurrency()
  const [resources, setResources] = useState<UntaggedResource[]>([])
  const [totalCost, setTotalCost] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInfoDialog, setShowInfoDialog] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const result = await insightsAPI.getUntaggedResources(providerId, limit, accountId)
        // Handle both array and object responses
        if (Array.isArray(result)) {
          const total = result.reduce((sum, r) => sum + (r.cost || 0), 0)
          setResources(result)
          setTotalCost(total)
        } else {
          setResources(result.resources || [])
          setTotalCost(result.totalCost || 0)
        }
      } catch (err: any) {
        console.error('Failed to fetch untagged resources:', err)
        setError(err.message || 'Failed to load untagged resources')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [providerId, limit, accountId])

  const formatAge = (days: number | null) => {
    if (!days && days !== 0) return 'Unknown'
    if (days < 30) return `${days} day${days !== 1 ? 's' : ''}`
    if (days < 365) {
      const months = Math.floor(days / 30)
      return `${months} month${months !== 1 ? 's' : ''}`
    }
    const years = Math.floor(days / 365)
    const remainingMonths = Math.floor((days % 365) / 30)
    if (remainingMonths > 0) {
      return `${years} year${years !== 1 ? 's' : ''}, ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`
    }
    return `${years} year${years !== 1 ? 's' : ''}`
  }

  if (isLoading) {
    return (
      <div className="card bg-white border-frozenWater-100">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Activity className="h-8 w-8 text-frozenWater-600 animate-pulse mx-auto mb-4" />
            <p className="text-frozenWater-700">Loading untagged resources...</p>
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

  if (resources.length === 0) {
    return (
      <div className="card bg-white border-frozenWater-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Tag className="h-5 w-5 text-frozenWater-600" />
              Untagged Resources
              <button
                onClick={() => setShowInfoDialog(true)}
                className="ml-2 p-1 rounded-full hover:bg-frozenWater-100 transition-colors group"
                title="Learn more about Untagged Resources"
              >
                <Info className="h-4 w-4 text-frozenWater-600 group-hover:text-frozenWater-700" />
              </button>
            </h3>
            <p className="text-sm text-frozenWater-600">Resources without tags or ownership metadata</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12 bg-green-50 rounded-xl border border-green-200">
          <div className="text-center">
            <Tag className="h-10 w-10 text-green-600 mx-auto mb-3" />
            <p className="text-green-900 font-medium mb-1">All resources are tagged!</p>
            <p className="text-green-700 text-sm">Great job maintaining resource ownership</p>
          </div>
        </div>

        {/* Info Dialog */}
        {showInfoDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md animate-fade-in" onClick={() => setShowInfoDialog(false)}>
            <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] max-w-lg w-full mx-4 border border-gray-200/50" onClick={(e) => e.stopPropagation()}>
              <div className="p-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Tag className="h-6 w-6 text-frozenWater-600" />
                    What are Untagged Resources?
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
                    <strong className="text-frozenWater-700">Untagged Resources</strong> are cloud resources that don't have any tags or ownership metadata attached to them. This is a critical FinOps concern because it makes cost allocation and accountability difficult.
                  </p>
                  
                  <div className="bg-frozenWater-50 rounded-2xl p-5 border border-frozenWater-200/50">
                    <h4 className="font-semibold text-frozenWater-800 mb-2">Why Tagging Matters:</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-frozenWater-600 mt-0.5">•</span>
                        <span><strong>Cost Allocation:</strong> Tags help you understand which team, project, or product is responsible for each resource's cost</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-frozenWater-600 mt-0.5">•</span>
                        <span><strong>Accountability:</strong> When costs spike, tags help identify who to contact</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-frozenWater-600 mt-0.5">•</span>
                        <span><strong>Optimization:</strong> Tagged resources enable better cost optimization and budget management</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-frozenWater-600 mt-0.5">•</span>
                        <span><strong>Compliance:</strong> Many organizations require resource tagging for governance and compliance</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="bg-yellow-50 rounded-2xl p-5 border border-yellow-200/50">
                    <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Best Practices:</h4>
                    <p className="text-sm text-yellow-700">
                      Tag all resources with at least: <strong>Team</strong>, <strong>Product/Project</strong>, and <strong>Environment</strong> (e.g., production, staging, dev). 
                      This enables proper cost allocation and helps teams understand their cloud spending.
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

  return (
    <div className="card bg-white border-frozenWater-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Tag className="h-5 w-5 text-frozenWater-600" />
            Untagged Resources
            <button
              onClick={() => setShowInfoDialog(true)}
              className="ml-2 p-1 rounded-full hover:bg-frozenWater-100 transition-colors group"
              title="Learn more about Untagged Resources"
            >
              <Info className="h-4 w-4 text-frozenWater-600 group-hover:text-frozenWater-700" />
            </button>
          </h3>
          <p className="text-sm text-frozenWater-600">Resources without tags or ownership metadata</p>
        </div>
        <AlertTriangle className="h-5 w-5 text-yellow-600" />
      </div>

      {/* Info Dialog */}
      {showInfoDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md animate-fade-in" onClick={() => setShowInfoDialog(false)}>
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] max-w-lg w-full mx-4 border border-gray-200/50" onClick={(e) => e.stopPropagation()}>
            <div className="p-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Tag className="h-6 w-6 text-frozenWater-600" />
                  What are Untagged Resources?
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
                  <strong className="text-frozenWater-700">Untagged Resources</strong> are cloud resources that don't have any tags or ownership metadata attached to them. This is a critical FinOps concern because it makes cost allocation and accountability difficult.
                </p>
                
                <div className="bg-frozenWater-50 rounded-2xl p-5 border border-frozenWater-200/50">
                  <h4 className="font-semibold text-frozenWater-800 mb-2">Why Tagging Matters:</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-frozenWater-600 mt-0.5">•</span>
                      <span><strong>Cost Allocation:</strong> Tags help you understand which team, project, or product is responsible for each resource's cost</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-frozenWater-600 mt-0.5">•</span>
                      <span><strong>Accountability:</strong> When costs spike, tags help identify who to contact</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-frozenWater-600 mt-0.5">•</span>
                      <span><strong>Optimization:</strong> Tagged resources enable better cost optimization and budget management</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-frozenWater-600 mt-0.5">•</span>
                      <span><strong>Compliance:</strong> Many organizations require resource tagging for governance and compliance</span>
                    </li>
                  </ul>
                </div>
                
                <div className="bg-yellow-50 rounded-2xl p-5 border border-yellow-200/50">
                  <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Best Practices:</h4>
                  <p className="text-sm text-yellow-700">
                    Tag all resources with at least: <strong>Team</strong>, <strong>Product/Project</strong>, and <strong>Environment</strong> (e.g., production, staging, dev). 
                    This enables proper cost allocation and helps teams understand their cloud spending.
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

      {/* Summary Card */}
      <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <span className="text-yellow-900 font-semibold">Unknown Owner = Risk</span>
            </div>
            <p className="text-yellow-800 text-sm">
              Found <strong>{resources.length}</strong> untagged resource{resources.length !== 1 ? 's' : ''} 
              {' '}costing <strong>{formatCurrency(totalCost)}</strong> total
            </p>
          </div>
        </div>
      </div>

      {/* Resources Table */}
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="inline-block min-w-full align-middle sm:rounded-lg">
          <div className="overflow-hidden sm:rounded-lg border border-gray-200">
            <table className="w-full divide-y divide-gray-200">
          <thead>
            <tr className="border-b-2 border-frozenWater-200 bg-frozenWater-50/50">
              <th className="text-left py-4 px-4 text-xs font-semibold text-frozenWater-900 uppercase tracking-wider">
                Resource
              </th>
              <th className="text-left py-4 px-4 text-xs font-semibold text-frozenWater-900 uppercase tracking-wider">
                Service
              </th>
              <th className="text-left py-4 px-4 text-xs font-semibold text-frozenWater-900 uppercase tracking-wider">
                Region
              </th>
              <th className="text-right py-4 px-4 text-xs font-semibold text-frozenWater-900 uppercase tracking-wider">
                Cost
              </th>
              <th className="text-right py-4 px-4 text-xs font-semibold text-frozenWater-900 uppercase tracking-wider">
                Age
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-frozenWater-100">
            {resources.map((resource) => (
              <tr 
                key={resource.id} 
                className="hover:bg-frozenWater-50/50 transition-colors"
                title={`${resource.resourceType} - No tags found`}
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                    <div>
                      <div className="font-medium text-gray-900">
                        {resource.resourceName || resource.resourceId}
                      </div>
                      {resource.resourceName && (
                        <div className="text-xs text-gray-500 font-mono">{resource.resourceId}</div>
                      )}
                      <div className="text-xs text-gray-400 mt-0.5">{resource.resourceType}</div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="text-gray-900">{resource.serviceName}</div>
                </td>
                <td className="py-3 px-4">
                  {resource.region ? (
                    <div className="flex items-center gap-1 text-gray-600">
                      <MapPin className="h-3 w-3" />
                      <span className="text-sm">{resource.region}</span>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm">—</span>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="font-medium text-gray-900">{formatCurrency(resource.cost)}</div>
                </td>
                <td className="py-3 px-4 text-right">
                  {resource.ageDays !== null ? (
                    <div className="flex items-center justify-end gap-1 text-gray-600">
                      <Calendar className="h-3 w-3" />
                      <span className="text-sm">{formatAge(resource.ageDays)}</span>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
            </table>
          </div>
        </div>
      </div>

      {resources.length > 0 && (
        <div className="mt-4 pt-4 border-t border-frozenWater-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-frozenWater-700">
              Showing {resources.length} untagged resource{resources.length !== 1 ? 's' : ''}
            </span>
            <span className="text-yellow-700 font-medium">
              Total Impact: {formatCurrency(totalCost)}
            </span>
          </div>
          <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs text-yellow-800">
              <strong>Action Required:</strong> Tag these resources with ownership metadata 
              (team, product, environment) to enable cost allocation and accountability.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
