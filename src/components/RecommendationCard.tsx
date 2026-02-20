import { useState } from 'react'
import {
  TrendingUp, Power, ArrowDownUp, Ticket, HardDrive,
  Network, Lightbulb, ArrowLeftRight, ChevronDown, ChevronUp,
  X, CheckCircle, Sparkles, ArrowRight, Clock,
} from 'lucide-react'
import { ProviderIcon } from './CloudProviderIcons'
import { useCurrency } from '../contexts/CurrencyContext'

export interface Recommendation {
  id: number
  category: string
  subcategory: string | null
  provider_id: string
  service_name: string | null
  resource_id: string | null
  resource_name: string | null
  resource_type: string | null
  region: string | null
  title: string
  description: string
  action: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  estimated_monthly_savings: number
  estimated_savings_percent: number
  confidence: 'high' | 'medium' | 'low'
  current_cost: number
  evidence: Record<string, any> | null
  status: string
  first_detected_at: string
  last_validated_at: string
}

interface RecommendationCardProps {
  recommendation: Recommendation
  onDismiss: (id: number) => void
  onImplemented: (id: number) => void
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: (id: number) => void
  compact?: boolean
}

const categoryIcons: Record<string, typeof TrendingUp> = {
  cost_trend: TrendingUp,
  idle_resource: Power,
  rightsizing: ArrowDownUp,
  reserved_instance: Ticket,
  storage_optimization: HardDrive,
  data_transfer: Network,
  service_best_practice: Lightbulb,
  cross_provider: ArrowLeftRight,
}

const categoryLabels: Record<string, string> = {
  cost_trend: 'Cost Trend',
  idle_resource: 'Idle Resource',
  rightsizing: 'Rightsizing',
  reserved_instance: 'Reserved Instance',
  storage_optimization: 'Storage',
  data_transfer: 'Data Transfer',
  service_best_practice: 'Best Practice',
  cross_provider: 'Cross-Provider',
}

const priorityStyles: Record<string, { border: string; badge: string; text: string }> = {
  critical: { border: 'border-l-red-500', badge: 'bg-red-100 text-red-700', text: 'Critical' },
  high: { border: 'border-l-orange-500', badge: 'bg-orange-100 text-orange-700', text: 'High' },
  medium: { border: 'border-l-yellow-500', badge: 'bg-yellow-100 text-yellow-700', text: 'Medium' },
  low: { border: 'border-l-blue-500', badge: 'bg-blue-100 text-blue-700', text: 'Low' },
}

