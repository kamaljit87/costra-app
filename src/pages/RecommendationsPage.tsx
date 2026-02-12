import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { insightsAPI } from '../services/api'
import { useNotification } from '../contexts/NotificationContext'
import { useCurrency } from '../contexts/CurrencyContext'
import Layout from '../components/Layout'
import Breadcrumbs from '../components/Breadcrumbs'
import RecommendationCard, { type Recommendation } from '../components/RecommendationCard'
import { Spinner } from '@/components/ui/spinner'
import {
  Lightbulb, RefreshCw, CheckCircle, Filter,
  AlertTriangle, AlertCircle, X,
} from 'lucide-react'

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'cost_trend', label: 'Cost Trends' },
  { value: 'idle_resource', label: 'Idle Resources' },
  { value: 'rightsizing', label: 'Rightsizing' },
  { value: 'reserved_instance', label: 'Reserved Instances' },
  { value: 'storage_optimization', label: 'Storage' },
  { value: 'data_transfer', label: 'Data Transfer' },
  { value: 'service_best_practice', label: 'Best Practices' },
  { value: 'cross_provider', label: 'Cross-Provider' },
]

const PRIORITIES = [
  { value: '', label: 'All Priorities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const SORT_OPTIONS = [
  { value: 'savings', label: 'Highest Savings' },
  { value: 'priority', label: 'Priority' },
  { value: 'date', label: 'Most Recent' },
]

interface Summary {
  totalEstimatedSavings: number
  activeRecommendationCount: number
  countByCategory: Record<string, number>
  countByPriority: Record<string, number>
  lastComputedAt: string | null
}

export default function RecommendationsPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const providerIdFromUrl = searchParams.get('providerId') || ''
  const accountIdFromUrl = searchParams.get('accountId') || ''
  const isFilteredByAccount = !!(providerIdFromUrl || accountIdFromUrl)

  const { showSuccess, showError } = useNotification()
  const { formatCurrency } = useCurrency()

  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Filters
  const [category, setCategory] = useState('')
  const [priority, setPriority] = useState('')
  const [sortBy, setSortBy] = useState('savings')
  const [page, setPage] = useState(0)
  const pageSize = 20
  const hasAutoTriggered = useRef(false)

  const loadRecommendations = async () => {
    try {
      setIsLoading(true)
      const filters: Record<string, any> = {
        limit: pageSize,
        offset: page * pageSize,
        sort_by: sortBy,
      }
      if (category) filters.category = category
      if (priority) filters.priority = priority
      if (providerIdFromUrl) filters.provider_id = providerIdFromUrl
      if (accountIdFromUrl) filters.account_id = accountIdFromUrl

      const response = await insightsAPI.getOptimizationRecommendations(filters)
      setRecommendations(response.recommendations || [])
      setTotal(response.total || 0)
      setSummary(response.summary || null)
    } catch (error: any) {
      showError('Failed to Load', error.message || 'Could not load recommendations')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadRecommendations()
  }, [category, priority, sortBy, page, providerIdFromUrl, accountIdFromUrl])

  // Auto-trigger analysis when page loads with no recommendations (once per session)
  useEffect(() => {
    if (
      !isLoading &&
      total === 0 &&
      recommendations.length === 0 &&
      !isFilteredByAccount &&
      !category &&
      !priority &&
      !hasAutoTriggered.current
    ) {
      hasAutoTriggered.current = true
      insightsAPI.refreshRecommendations().then(() => {
        showSuccess('Analysis Started', 'Optimization analysis is running. Results will appear in a few seconds.')
        setTimeout(loadRecommendations, 5000)
      }).catch(() => { /* ignore - user can click Refresh manually */ })
    }
  }, [isLoading, total, recommendations.length, isFilteredByAccount, category, priority, showSuccess])

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true)
      await insightsAPI.refreshRecommendations()
      showSuccess('Analysis Started', 'Optimization analysis is running. Results will appear shortly.')
      // Poll for results after a few seconds
      setTimeout(() => loadRecommendations(), 5000)
    } catch (error: any) {
      showError('Refresh Failed', error.message || 'Could not start analysis')
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleDismiss = async (id: number) => {
    try {
      await insightsAPI.dismissRecommendation(id)
      setRecommendations(prev => prev.filter(r => r.id !== id))
      setTotal(prev => prev - 1)
      if (summary) {
        setSummary({ ...summary, activeRecommendationCount: summary.activeRecommendationCount - 1 })
      }
      showSuccess('Dismissed', 'Recommendation dismissed')
    } catch (error: any) {
      showError('Error', error.message || 'Failed to dismiss')
    }
  }

  const handleImplemented = async (id: number) => {
    try {
      await insightsAPI.markRecommendationImplemented(id)
      setRecommendations(prev => prev.filter(r => r.id !== id))
      setTotal(prev => prev - 1)
      if (summary) {
        setSummary({ ...summary, activeRecommendationCount: summary.activeRecommendationCount - 1 })
      }
      showSuccess('Marked as Done', 'Recommendation marked as implemented')
    } catch (error: any) {
      showError('Error', error.message || 'Failed to update')
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <Layout>
      <div className="flex flex-col min-h-screen">
        <div className="flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full">
          <Breadcrumbs />

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <Lightbulb className="w-6 h-6 text-accent-600" />
                <h1 className="text-2xl font-bold text-gray-900">Optimization Recommendations</h1>
              </div>
              <p className="text-gray-500 mt-1">
                AI-powered suggestions to reduce your cloud costs
              </p>
              {isFilteredByAccount && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-accent-50 text-accent-700">
                    {providerIdFromUrl?.toUpperCase() || 'Provider'}{accountIdFromUrl ? ` · ${accountIdFromUrl}` : ''}
                    <button
                      onClick={() => navigate('/recommendations')}
                      className="p-0.5 rounded hover:bg-accent-100"
                      aria-label="Clear filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="btn-secondary flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Analyzing...' : 'Refresh Analysis'}
            </button>
          </div>

          {/* Summary cards */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="card p-4">
                <div className="text-sm text-gray-500">Potential Monthly Savings</div>
                <div className="text-2xl font-bold text-green-600 mt-1">
                  {formatCurrency(summary.totalEstimatedSavings)}
                </div>
              </div>
              <div className="card p-4">
                <div className="text-sm text-gray-500">Active Recommendations</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">
                  {summary.activeRecommendationCount}
                </div>
              </div>
              <div className="card p-4">
                <div className="text-sm text-gray-500">By Priority</div>
                <div className="flex items-center gap-2 mt-2">
                  {(summary.countByPriority.critical || 0) > 0 && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {summary.countByPriority.critical}
                    </span>
                  )}
                  {(summary.countByPriority.high || 0) > 0 && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {summary.countByPriority.high}
                    </span>
                  )}
                  {(summary.countByPriority.medium || 0) > 0 && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                      {summary.countByPriority.medium}
                    </span>
                  )}
                  {(summary.countByPriority.low || 0) > 0 && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                      {summary.countByPriority.low}
                    </span>
                  )}
                </div>
              </div>
              <div className="card p-4">
                <div className="text-sm text-gray-500">Last Analyzed</div>
                <div className="text-sm font-medium text-gray-900 mt-2">
                  {summary.lastComputedAt
                    ? new Date(summary.lastComputedAt).toLocaleString()
                    : 'Not yet analyzed'
                  }
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(0) }}
              className="input-field text-sm py-1.5 px-3 w-auto"
            >
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <select
              value={priority}
              onChange={(e) => { setPriority(e.target.value); setPage(0) }}
              className="input-field text-sm py-1.5 px-3 w-auto"
            >
              {PRIORITIES.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setPage(0) }}
              className="input-field text-sm py-1.5 px-3 w-auto"
            >
              {SORT_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size={32} />
            </div>
          ) : recommendations.length === 0 ? (
            <div className="card p-12 text-center">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No optimization opportunities found
              </h3>
              <p className="text-gray-500 max-w-md mx-auto">
                {total === 0 && !category && !priority && !isFilteredByAccount
                  ? 'Run an analysis to discover cost-saving opportunities across your cloud providers.'
                  : 'No recommendations match your current filters. Try adjusting them.'
                }
              </p>
              {total === 0 && !category && !priority && !isFilteredByAccount && (
                <button onClick={handleRefresh} className="btn-primary mt-4">
                  <RefreshCw className="w-4 h-4 mr-2 inline" />
                  Run Analysis
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {recommendations.map((rec) => (
                  <RecommendationCard
                    key={rec.id}
                    recommendation={rec}
                    onDismiss={handleDismiss}
                    onImplemented={handleImplemented}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <span className="text-sm text-gray-500">
                    Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, total)} of {total}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="btn-ghost text-sm py-1 px-3 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="btn-ghost text-sm py-1 px-3 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
