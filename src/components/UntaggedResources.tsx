import { useState, useEffect } from 'react'
import { useCurrency } from '../contexts/CurrencyContext'
import { insightsAPI } from '../services/api'
import { AlertTriangle, Tag, Calendar, MapPin, DollarSign, Activity } from 'lucide-react'

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
}

export default function UntaggedResources({ providerId, limit = 50 }: UntaggedResourcesProps) {
  const { formatCurrency } = useCurrency()
  const [resources, setResources] = useState<UntaggedResource[]>([])
  const [totalCost, setTotalCost] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const result = await insightsAPI.getUntaggedResources(providerId, limit)
        setResources(result.resources || [])
        setTotalCost(result.totalCost || 0)
      } catch (err: any) {
        console.error('Failed to fetch untagged resources:', err)
        setError(err.message || 'Failed to load untagged resources')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [providerId, limit])

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
      <div className="card">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Activity className="h-8 w-8 text-primary-600 animate-pulse mx-auto mb-4" />
            <p className="text-gray-600">Loading untagged resources...</p>
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

  if (resources.length === 0) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Untagged Resources</h3>
            <p className="text-sm text-gray-500">Resources without tags or ownership metadata</p>
          </div>
          <Tag className="h-5 w-5 text-gray-400" />
        </div>
        <div className="flex items-center justify-center py-12 bg-green-50 rounded-xl border border-green-200">
          <div className="text-center">
            <Tag className="h-10 w-10 text-green-600 mx-auto mb-3" />
            <p className="text-green-900 font-medium mb-1">All resources are tagged!</p>
            <p className="text-green-700 text-sm">Great job maintaining resource ownership</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Untagged Resources</h3>
          <p className="text-sm text-gray-500">Resources without tags or ownership metadata</p>
        </div>
        <AlertTriangle className="h-5 w-5 text-yellow-600" />
      </div>

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
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Resource
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Service
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Region
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Cost
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Age
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {resources.map((resource) => (
              <tr 
                key={resource.id} 
                className="hover:bg-gray-50 transition-colors"
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

      {resources.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
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