function ConfidenceDots({ level }: { level: string }) {
  const filled = level === 'high' ? 3 : level === 'medium' ? 2 : 1
  return (
    <div className="flex items-center gap-0.5" title={`${level} confidence`}>
      {[1, 2, 3].map(i => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${
            i <= filled ? 'bg-accent-600' : 'bg-gray-300'
          }`}
        />
      ))}
    </div>
  )
}

function groupEvidence(evidence: Record<string, any>) {
  const skip = new Set(['ai_enhanced', 'data_hash', 'ai_description', 'ai_action'])
  const costKeys = ['monthly_cost', 'avg_daily_cost', 'cost_trend', 'cost_change', 'previous_cost', 'projected_cost']
  const resourceKeys = ['instance_type', 'instance_size', 'storage_type', 'volume_type', 'disk_size', 'vcpus', 'memory_gb']
  const usageKeys = ['cpu_utilization', 'memory_utilization', 'network_in', 'network_out', 'iops', 'throughput', 'requests']

  const groups: { label: string; entries: [string, any][]; color?: string }[] = []
  const costEntries: [string, any][] = []
  const resourceEntries: [string, any][] = []
  const usageEntries: [string, any][] = []
  const otherEntries: [string, any][] = []

  for (const [k, v] of Object.entries(evidence)) {
    if (skip.has(k)) continue
    if (costKeys.includes(k)) costEntries.push([k, v])
    else if (resourceKeys.includes(k)) resourceEntries.push([k, v])
    else if (usageKeys.includes(k)) usageEntries.push([k, v])
    else otherEntries.push([k, v])
  }

  if (costEntries.length) groups.push({ label: 'Cost Metrics', entries: costEntries })
  if (resourceEntries.length) groups.push({ label: 'Resource Info', entries: resourceEntries })
  if (usageEntries.length) groups.push({ label: 'Usage Data', entries: usageEntries })
  if (otherEntries.length) groups.push({ label: 'Analysis Data', entries: otherEntries })

  if (evidence.ai_enhanced && (evidence.ai_description || evidence.ai_action)) {
    const aiEntries: [string, any][] = []
    if (evidence.ai_description) aiEntries.push(['insight', evidence.ai_description])
    if (evidence.ai_action) aiEntries.push(['suggested_action', evidence.ai_action])
    groups.push({ label: 'AI Insights', entries: aiEntries, color: 'purple' })
  }

  return groups
}

export default function RecommendationCard({
  recommendation: rec, onDismiss, onImplemented,
  selectable, selected, onToggleSelect, compact,
}: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(false)
  const { formatCurrency } = useCurrency()

  const CategoryIcon = categoryIcons[rec.category] || Lightbulb
  const priority = priorityStyles[rec.priority] || priorityStyles.low
  const isAIEnhanced = rec.evidence?.ai_enhanced === true
  const isDimmed = rec.status === 'dismissed' || rec.status === 'implemented'
  const potentialCost = rec.current_cost > 0 ? rec.current_cost - rec.estimated_monthly_savings : 0

  // Compact table row mode
  if (compact) {
    return (
      <tr className={`hover:bg-gray-50 transition-colors ${isDimmed ? 'opacity-60' : ''}`}>
        {selectable && (
          <td className="px-3 py-3">
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect?.(rec.id)}
              className="rounded border-gray-300 text-accent-600 focus:ring-accent-500"
            />
          </td>
        )}
        <td className="px-3 py-3">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priority.badge}`}>
            {priority.text}
          </span>
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            {isAIEnhanced && <Sparkles className="w-3 h-3 text-purple-500 flex-shrink-0" />}
            <span className="text-sm font-medium text-gray-900 truncate max-w-xs">{rec.title}</span>
          </div>
        </td>
        <td className="px-3 py-3 text-xs text-gray-500">
          {categoryLabels[rec.category] || rec.category}
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-1">
            <ProviderIcon providerId={rec.provider_id} size={14} />
            <span className="text-xs text-gray-500">{rec.provider_id.toUpperCase()}</span>
          </div>
        </td>
        <td className="px-3 py-3 text-right">
          <span className="text-sm font-semibold text-green-600">
            {rec.estimated_monthly_savings > 0 ? formatCurrency(rec.estimated_monthly_savings) : '-'}
          </span>
        </td>
        <td className="px-3 py-3">
          <ConfidenceDots level={rec.confidence} />
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => onImplemented(rec.id)}
              className="p-1 rounded hover:bg-green-50 text-green-600"
              title="Mark as done"
            >
              <CheckCircle className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDismiss(rec.id)}
              className="p-1 rounded hover:bg-gray-100 text-gray-400"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  // Full card mode
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-l-4 ${priority.border} hover:shadow-md transition-all ${isDimmed ? 'opacity-60' : ''}`}>
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {selectable && (
              <div className="flex-shrink-0 mt-1">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggleSelect?.(rec.id)}
                  className="rounded border-gray-300 text-accent-600 focus:ring-accent-500"
                />
              </div>
            )}
            <div className="flex-shrink-0 mt-0.5">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <CategoryIcon className="w-4 h-4 text-gray-600" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priority.badge}`}>
                  {priority.text}
                </span>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {categoryLabels[rec.category] || rec.category}
                </span>
                <span className="flex items-center gap-1">
                  <ProviderIcon providerId={rec.provider_id} size={14} />
                  <span className="text-xs text-gray-500">{rec.provider_id.toUpperCase()}</span>
                </span>
                <ConfidenceDots level={rec.confidence} />
                {isAIEnhanced && (
                  <span className="flex items-center gap-0.5 text-xs text-purple-600">
                    <Sparkles className="w-3 h-3" />
                    AI
                  </span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-gray-900">{rec.title}</h3>
              <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
            </div>
          </div>

          {/* Savings badge */}
          {rec.estimated_monthly_savings > 0 && (
            <div className="flex-shrink-0 text-right">
              <div className="text-lg font-bold text-green-600">
                {formatCurrency(rec.estimated_monthly_savings)}
              </div>
              <div className="text-xs text-gray-500">/month savings</div>
              {rec.estimated_savings_percent > 0 && (
                <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                  -{rec.estimated_savings_percent}%
                </span>
              )}
            </div>
          )}
        </div>

        {/* Resource details + cost comparison */}
        {(rec.service_name || rec.resource_name || rec.resource_id || rec.current_cost > 0) && (
          <div className="mt-3 ml-11 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            {rec.service_name && <span>{rec.service_name}</span>}
            {rec.region && <span>{rec.region}</span>}
            {(rec.resource_name || rec.resource_id) && (
              <span className="font-mono text-gray-400 truncate max-w-[200px]">
                {rec.resource_name || rec.resource_id}
              </span>
            )}
            {rec.current_cost > 0 && (
              <span className="flex items-center gap-1.5 font-medium">
                <span className="text-gray-700">{formatCurrency(rec.current_cost)}</span>
                <ArrowRight className="w-3 h-3 text-gray-400" />
                <span className="text-green-600">{formatCurrency(Math.max(0, potentialCost))}</span>
              </span>
            )}
          </div>
        )}

        {/* Action */}
        <div className="mt-3 ml-11 p-2.5 bg-blue-50 rounded-md">
          <p className="text-sm text-blue-800">
            <span className="font-medium">Action: </span>{rec.action}
          </p>
        </div>

        {/* Footer */}
        <div className="mt-3 ml-11 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            <span>Detected {new Date(rec.first_detected_at).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onImplemented(rec.id)}
              className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 px-2 py-1 rounded transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Done
            </button>
            <button
              onClick={() => onDismiss(rec.id)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-2 py-1 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Dismiss
            </button>
            {rec.evidence && Object.keys(rec.evidence).length > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-2 py-1 rounded transition-colors"
              >
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                Evidence
              </button>
            )}
          </div>
        </div>

        {/* Grouped evidence */}
        {expanded && rec.evidence && (
          <div className="mt-3 ml-11 space-y-2">
            {groupEvidence(rec.evidence).map(group => (
              <div
                key={group.label}
                className={`p-3 rounded-md text-xs ${
                  group.color === 'purple'
                    ? 'bg-purple-50 border border-purple-200'
                    : 'bg-gray-50 border border-gray-200'
                }`}
              >
                <h4 className={`font-medium mb-2 ${
                  group.color === 'purple' ? 'text-purple-700' : 'text-gray-700'
                }`}>
                  {group.label === 'AI Insights' && <Sparkles className="w-3 h-3 inline mr-1" />}
                  {group.label}
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {group.entries.map(([key, value]) => (
                    <div key={key} className={group.label === 'AI Insights' ? 'col-span-2' : ''}>
                      <span className="text-gray-500">{key.replace(/_/g, ' ')}:</span>
                      <span className="ml-1 font-medium">
                        {typeof value === 'number' ? value.toFixed(2) : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
