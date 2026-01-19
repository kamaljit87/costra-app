import { useState, useEffect } from 'react'
import { useCurrency } from '../contexts/CurrencyContext'
import { insightsAPI } from '../services/api'
import { AlertTriangle, TrendingUp, TrendingDown, Activity, Zap, Info, X } from 'lucide-react'

interface Anomaly {
  providerId: string
  serviceName: string
  baselineDate: string
  baselineCost: number
  rollingAvg: number
  variancePercent: number
  isIncrease: boolean
  message: string
}

interface AnomalyDetectionProps {
  providerId?: string
  thresholdPercent?: number
  accountId?: number
}

export default function AnomalyDetection({ providerId, thresholdPercent = 20, accountId }: AnomalyDetectionProps) {
  const { formatCurrency } = useCurrency()
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInfoDialog, setShowInfoDialog] = useState(false)

  useEffect(() => {
    const fetchAnomalies = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const result = await insightsAPI.getAnomalies(providerId, thresholdPercent, accountId)
        setAnomalies(result.anomalies || [])
      } catch (err: any) {
        console.error('Failed to fetch anomalies:', err)
        setError(err.message || 'Failed to load anomalies')
      } finally {
        setIsLoading(false)
      }
    }

    fetchAnomalies()
    
    // Refresh anomalies every 5 minutes
    const interval = setInterval(fetchAnomalies, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [providerId, thresholdPercent, accountId])

  if (isLoading) {
    return (
      <div className="card bg-gradient-to-br from-white to-frozenWater-50/30 border-frozenWater-100">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Activity className="h-8 w-8 text-frozenWater-600 animate-pulse mx-auto mb-4" />
            <p className="text-frozenWater-700">Analyzing cost patterns...</p>
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

  if (anomalies.length === 0) {
    return (
      <div className="card bg-gradient-to-br from-white to-frozenWater-50/30 border-frozenWater-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Zap className="h-5 w-5 text-frozenWater-600" />
              Cost Anomalies
              <button
                onClick={() => setShowInfoDialog(true)}
                className="ml-2 p-1 rounded-full hover:bg-frozenWater-100 transition-colors group"
                title="Learn more about Cost Anomalies"
              >
                <Info className="h-4 w-4 text-frozenWater-600 group-hover:text-frozenWater-700" />
              </button>
            </h3>
            <p className="text-sm text-frozenWater-600">Cost changes vs 30-day baseline</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12 bg-green-50 rounded-xl border border-green-200">
          <div className="text-center">
            <Zap className="h-10 w-10 text-green-600 mx-auto mb-3" />
            <p className="text-green-900 font-medium mb-1">No anomalies detected</p>
            <p className="text-green-700 text-sm mb-2">All services are within expected ranges</p>
            <p className="text-green-600 text-xs">
              Anomaly detection compares current costs to 30-day rolling averages. Baselines are calculated automatically as cost data is synced.
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
                    What are Cost Anomalies?
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
                    <strong className="text-frozenWater-700">Cost Anomalies</strong> are unexpected cost changes that deviate significantly 
                    from your normal spending patterns. They help you quickly identify unusual spending that might indicate issues, 
                    waste, or opportunities for optimization.
                  </p>
                  
                  <div className="bg-frozenWater-50 rounded-lg p-4 border border-frozenWater-200">
                    <h4 className="font-semibold text-frozenWater-800 mb-2">How It Works:</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-frozenWater-600 mt-0.5">•</span>
                        <span>Compares current costs to a <strong>30-day rolling average</strong> baseline</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-frozenWater-600 mt-0.5">•</span>
                        <span>Flags services with costs <strong>{thresholdPercent}% or more</strong> different from baseline</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-frozenWater-600 mt-0.5">•</span>
                        <span>Shows both <strong>increases</strong> (spending spikes) and <strong>decreases</strong> (cost savings)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-frozenWater-600 mt-0.5">•</span>
                        <span>Updates automatically as new cost data arrives</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                    <h4 className="font-semibold text-yellow-800 mb-2">⚠️ When to Investigate:</h4>
                    <p className="text-sm text-yellow-700">
                      Large cost increases might indicate: resource leaks, misconfigurations, or unexpected usage spikes. 
                      Large decreases might indicate: successful optimizations or service shutdowns. Always investigate significant anomalies!
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

  // Sort by variance percent (highest first)
  const sortedAnomalies = [...anomalies].sort((a, b) => b.variancePercent - a.variancePercent)

  return (
    <div className="card bg-gradient-to-br from-white to-frozenWater-50/30 border-frozenWater-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Zap className="h-5 w-5 text-frozenWater-600" />
            Cost Anomalies
            <button
              onClick={() => setShowInfoDialog(true)}
              className="ml-2 p-1 rounded-full hover:bg-frozenWater-100 transition-colors group"
              title="Learn more about Cost Anomalies"
            >
              <Info className="h-4 w-4 text-frozenWater-600 group-hover:text-frozenWater-700" />
            </button>
          </h3>
          <p className="text-sm text-frozenWater-600">
            Services with costs {thresholdPercent}%+ different from 30-day baseline
          </p>
        </div>
        <AlertTriangle className="h-5 w-5 text-yellow-600" />
      </div>

      {/* Anomalies List */}
      <div className="space-y-3">
        {sortedAnomalies.map((anomaly, index) => {
          const isHigh = anomaly.variancePercent >= 30
          const isMedium = anomaly.variancePercent >= 20 && anomaly.variancePercent < 30
          
          return (
            <div
              key={`${anomaly.providerId}-${anomaly.serviceName}-${anomaly.baselineDate}-${index}`}
              className={`
                p-4 rounded-xl border transition-all
                ${isHigh 
                  ? 'bg-red-50 border-red-200' 
                  : isMedium 
                    ? 'bg-yellow-50 border-yellow-200' 
                    : 'bg-orange-50 border-orange-200'
                }
                hover:shadow-md
              `}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {anomaly.isIncrease ? (
                      <TrendingUp className={`h-5 w-5 ${isHigh ? 'text-red-600' : 'text-yellow-600'}`} />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-green-600" />
                    )}
                    <div>
                      <div className="font-semibold text-gray-900">{anomaly.serviceName}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{anomaly.providerId.toUpperCase()}</div>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-700 mb-2">{anomaly.message}</p>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Current:</span>
                      <span>{formatCurrency(anomaly.baselineCost)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Baseline (30d avg):</span>
                      <span>{formatCurrency(anomaly.rollingAvg)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Difference:</span>
                      <span className={anomaly.isIncrease ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
                        {anomaly.isIncrease ? '+' : ''}{formatCurrency(anomaly.baselineCost - anomaly.rollingAvg)}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className={`
                  px-3 py-1 rounded-lg text-sm font-semibold whitespace-nowrap
                  ${isHigh 
                    ? 'bg-red-100 text-red-700' 
                    : isMedium 
                      ? 'bg-yellow-100 text-yellow-700' 
                      : 'bg-orange-100 text-orange-700'
                  }
                `}>
                  {anomaly.isIncrease ? '+' : ''}{anomaly.variancePercent.toFixed(1)}%
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {anomalies.length > 0 && (
        <div className="mt-4 pt-4 border-t border-frozenWater-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-frozenWater-700">
              {anomalies.length} anomal{anomalies.length !== 1 ? 'ies' : 'y'} detected
            </span>
            <span className="text-xs text-frozenWater-600">
              Threshold: ±{thresholdPercent}% from 30-day average
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
                  What are Cost Anomalies?
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
                  <strong className="text-frozenWater-700">Cost Anomalies</strong> are unexpected cost changes that deviate significantly 
                  from your normal spending patterns. They help you quickly identify unusual spending that might indicate issues, 
                  waste, or opportunities for optimization.
                </p>
                
                <div className="bg-frozenWater-50 rounded-lg p-4 border border-frozenWater-200">
                  <h4 className="font-semibold text-frozenWater-800 mb-2">How It Works:</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-frozenWater-600 mt-0.5">•</span>
                      <span>Compares current costs to a <strong>30-day rolling average</strong> baseline</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-frozenWater-600 mt-0.5">•</span>
                      <span>Flags services with costs <strong>{thresholdPercent}% or more</strong> different from baseline</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-frozenWater-600 mt-0.5">•</span>
                      <span>Shows both <strong>increases</strong> (spending spikes) and <strong>decreases</strong> (cost savings)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-frozenWater-600 mt-0.5">•</span>
                      <span>Updates automatically as new cost data arrives</span>
                    </li>
                  </ul>
                </div>
                
                <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                  <h4 className="font-semibold text-yellow-800 mb-2">⚠️ When to Investigate:</h4>
                  <p className="text-sm text-yellow-700">
                    Large cost increases might indicate: resource leaks, misconfigurations, or unexpected usage spikes. 
                    Large decreases might indicate: successful optimizations or service shutdowns. Always investigate significant anomalies!
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
