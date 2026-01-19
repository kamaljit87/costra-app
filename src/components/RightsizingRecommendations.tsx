import { useState, useEffect } from 'react'
import { useCurrency } from '../contexts/CurrencyContext'
import { insightsAPI } from '../services/api'
import { AlertTriangle, TrendingDown, Zap, Info, X, CheckCircle } from 'lucide-react'

interface Utilization {
  estimated: number
  usageQuantity: number
  usageUnit: string
}

interface RightsizingRecommendation {
  resourceId: string
  resourceName: string
  serviceName: string
  resourceType: string
  region: string | null
  currentCost: number
  utilization: Utilization
  recommendation: 'downsize' | 'upsize'
  potentialSavings: number
  savingsPercent: number
  priority: 'high' | 'medium' | 'low'
  reason: string
}

interface RightsizingRecommendationsProps {
  providerId?: string
  accountId?: number
}

export default function RightsizingRecommendations({ providerId, accountId }: RightsizingRecommendationsProps) {
  const { formatCurrency } = useCurrency()
  const [data, setData] = useState<{
    recommendations: RightsizingRecommendation[]
    totalPotentialSavings: number
    recommendationCount: number
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInfoDialog, setShowInfoDialog] = useState(false)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchRecommendations()
  }, [providerId, accountId])

  const fetchRecommendations = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await insightsAPI.getRightsizingRecommendations(providerId, accountId)
      setData(result.data || null)
    } catch (err: any) {
      console.error('Failed to fetch rightsizing recommendations:', err)
      setError(err.message || 'Failed to load rightsizing recommendations')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDismiss = (resourceId: string) => {
    setDismissedIds(prev => new Set([...prev, resourceId]))
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      default:
        return 'text-blue-600 bg-blue-50 border-blue-200'
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return AlertTriangle
      case 'medium':
        return TrendingDown
      default:
        return Zap
    }
  }

  const filteredRecommendations = data?.recommendations.filter(
    rec => !dismissedIds.has(rec.resourceId)
  ) || []

  if (isLoading) {
    return (
      <div className="card bg-gradient-to-br from-white to-frozenWater-50/30 border-frozenWater-100">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Zap className="h-8 w-8 text-frozenWater-600 animate-pulse mx-auto mb-4" />
            <p className="text-frozenWater-700">Analyzing resources for optimization opportunities...</p>
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

  if (!data || filteredRecommendations.length === 0) {
    return (
      <div className="card bg-gradient-to-br from-white to-frozenWater-50/30 border-frozenWater-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Zap className="h-5 w-5 text-frozenWater-600" />
              Rightsizing Recommendations
              <button
                onClick={() => setShowInfoDialog(true)}
                className="ml-2 p-1 rounded-full hover:bg-frozenWater-100 transition-colors group"
                title="Learn more about Rightsizing"
              >
                <Info className="h-4 w-4 text-frozenWater-600 group-hover:text-frozenWater-700" />
              </button>
            </h3>
            <p className="text-sm text-frozenWater-600">Optimize resource sizing based on utilization</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12 bg-frozenWater-50 rounded-xl border border-frozenWater-200">
          <div className="text-center">
            <CheckCircle className="h-10 w-10 text-green-600 mx-auto mb-3" />
            <p className="text-frozenWater-900 font-medium mb-1">No optimization opportunities found</p>
            <p className="text-frozenWater-700 text-sm">
              All resources appear to be appropriately sized based on current utilization.
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
                    <Zap className="h-6 w-6 text-frozenWater-600" />
                    What are Rightsizing Recommendations?
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
                    <strong className="text-frozenWater-700">Rightsizing Recommendations</strong> analyze your 
                    resource utilization and suggest size adjustments to optimize costs while maintaining performance.
                  </p>
                  
                  <div className="bg-frozenWater-50 rounded-lg p-4 border border-frozenWater-200">
                    <h4 className="font-semibold text-frozenWater-800 mb-2">How It Works:</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-frozenWater-600 mt-0.5">•</span>
                        <span><strong>Downsizing:</strong> If utilization is consistently low (&lt;20%), consider smaller instance types to reduce costs</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-frozenWater-600 mt-0.5">•</span>
                        <span><strong>Upsizing:</strong> If utilization is consistently high (&gt;80%), consider larger instances to avoid performance issues</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-frozenWater-600 mt-0.5">•</span>
                        <span>Recommendations are prioritized by potential savings and impact</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <h4 className="font-semibold text-blue-800 mb-2">💡 Best Practices:</h4>
                    <ul className="space-y-1 text-sm text-blue-700">
                      <li>• Review recommendations carefully before applying changes</li>
                      <li>• Test in non-production environments first</li>
                      <li>• Monitor performance after rightsizing</li>
                      <li>• Consider peak usage patterns, not just average utilization</li>
                    </ul>
                  </div>
                  
                  <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                    <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Important:</h4>
                    <p className="text-sm text-yellow-700">
                      These recommendations are based on estimated utilization. Always verify actual resource 
                      metrics and test changes in a safe environment before applying to production.
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

  return (
    <div className="card bg-gradient-to-br from-white to-frozenWater-50/30 border-frozenWater-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Zap className="h-5 w-5 text-frozenWater-600" />
            Rightsizing Recommendations
            <button
              onClick={() => setShowInfoDialog(true)}
              className="ml-2 p-1 rounded-full hover:bg-frozenWater-100 transition-colors group"
              title="Learn more about Rightsizing"
            >
              <Info className="h-4 w-4 text-frozenWater-600 group-hover:text-frozenWater-700" />
            </button>
          </h3>
          <p className="text-sm text-frozenWater-600">
            {filteredRecommendations.length} recommendation{filteredRecommendations.length !== 1 ? 's' : ''} • 
            Potential savings: {formatCurrency(data.totalPotentialSavings)}/month
          </p>
        </div>
      </div>

      {/* Recommendations List */}
      <div className="space-y-4">
        {filteredRecommendations.map((rec) => {
          const PriorityIcon = getPriorityIcon(rec.priority)
          const priorityColor = getPriorityColor(rec.priority)
          
          return (
            <div
              key={rec.resourceId}
              className={`p-4 rounded-xl border-2 ${priorityColor} hover:shadow-md transition-all`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <PriorityIcon className="h-5 w-5" />
                    <div>
                      <div className="font-semibold text-gray-900">{rec.resourceName || rec.resourceId}</div>
                      <div className="text-xs text-gray-600">
                        {rec.serviceName} • {rec.resourceType}
                        {rec.region && ` • ${rec.region}`}
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-700 mb-3">{rec.reason}</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Current Cost</div>
                      <div className="font-medium text-gray-900">{formatCurrency(rec.currentCost)}/mo</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Utilization</div>
                      <div className="font-medium text-gray-900">
                        {rec.utilization.estimated.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Potential Savings</div>
                      <div className="font-medium text-green-600">
                        {formatCurrency(rec.potentialSavings)}/mo
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Savings %</div>
                      <div className="font-medium text-green-600">
                        {rec.savingsPercent.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => handleDismiss(rec.resourceId)}
                  className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-white/50 rounded-lg transition-colors"
                  title="Dismiss recommendation"
                >
                  Dismiss
                </button>
              </div>
              
              <div className="mt-3 pt-3 border-t border-frozenWater-200">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="capitalize font-medium">{rec.priority}</span>
                  <span>priority</span>
                  <span>•</span>
                  <span>Recommendation: {rec.recommendation === 'downsize' ? 'Downsize' : 'Upsize'}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {filteredRecommendations.length > 0 && (
        <div className="mt-4 pt-4 border-t border-frozenWater-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-frozenWater-700">
              Total potential monthly savings: <strong className="text-green-600">{formatCurrency(data.totalPotentialSavings)}</strong>
            </span>
            <span className="text-xs text-frozenWater-600">
              {data.recommendationCount} total recommendation{data.recommendationCount !== 1 ? 's' : ''}
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
                  <Zap className="h-6 w-6 text-frozenWater-600" />
                  What are Rightsizing Recommendations?
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
                  <strong className="text-frozenWater-700">Rightsizing Recommendations</strong> analyze your 
                  resource utilization and suggest size adjustments to optimize costs while maintaining performance.
                </p>
                
                <div className="bg-frozenWater-50 rounded-lg p-4 border border-frozenWater-200">
                  <h4 className="font-semibold text-frozenWater-800 mb-2">How It Works:</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-frozenWater-600 mt-0.5">•</span>
                      <span><strong>Downsizing:</strong> If utilization is consistently low (&lt;20%), consider smaller instance types to reduce costs</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-frozenWater-600 mt-0.5">•</span>
                      <span><strong>Upsizing:</strong> If utilization is consistently high (&gt;80%), consider larger instances to avoid performance issues</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-frozenWater-600 mt-0.5">•</span>
                      <span>Recommendations are prioritized by potential savings and impact</span>
                    </li>
                  </ul>
                </div>
                
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h4 className="font-semibold text-blue-800 mb-2">💡 Best Practices:</h4>
                  <ul className="space-y-1 text-sm text-blue-700">
                    <li>• Review recommendations carefully before applying changes</li>
                    <li>• Test in non-production environments first</li>
                    <li>• Monitor performance after rightsizing</li>
                    <li>• Consider peak usage patterns, not just average utilization</li>
                  </ul>
                </div>
                
                <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                  <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Important:</h4>
                  <p className="text-sm text-yellow-700">
                    These recommendations are based on estimated utilization. Always verify actual resource 
                    metrics and test changes in a safe environment before applying to production.
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
