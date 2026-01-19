import { useState, useEffect } from 'react'
import { useCurrency } from '../contexts/CurrencyContext'
import { insightsAPI } from '../services/api'
import { FileText, RefreshCw, TrendingUp, TrendingDown, DollarSign, Calendar, Info, X } from 'lucide-react'

interface CostSummaryProps {
  providerId: string
  month?: number
  year?: number
  accountId?: number
  startDate?: string
  endDate?: string
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

export default function CostSummary({ providerId, month, year, accountId, startDate, endDate }: CostSummaryProps) {
  const { formatCurrency } = useCurrency()
  const [summary, setSummary] = useState<CostSummaryData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showInfoDialog, setShowInfoDialog] = useState(false)
  const isCustomRange = !!(startDate && endDate)

  useEffect(() => {
    fetchSummary()
  }, [providerId, month, year, accountId, startDate, endDate])

  const fetchSummary = async () => {
    setIsLoading(true)
    setError(null)
    try {
      let result
      if (isCustomRange && startDate && endDate) {
        // Use custom date range API
        result = await insightsAPI.getCustomDateRangeSummary(providerId, startDate, endDate, accountId)
      } else if (month && year) {
        // Use monthly summary API
        result = await insightsAPI.getCostSummary(providerId, month, year, accountId)
      } else {
        setSummary(null)
        setIsLoading(false)
        return
      }
      
      // API returns { explanation, costChange, contributingFactors } or { explanation: null }
      if (result && result.explanation) {
        setSummary(result)
      } else {
        setSummary(null)
      }
    } catch (err: any) {
      // Only log unexpected errors (not 404s)
      if (!err.message?.includes('404')) {
        console.error('Failed to fetch cost summary:', err)
        setError(err.message || 'Failed to load cost summary')
      } else {
        setSummary(null)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegenerate = async () => {
    setIsRegenerating(true)
    setError(null)
    try {
      let result
      if (isCustomRange && startDate && endDate) {
        // Regenerate custom date range summary (force regeneration by clearing cache)
        result = await insightsAPI.getCustomDateRangeSummary(providerId, startDate, endDate, accountId, true)
      } else if (month && year) {
        // Regenerate monthly summary
        result = await insightsAPI.regenerateCostSummary(providerId, month, year, accountId)
      } else {
        setIsRegenerating(false)
        return
      }
      
      // API returns { explanation, costChange, contributingFactors } or { explanation: null }
      if (result && result.explanation) {
        setSummary(result)
      } else {
        setSummary(null)
      }
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
            <FileText className="h-8 w-8 text-frozenWater-600 animate-pulse mx-auto mb-4" />
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

  const costChange = summary.costChange || 0
  const explanation = summary.explanation || ''
  const contributingFactors = summary.contributingFactors || []

  const isIncrease = costChange > 0
  const isDecrease = costChange < 0

  return (
    <div className="card bg-white border-frozenWater-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <FileText className="h-5 w-5 text-frozenWater-600" />
            Cost Summary
            <button
              onClick={() => setShowInfoDialog(true)}
              className="ml-2 p-1 rounded-full hover:bg-frozenWater-100 transition-colors group"
              title="Learn more about Cost Summary"
            >
              <Info className="h-4 w-4 text-frozenWater-600 group-hover:text-frozenWater-700" />
            </button>
          </h3>
          <p className="text-sm text-frozenWater-600">
            {isCustomRange && startDate && endDate
              ? `${new Date(startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - ${new Date(endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - What Changed & Why`
              : month && year
                ? `${monthNames[month - 1]} ${year} - What Changed & Why`
                : 'Cost Summary'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="p-2 rounded-lg border border-frozenWater-200 hover:bg-frozenWater-50 transition-colors disabled:opacity-50"
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

      {/* Info Dialog */}
      {showInfoDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md animate-fade-in" onClick={() => setShowInfoDialog(false)}>
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] max-w-lg w-full mx-4 border border-gray-200/50 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="p-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="h-6 w-6 text-frozenWater-600" />
                  What is Cost Summary?
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
                  <strong className="text-frozenWater-700">Cost Summary</strong> provides a plain-English explanation of your cloud cost changes, 
                  making it easy to understand what happened and why your spending changed.
                </p>
                
                <div className="bg-frozenWater-50 rounded-lg p-4 border border-frozenWater-200">
                  <h4 className="font-semibold text-frozenWater-800 mb-2">What You'll See:</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-frozenWater-600 mt-0.5">•</span>
                      <span><strong>Total Cost Change:</strong> The overall dollar amount and percentage change</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-frozenWater-600 mt-0.5">•</span>
                      <span><strong>Plain-English Explanation:</strong> AI-generated narrative explaining the changes in simple terms</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-frozenWater-600 mt-0.5">•</span>
                      <span><strong>Contributing Factors:</strong> Services that drove the most significant cost changes</span>
                    </li>
                  </ul>
                </div>
                
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h4 className="font-semibold text-blue-800 mb-2">💡 Powered by AI:</h4>
                  <p className="text-sm text-blue-700">
                    Our AI analyzes your cost data and generates detailed, conversational explanations. 
                    You can regenerate the summary anytime to get fresh insights. Summaries are cached to reduce API calls.
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

      <div className="mt-6 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          Summary generated automatically based on cost trends and service changes
        </p>
      </div>
    </div>
  )
}
