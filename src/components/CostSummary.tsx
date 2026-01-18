import { useState, useEffect } from 'react'
import { useCurrency } from '../contexts/CurrencyContext'
import { insightsAPI } from '../services/api'
import { FileText, RefreshCw, TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react'

interface CostSummaryProps {
  providerId: string
  month: number
  year: number
  accountId?: number
}

interface ContributingFactor {
  service: string
  changePercent: number
  cost: number
}

interface CostSummaryData {
  explanation: string
  costChange: number
  contributingFactors?: ContributingFactor[]
}

export default function CostSummary({ providerId, month, year, accountId }: CostSummaryProps) {
  const { formatCurrency } = useCurrency()
  const [summary, setSummary] = useState<CostSummaryData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSummary()
  }, [providerId, month, year, accountId])

  const fetchSummary = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await insightsAPI.getCostSummary(providerId, month, year, accountId)
      setSummary(result.explanation || null)
    } catch (err: any) {
      // Only log unexpected errors
      console.error('Failed to fetch cost summary:', err)
      setError(err.message || 'Failed to load cost summary')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegenerate = async () => {
    setIsRegenerating(true)
    setError(null)
    try {
      const result = await insightsAPI.regenerateCostSummary(providerId, month, year, accountId)
      setSummary(result.explanation || null)
    } catch (err: any) {
      console.error('Failed to regenerate cost summary:', err)
      setError(err.message || 'Failed to regenerate cost summary')
    } finally {
      setIsRegenerating(false)
    }
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  if (isLoading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <FileText className="h-8 w-8 text-primary-600 animate-pulse mx-auto mb-4" />
            <p className="text-gray-600">Generating cost summary...</p>
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
            <p className="text-red-600 mb-2">Error loading summary</p>
            <p className="text-sm text-gray-500">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Cost Summary</h3>
            <p className="text-sm text-gray-500">Plain-English explanation of cost changes</p>
          </div>
          <FileText className="h-5 w-5 text-gray-400" />
        </div>
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">No cost summary available for this period</p>
        </div>
      </div>
    )
  }

  const costChange = typeof summary.costChange === 'number' ? summary.costChange : 0
  const explanation = typeof summary === 'string' ? summary : summary.explanation
  const contributingFactors = typeof summary === 'object' && 'contributingFactors' in summary 
    ? (summary.contributingFactors || []) 
    : []

  const isIncrease = costChange > 0
  const isDecrease = costChange < 0

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Cost Summary</h3>
          <p className="text-sm text-gray-500">
            {monthNames[month - 1]} {year} - What Changed & Why
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
            title="Regenerate cost summary"
          >
            <RefreshCw className={`h-4 w-4 text-gray-600 ${isRegenerating ? 'animate-spin' : ''}`} />
          </button>
          <FileText className="h-5 w-5 text-gray-400" />
        </div>
      </div>

      {/* Cost Change Card */}
      {costChange !== 0 && (
        <div className={`mb-6 p-4 rounded-xl border ${
          isIncrease 
            ? 'bg-red-50 border-red-200' 
            : isDecrease 
              ? 'bg-green-50 border-green-200' 
              : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isIncrease ? (
                <TrendingUp className="h-6 w-6 text-red-600" />
              ) : isDecrease ? (
                <TrendingDown className="h-6 w-6 text-green-600" />
              ) : (
                <DollarSign className="h-6 w-6 text-gray-600" />
              )}
              <div>
                <div className="text-sm font-medium text-gray-600 mb-1">Total Cost Change</div>
                <div className={`text-2xl font-bold ${
                  isIncrease ? 'text-red-700' : isDecrease ? 'text-green-700' : 'text-gray-700'
                }`}>
                  {isIncrease ? '+' : ''}{formatCurrency(Math.abs(costChange))}
                </div>
              </div>
            </div>
            <Calendar className="h-5 w-5 text-gray-400" />
          </div>
        </div>
      )}

      {/* Explanation Text */}
      <div className="mb-6">
        <div className="prose prose-sm max-w-none">
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-gray-800 leading-relaxed whitespace-pre-line">
              {explanation}
            </p>
          </div>
        </div>
      </div>

      {/* Contributing Factors */}
      {contributingFactors && contributingFactors.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Contributing Factors</h4>
          <div className="space-y-2">
            {contributingFactors.map((factor, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{factor.service}</div>
                  <div className="text-sm text-gray-600 mt-0.5">
                    Current cost: {formatCurrency(factor.cost)}
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-lg text-sm font-semibold ${
                  factor.changePercent > 0
                    ? 'bg-red-100 text-red-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {factor.changePercent > 0 ? '+' : ''}{factor.changePercent.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          Summary generated automatically based on cost trends and service changes
        </p>
      </div>
    </div>
  )
}
