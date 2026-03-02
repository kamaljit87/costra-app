import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'
import { useCurrency } from '../contexts/CurrencyContext'
import { anomalyEventsAPI } from '../services/api'
import Layout from '../components/Layout'
import Breadcrumbs from '../components/Breadcrumbs'
import { AlertTriangle, CheckCircle, Eye, Search, XCircle, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface AnomalyEvent {
  id: number
  provider_id: string
  service_name: string
  detected_date: string
  anomaly_type: 'spike' | 'drop' | 'trend'
  severity: 'low' | 'medium' | 'high' | 'critical'
  expected_cost: string
  actual_cost: string
  variance_percent: string
  root_cause: string
  contributing_services: Array<{ name: string; cost: number; change: number }>
  resolution_status: string
  created_at: string
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-blue-100 text-blue-800 border-blue-200',
}

const STATUS_STYLES: Record<string, { color: string; icon: typeof Clock }> = {
  open: { color: 'text-red-600', icon: AlertTriangle },
  acknowledged: { color: 'text-yellow-600', icon: Eye },
  investigating: { color: 'text-blue-600', icon: Search },
  resolved: { color: 'text-green-600', icon: CheckCircle },
  false_positive: { color: 'text-gray-500', icon: XCircle },
}

export default function AnomaliesPage() {
  const { isDemoMode } = useAuth()
  const { showSuccess, showError } = useNotification()
  const { formatCurrency } = useCurrency()
  const [events, setEvents] = useState<AnomalyEvent[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [severityFilter, setSeverityFilter] = useState<string>('')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => {
    if (!isDemoMode) loadEvents()
  }, [isDemoMode, statusFilter, severityFilter])

  const loadEvents = async () => {
    try {
      setIsLoading(true)
      const response = await anomalyEventsAPI.getEvents({
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
        limit: 50,
      })
      setEvents(response.events || [])
      setTotal(response.total || 0)
    } catch {
      showError('Failed to load anomaly events')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStatusChange = async (eventId: number, status: string) => {
    try {
      await anomalyEventsAPI.updateStatus(eventId, status)
      showSuccess(`Anomaly marked as ${status}`)
      await loadEvents()
    } catch {
      showError('Failed to update status')
    }
  }

  if (isDemoMode) {
    return (
      <Layout>
        <div className="p-6">
          <Breadcrumbs />
          <div className="text-center py-12 text-gray-500">Anomaly detection is not available in demo mode.</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto">
        <Breadcrumbs />
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-orange-500" />
              Cost Anomalies
            </h1>
            <p className="text-sm text-gray-500 mt-1">ML-powered anomaly detection with AI root cause analysis</p>
          </div>
          <div className="text-sm text-gray-500">{total} total events</div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white">
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
            <option value="false_positive">False Positive</option>
          </select>
          <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white">
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* Events List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 rounded-full border-2 border-gray-200 dark:border-gray-700 border-t-gray-600 animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border">
            <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
            <p className="text-lg font-medium text-gray-700">No anomalies detected</p>
            <p className="text-sm text-gray-500 mt-1">Your costs are within expected ranges. Anomalies are detected automatically after each sync.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map(event => {
              const variance = parseFloat(event.variance_percent) || 0
              const isExpanded = expandedId === event.id
              const StatusIcon = STATUS_STYLES[event.resolution_status]?.icon || Clock
              const statusColor = STATUS_STYLES[event.resolution_status]?.color || 'text-gray-500'

              return (
                <div key={event.id} className="bg-white rounded-xl border overflow-hidden">
                  {/* Header */}
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
                    onClick={() => setExpandedId(isExpanded ? null : event.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${variance > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                        {variance > 0 ? (
                          <ArrowUpRight className="h-5 w-5 text-red-500" />
                        ) : (
                          <ArrowDownRight className="h-5 w-5 text-green-500" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{event.service_name || 'Overall'}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${SEVERITY_STYLES[event.severity]}`}>
                            {event.severity}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span>{event.detected_date}</span>
                          <span>{event.provider_id}</span>
                          <span className={`flex items-center gap-1 ${statusColor}`}>
                            <StatusIcon className="h-3 w-3" />
                            {event.resolution_status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${variance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {variance > 0 ? '+' : ''}{variance.toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatCurrency(parseFloat(event.actual_cost))} vs {formatCurrency(parseFloat(event.expected_cost))} expected
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t px-4 py-4 bg-gray-50">
                      {/* Root Cause */}
                      {event.root_cause && (
                        <div className="mb-4">
                          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">AI Root Cause Analysis</h4>
                          <p className="text-sm text-gray-800 bg-white p-3 rounded-lg border">{event.root_cause}</p>
                        </div>
                      )}

                      {/* Contributing Services */}
                      {event.contributing_services && event.contributing_services.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Contributing Services</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {event.contributing_services.slice(0, 6).map((svc, i) => (
                              <div key={i} className="bg-white p-2 rounded border text-xs">
                                <div className="font-medium truncate">{svc.name}</div>
                                <div className={svc.change > 0 ? 'text-red-600' : 'text-green-600'}>
                                  {svc.change > 0 ? '+' : ''}{svc.change.toFixed(1)}%
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        {event.resolution_status === 'open' && (
                          <>
                            <button onClick={() => handleStatusChange(event.id, 'acknowledged')}
                              className="px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-lg text-xs font-medium hover:bg-yellow-100">
                              Acknowledge
                            </button>
                            <button onClick={() => handleStatusChange(event.id, 'investigating')}
                              className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100">
                              Investigate
                            </button>
                            <button onClick={() => handleStatusChange(event.id, 'false_positive')}
                              className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-100">
                              False Positive
                            </button>
                          </>
                        )}
                        {(event.resolution_status === 'acknowledged' || event.resolution_status === 'investigating') && (
                          <button onClick={() => handleStatusChange(event.id, 'resolved')}
                            className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100">
                            Mark Resolved
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
