import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { insightsAPI } from '../services/api'
import { useNotification } from '../contexts/NotificationContext'
import { useCurrency } from '../contexts/CurrencyContext'
import Layout from '../components/Layout'
import Breadcrumbs from '../components/Breadcrumbs'
import RecommendationCard, { type Recommendation } from '../components/RecommendationCard'
import { ProviderIcon } from '../components/CloudProviderIcons'
import { Spinner } from '@/components/ui/spinner'
import {
  Lightbulb, RefreshCw, CheckCircle, Search,
  X, List, TableProperties,
  ChevronDown, ChevronRight, Zap, Clock,
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

const GROUP_OPTIONS = [
  { value: '', label: 'No Grouping' },
  { value: 'provider', label: 'By Provider' },
  { value: 'category', label: 'By Category' },
]

const STATUS_TABS = [
  { value: 'active', label: 'Active' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'implemented', label: 'Implemented' },
]

const categoryLabels: Record<string, string> = {
  cost_trend: 'Cost Trends',
  idle_resource: 'Idle Resources',
  rightsizing: 'Rightsizing',
  reserved_instance: 'Reserved Instances',
  storage_optimization: 'Storage',
  data_transfer: 'Data Transfer',
  service_best_practice: 'Best Practices',
  cross_provider: 'Cross-Provider',
}

interface Summary {
  totalEstimatedSavings: number
  activeRecommendationCount: number
  countByCategory: Record<string, number>
  countByPriority: Record<string, number>
  lastComputedAt: string | null
}

// SVG donut chart for category breakdown
function CategoryDonut({ countByCategory, total }: { countByCategory: Record<string, number>; total: number }) {
  if (total === 0) return null
  const colors: Record<string, string> = {
    cost_trend: '#ef4444',
    idle_resource: '#f97316',
    rightsizing: '#eab308',
    reserved_instance: '#8b5cf6',
    storage_optimization: '#3b82f6',
    data_transfer: '#06b6d4',
    service_best_practice: '#10b981',
    cross_provider: '#ec4899',
  }
  const entries = Object.entries(countByCategory).filter(([, v]) => v > 0)
  let cumulative = 0
  const radius = 40
  const circumference = 2 * Math.PI * radius

  return (
    <svg viewBox="0 0 100 100" className="w-20 h-20">
      {entries.map(([cat, count]) => {
        const pct = count / total
        const offset = cumulative * circumference
        cumulative += pct
        return (
          <circle
            key={cat}
            cx="50" cy="50" r={radius}
            fill="none"
            stroke={colors[cat] || '#9ca3af'}
            strokeWidth="12"
            strokeDasharray={`${pct * circumference} ${circumference}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 50 50)"
          />
        )
      })}
      <text x="50" y="50" textAnchor="middle" dominantBaseline="central" className="text-xs font-bold fill-gray-700" fontSize="14">
        {total}
      </text>
    </svg>
  )
}

// Priority bar
function PriorityBar({ countByPriority }: { countByPriority: Record<string, number> }) {
  const items = [
    { key: 'critical', color: 'bg-red-500', label: 'Critical' },
    { key: 'high', color: 'bg-orange-500', label: 'High' },
    { key: 'medium', color: 'bg-yellow-400', label: 'Medium' },
    { key: 'low', color: 'bg-blue-400', label: 'Low' },
  ]
  const total = items.reduce((s, i) => s + (countByPriority[i.key] || 0), 0)
  if (total === 0) return null

  return (
    <div>
      <div className="flex h-2.5 rounded-full overflow-hidden">
        {items.map(item => {
          const count = countByPriority[item.key] || 0
          if (!count) return null
          return (
            <div
              key={item.key}
              className={`${item.color}`}
              style={{ width: `${(count / total) * 100}%` }}
              title={`${item.label}: ${count}`}
            />
          )
        })}
      </div>
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {items.map(item => {
          const count = countByPriority[item.key] || 0
          if (!count) return null
          return (
            <span key={item.key} className="flex items-center gap-1 text-xs text-gray-600">
              <span className={`w-2 h-2 rounded-full ${item.color}`} />
              {item.label}: {count}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// Numbered pagination
function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null

  const pages: (number | '...')[] = []
  pages.push(0)
  if (page > 2) pages.push('...')
  for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) {
    pages.push(i)
  }
  if (page < totalPages - 3) pages.push('...')
  if (totalPages > 1) pages.push(totalPages - 1)

  // Deduplicate
  const unique: (number | '...')[] = []
  for (const p of pages) {
    if (unique[unique.length - 1] !== p) unique.push(p)
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
        className="btn-ghost text-sm py-1 px-3 disabled:opacity-50"
      >
        Previous
      </button>
      {unique.map((p, i) =>
        p === '...' ? (
          <span key={`e${i}`} className="px-2 text-gray-400">...</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
              p === page
                ? 'bg-accent-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {p + 1}
          </button>
        )
      )}
      <button
        onClick={() => onChange(Math.min(totalPages - 1, page + 1))}
        disabled={page >= totalPages - 1}
        className="btn-ghost text-sm py-1 px-3 disabled:opacity-50"
      >
        Next
      </button>
    </div>
  )
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
  const [statusFilter, setStatusFilter] = useState('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [groupBy, setGroupBy] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'table'>('list')
  const [page, setPage] = useState(0)
  const pageSize = 20
  const hasAutoTriggered = useRef(false)

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isBulkActing, setIsBulkActing] = useState(false)

  // Debounced search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(searchTimerRef.current)
  }, [searchQuery])

  const loadRecommendations = async () => {
    try {
      setIsLoading(true)
      const filters: Record<string, any> = {
        limit: pageSize,
        offset: page * pageSize,
        sort_by: sortBy,
        status: statusFilter,
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
    setSelectedIds(new Set())
  }, [category, priority, sortBy, statusFilter, page, providerIdFromUrl, accountIdFromUrl])

  // Auto-trigger analysis when page loads with no recommendations (once per session)
  useEffect(() => {
    if (
      !isLoading &&
      total === 0 &&
      recommendations.length === 0 &&
      !isFilteredByAccount &&
      !category &&
      !priority &&
      statusFilter === 'active' &&
      !hasAutoTriggered.current
    ) {
      hasAutoTriggered.current = true
      insightsAPI.refreshRecommendations().then(() => {
        showSuccess('Analysis Started', 'Optimization analysis is running. Results will appear in a few seconds.')
        setTimeout(loadRecommendations, 5000)
      }).catch(() => {})
    }
  }, [isLoading, total, recommendations.length, isFilteredByAccount, category, priority, statusFilter, showSuccess])

  // Client-side search filter
  const filteredRecommendations = useMemo(() => {
    if (!debouncedSearch) return recommendations
    const q = debouncedSearch.toLowerCase()
    return recommendations.filter(r =>
      r.title.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      (r.service_name && r.service_name.toLowerCase().includes(q)) ||
      (r.resource_name && r.resource_name.toLowerCase().includes(q)) ||
      (r.resource_id && r.resource_id.toLowerCase().includes(q))
    )
  }, [recommendations, debouncedSearch])

  // Provider list extracted from loaded recommendations
  const providerList = useMemo(() => {
    return [...new Set(recommendations.map(r => r.provider_id))]
  }, [recommendations])

  // Grouped data
  const groupedData = useMemo(() => {
    if (!groupBy) return null
    const groups: Record<string, Recommendation[]> = {}
    for (const rec of filteredRecommendations) {
      const key = groupBy === 'provider' ? rec.provider_id : rec.category
      if (!groups[key]) groups[key] = []
      groups[key].push(rec)
    }
    return Object.entries(groups).sort((a, b) => {
      const savingsA = a[1].reduce((s, r) => s + r.estimated_monthly_savings, 0)
      const savingsB = b[1].reduce((s, r) => s + r.estimated_monthly_savings, 0)
      return savingsB - savingsA
    })
  }, [filteredRecommendations, groupBy])

  // Collapsed groups
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }, [])

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true)
      await insightsAPI.refreshRecommendations()
      showSuccess('Analysis Started', 'Optimization analysis is running. Results will appear shortly.')
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
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n })
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
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n })
      if (summary) {
        setSummary({ ...summary, activeRecommendationCount: summary.activeRecommendationCount - 1 })
      }
      showSuccess('Marked as Done', 'Recommendation marked as implemented')
    } catch (error: any) {
      showError('Error', error.message || 'Failed to update')
    }
  }

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const handleBulkDismiss = async () => {
    setIsBulkActing(true)
    try {
      await Promise.all([...selectedIds].map(id => insightsAPI.dismissRecommendation(id)))
      setRecommendations(prev => prev.filter(r => !selectedIds.has(r.id)))
      setTotal(prev => prev - selectedIds.size)
      showSuccess('Bulk Dismiss', `${selectedIds.size} recommendations dismissed`)
      setSelectedIds(new Set())
    } catch (error: any) {
      showError('Error', error.message || 'Failed to dismiss some recommendations')
    } finally {
      setIsBulkActing(false)
    }
  }

  const handleBulkImplemented = async () => {
    setIsBulkActing(true)
    try {
      await Promise.all([...selectedIds].map(id => insightsAPI.markRecommendationImplemented(id)))
      setRecommendations(prev => prev.filter(r => !selectedIds.has(r.id)))
      setTotal(prev => prev - selectedIds.size)
      showSuccess('Bulk Implemented', `${selectedIds.size} recommendations marked as done`)
      setSelectedIds(new Set())
    } catch (error: any) {
      showError('Error', error.message || 'Failed to update some recommendations')
    } finally {
      setIsBulkActing(false)
    }
  }

  const totalPages = Math.ceil(total / pageSize)
  const criticalHighCount = (summary?.countByPriority?.critical || 0) + (summary?.countByPriority?.high || 0)
  const criticalHighSavingsPct = summary && summary.totalEstimatedSavings > 0
    ? Math.round((criticalHighCount / Math.max(1, summary.activeRecommendationCount)) * 100)
    : 0

  const getGroupLabel = (key: string) => {
    if (groupBy === 'provider') return key.toUpperCase()
    return categoryLabels[key] || key
  }

  const renderCards = (recs: Recommendation[]) => {
    if (viewMode === 'table') {
      return (
        <div className="overflow-x-auto">
          <table className="table-modern w-full">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-8">
                  <input
                    type="checkbox"
                    checked={recs.length > 0 && recs.every(r => selectedIds.has(r.id))}
                    onChange={() => {
                      const allSelected = recs.every(r => selectedIds.has(r.id))
                      setSelectedIds(prev => {
                        const next = new Set(prev)
                        recs.forEach(r => allSelected ? next.delete(r.id) : next.add(r.id))
                        return next
                      })
                    }}
                    className="rounded border-gray-300 text-accent-600"
                  />
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Priority</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Recommendation</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Category</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Provider</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Savings</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Conf.</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recs.map(rec => (
                <RecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  onDismiss={handleDismiss}
                  onImplemented={handleImplemented}
                  compact
                  selectable
                  selected={selectedIds.has(rec.id)}
                  onToggleSelect={toggleSelect}
                />
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {recs.map(rec => (
          <RecommendationCard
            key={rec.id}
            recommendation={rec}
            onDismiss={handleDismiss}
            onImplemented={handleImplemented}
            selectable
            selected={selectedIds.has(rec.id)}
            onToggleSelect={toggleSelect}
          />
        ))}
      </div>
    )
  }

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

          {/* Hero Summary */}
          {summary && statusFilter === 'active' && (
            <div className="card p-6 mb-6">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                {/* Savings */}
                <div className="flex-1">
                  <div className="text-sm text-gray-500 mb-1">Potential Monthly Savings</div>
                  <div className="text-3xl font-bold text-green-600">
                    {formatCurrency(summary.totalEstimatedSavings)}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    across {summary.activeRecommendationCount} recommendation{summary.activeRecommendationCount !== 1 ? 's' : ''}
                  </div>
                  {criticalHighCount > 0 && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-orange-600">
                      <Zap className="w-3.5 h-3.5" />
                      {criticalHighSavingsPct}% from critical + high priority items
                    </div>
                  )}
                  {summary.lastComputedAt && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      Analyzed {new Date(summary.lastComputedAt).toLocaleString()}
                    </div>
                  )}
                </div>

                {/* Donut */}
                <div className="flex-shrink-0">
                  <CategoryDonut
                    countByCategory={summary.countByCategory}
                    total={summary.activeRecommendationCount}
                  />
                </div>

                {/* Priority bar */}
                <div className="flex-1 min-w-[200px]">
                  <div className="text-sm text-gray-500 mb-2">Priority Breakdown</div>
                  <PriorityBar countByPriority={summary.countByPriority} />
                </div>
              </div>
            </div>
          )}

          {/* Status Tabs */}
          <div className="flex items-center gap-1 mb-4 border-b border-gray-200">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => { setStatusFilter(tab.value); setPage(0); setSelectedIds(new Set()) }}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  statusFilter === tab.value
                    ? 'border-accent-600 text-accent-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search recommendations..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input-field text-sm py-1.5 pl-9 pr-3 w-full"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100"
                >
                  <X className="w-3.5 h-3.5 text-gray-400" />
                </button>
              )}
            </div>

            {/* Provider chips */}
            {providerList.length > 1 && !providerIdFromUrl && (
              <div className="flex items-center gap-1.5">
                {providerList.map(pid => (
                  <button
                    key={pid}
                    onClick={() => navigate(`/recommendations?providerId=${pid}`)}
                    className="flex items-center gap-1 px-2 py-1 rounded-full text-xs border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <ProviderIcon providerId={pid} size={14} />
                    {pid.toUpperCase()}
                  </button>
                ))}
              </div>
            )}

            {/* Dropdowns */}
            <select
              value={category}
              onChange={e => { setCategory(e.target.value); setPage(0) }}
              className="input-field text-sm py-1.5 px-3 w-auto"
            >
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <select
              value={priority}
              onChange={e => { setPriority(e.target.value); setPage(0) }}
              className="input-field text-sm py-1.5 px-3 w-auto"
            >
              {PRIORITIES.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={e => { setSortBy(e.target.value); setPage(0) }}
              className="input-field text-sm py-1.5 px-3 w-auto"
            >
              {SORT_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <select
              value={groupBy}
              onChange={e => setGroupBy(e.target.value)}
              className="input-field text-sm py-1.5 px-3 w-auto"
            >
              {GROUP_OPTIONS.map(g => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>

            {/* View toggle */}
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 ${viewMode === 'list' ? 'bg-accent-100 text-accent-700' : 'text-gray-400 hover:text-gray-600'}`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 ${viewMode === 'table' ? 'bg-accent-100 text-accent-700' : 'text-gray-400 hover:text-gray-600'}`}
                title="Table view"
              >
                <TableProperties className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 mb-4 p-3 bg-accent-50 rounded-lg border border-accent-200">
              <span className="text-sm font-medium text-accent-700">{selectedIds.size} selected</span>
              <button
                onClick={handleBulkDismiss}
                disabled={isBulkActing}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Dismiss Selected
              </button>
              <button
                onClick={handleBulkImplemented}
                disabled={isBulkActing}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                Mark Implemented
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-gray-500 hover:text-gray-700 ml-auto"
              >
                Clear
              </button>
            </div>
          )}

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size={32} />
            </div>
          ) : filteredRecommendations.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                {statusFilter === 'active' ? (
                  <CheckCircle className="w-8 h-8 text-green-400" />
                ) : statusFilter === 'dismissed' ? (
                  <X className="w-8 h-8 text-gray-400" />
                ) : (
                  <CheckCircle className="w-8 h-8 text-accent-400" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {statusFilter === 'active' && !category && !priority && !debouncedSearch && !isFilteredByAccount
                  ? 'No optimization opportunities found'
                  : statusFilter === 'dismissed'
                    ? 'No dismissed recommendations'
                    : statusFilter === 'implemented'
                      ? 'No implemented recommendations yet'
                      : 'No recommendations match your filters'
                }
              </h3>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                {statusFilter === 'active' && !category && !priority && !debouncedSearch && !isFilteredByAccount
                  ? 'Run an analysis to discover cost-saving opportunities across your cloud providers.'
                  : statusFilter === 'dismissed'
                    ? 'Dismissed recommendations will appear here. You can dismiss recommendations you don\'t plan to act on.'
                    : statusFilter === 'implemented'
                      ? 'Mark recommendations as done when you\'ve applied the suggested changes.'
                      : 'Try adjusting your filters or search query.'
                }
              </p>
              {statusFilter === 'active' && !category && !priority && !debouncedSearch && !isFilteredByAccount && (
                <>
                  <button onClick={handleRefresh} disabled={isRefreshing} className="btn-primary">
                    <RefreshCw className={`w-4 h-4 mr-2 inline ${isRefreshing ? 'animate-spin' : ''}`} />
                    Run Analysis
                  </button>
                  <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-xl mx-auto text-left">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs font-medium text-gray-700 mb-1">1. Connect Providers</div>
                      <div className="text-xs text-gray-500">Add your cloud provider credentials</div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs font-medium text-gray-700 mb-1">2. Sync Data</div>
                      <div className="text-xs text-gray-500">Let Costra fetch your cost and usage data</div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs font-medium text-gray-700 mb-1">3. Run Analysis</div>
                      <div className="text-xs text-gray-500">Click the button above to find savings</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : groupedData ? (
            /* Grouped view */
            <div className="space-y-4">
              {groupedData.map(([key, recs]) => {
                const isCollapsed = collapsedGroups.has(key)
                const groupSavings = recs.reduce((s, r) => s + r.estimated_monthly_savings, 0)
                return (
                  <div key={key}>
                    <button
                      onClick={() => toggleGroup(key)}
                      className="flex items-center gap-2 w-full text-left py-2 px-1 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                      {groupBy === 'provider' && <ProviderIcon providerId={key} size={16} />}
                      <span className="font-semibold text-gray-900">{getGroupLabel(key)}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {recs.length}
                      </span>
                      {groupSavings > 0 && (
                        <span className="text-xs font-medium text-green-600 ml-auto">
                          {formatCurrency(groupSavings)}/mo
                        </span>
                      )}
                    </button>
                    {!isCollapsed && (
                      <div className="mt-2">
                        {renderCards(recs)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            /* Flat view */
            renderCards(filteredRecommendations)
          )}

          {/* Pagination */}
          {!groupBy && totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <span className="text-sm text-gray-500">
                Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, total)} of {total}
              </span>
              <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
