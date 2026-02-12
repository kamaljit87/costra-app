import { useState } from 'react'
import {
  TrendingUp, Power, ArrowDownUp, Ticket, HardDrive,
  Network, Lightbulb, ArrowLeftRight, ChevronDown, ChevronUp,
  X, CheckCircle, Sparkles,
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

const confidenceLabels: Record<string, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
}

export default function RecommendationCard({ recommendation: rec, onDismiss, onImplemented }: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(false)
  const { formatCurrency } = useCurrency()

  const CategoryIcon = categoryIcons[rec.category] || Lightbulb
  const priority = priorityStyles[rec.priority] || priorityStyles.low
  const isAIEnhanced = rec.evidence?.ai_enhanced === true

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-l-4 ${priority.border} hover:shadow-md transition-shadow`}>
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
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
              <div className="text-xs text-gray-500">
                /month savings
              </div>
            </div>
          )}
        </div>

        {/* Action */}
        <div className="mt-3 ml-11 p-2.5 bg-blue-50 rounded-md">
          <p className="text-sm text-blue-800">
            <span className="font-medium">Action: </span>{rec.action}
          </p>
        </div>

        {/* Footer */}
        <div className="mt-3 ml-11 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>{confidenceLabels[rec.confidence] || rec.confidence}</span>
            {rec.service_name && <span>| {rec.service_name}</span>}
            {rec.region && <span>| {rec.region}</span>}
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
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-2 py-1 rounded transition-colors"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              Details
            </button>
          </div>
        </div>

        {/* Expanded evidence */}
        {expanded && rec.evidence && (
          <div className="mt-3 ml-11 p-3 bg-gray-50 rounded-md text-xs">
            <h4 className="font-medium text-gray-700 mb-2">Evidence</h4>
            <div className="grid grid-cols-2 gap-2">
              {rec.current_cost > 0 && (
                <div>
                  <span className="text-gray-500">Current cost:</span>
                  <span className="ml-1 font-medium">{formatCurrency(rec.current_cost)}/mo</span>
                </div>
              )}
              {rec.estimated_savings_percent > 0 && (
                <div>
                  <span className="text-gray-500">Savings:</span>
                  <span className="ml-1 font-medium text-green-600">{rec.estimated_savings_percent}%</span>
                </div>
              )}
              {rec.resource_id && (
                <div className="col-span-2">
                  <span className="text-gray-500">Resource:</span>
                  <span className="ml-1 font-mono">{rec.resource_id}</span>
                </div>
              )}
              {Object.entries(rec.evidence)
                .filter(([k]) => !['ai_enhanced', 'data_hash', 'ai_description', 'ai_action'].includes(k))
                .slice(0, 6)
                .map(([key, value]) => (
                  <div key={key}>
                    <span className="text-gray-500">{key.replace(/_/g, ' ')}:</span>
                    <span className="ml-1 font-medium">
                      {typeof value === 'number' ? value.toFixed(2) : String(value)}
                    </span>
                  </div>
                ))
              }
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
