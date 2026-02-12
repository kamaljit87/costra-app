import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Lightbulb, ArrowRight, AlertCircle, AlertTriangle } from 'lucide-react'
import { insightsAPI } from '../services/api'
import { useCurrency } from '../contexts/CurrencyContext'

interface Summary {
  totalEstimatedSavings: number
  activeRecommendationCount: number
  countByPriority: Record<string, number>
  topRecommendations: Array<{
    id: number
    title: string
    category: string
    provider_id: string
    estimated_monthly_savings: number
    priority: string
  }>
  lastComputedAt: string | null
}

export default function OptimizationSummary() {
  const { formatCurrency } = useCurrency()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const data = await insightsAPI.getOptimizationSummary()
        setSummary(data)
      } catch {
        // Silently fail — widget is non-critical
      } finally {
        setLoading(false)
      }
    }
    loadSummary()
  }, [])

  if (loading || !summary || summary.activeRecommendationCount === 0) return null

  return (
    <div className="card p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-100 flex items-center justify-center">
            <Lightbulb className="w-4 h-4 text-accent-600" />
          </div>
          <h3 className="font-semibold text-gray-900">Optimization Insights</h3>
        </div>
        <Link
          to="/recommendations"
          className="text-sm text-accent-600 hover:text-accent-700 flex items-center gap-1"
        >
          View All <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-3xl font-bold text-green-600">
          {formatCurrency(summary.totalEstimatedSavings)}
        </span>
        <span className="text-sm text-gray-500">potential monthly savings</span>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-gray-600">
          {summary.activeRecommendationCount} recommendation{summary.activeRecommendationCount !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-1.5">
          {(summary.countByPriority.critical || 0) > 0 && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-0.5">
              <AlertCircle className="w-3 h-3" />{summary.countByPriority.critical}
            </span>
          )}
          {(summary.countByPriority.high || 0) > 0 && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 flex items-center gap-0.5">
              <AlertTriangle className="w-3 h-3" />{summary.countByPriority.high}
            </span>
          )}
          {(summary.countByPriority.medium || 0) > 0 && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
              {summary.countByPriority.medium}
            </span>
          )}
        </div>
      </div>

      {/* Top recommendations */}
      {summary.topRecommendations.length > 0 && (
        <div className="space-y-2">
          {summary.topRecommendations.map(rec => (
            <Link
              key={rec.id}
              to="/recommendations"
              className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <span className="text-sm text-gray-700 truncate mr-2">{rec.title}</span>
              <span className="text-sm font-semibold text-green-600 whitespace-nowrap">
                {formatCurrency(rec.estimated_monthly_savings)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
