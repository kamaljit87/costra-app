import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'
import { adminAPI } from '../services/api'
import Layout from '../components/Layout'
import {
  ShieldCheck,
  Inbox,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  Circle,
  Loader2,
  Bug,
  HelpCircle,
  Lightbulb,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  User,
  Mail,
  Globe,
  Calendar,
} from 'lucide-react'

interface Ticket {
  id: number
  name: string
  email: string
  category: string
  subject: string
  message: string
  status: string
  user_id: number | null
  user_name: string | null
  user_email: string | null
  ip_address: string | null
  user_agent: string | null
  submitted_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Circle }> = {
  open: { label: 'Open', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: Circle },
  in_progress: { label: 'In Progress', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', icon: Clock },
  resolved: { label: 'Resolved', color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: CheckCircle2 },
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Bug }> = {
  bug_report: { label: 'Bug Report', icon: Bug },
  help: { label: 'Help / Support', icon: HelpCircle },
  feature_request: { label: 'Feature Request', icon: Lightbulb },
  other: { label: 'Other', icon: MoreHorizontal },
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.open
  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${config.bg} ${config.color}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  )
}

function CategoryBadge({ category }: { category: string }) {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other
  const Icon = config.icon
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  )
}

export default function AdminTicketsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { showSuccess, showError } = useNotification()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  // Redirect non-admins
  useEffect(() => {
    if (user && !user.isAdmin) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, navigate])

  useEffect(() => {
    fetchTickets()
  }, [page, statusFilter, categoryFilter])

  const fetchTickets = async () => {
    setIsLoading(true)
    try {
      const result = await adminAPI.getTickets({
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
        page,
      })
      setTickets(result.tickets || [])
      setTotal(result.total || 0)
      setTotalPages(result.totalPages || 1)
    } catch (err: any) {
      showError(err.message || 'Failed to load tickets')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStatusChange = async (ticketId: number, newStatus: string) => {
    setUpdatingId(ticketId)
    try {
      await adminAPI.updateTicketStatus(ticketId, newStatus)
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus } : t))
      showSuccess(`Ticket #${ticketId} marked as ${STATUS_CONFIG[newStatus]?.label || newStatus}`)
    } catch (err: any) {
      showError(err.message || 'Failed to update status')
    } finally {
      setUpdatingId(null)
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <Layout>
      <Helmet>
        <title>Admin - Support Tickets | Costra</title>
      </Helmet>

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-accent-600" />
            Support Tickets
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} total ticket{total !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className="px-3 py-2 text-sm border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500/60"
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
            className="px-3 py-2 text-sm border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500/60"
          >
            <option value="">All Categories</option>
            <option value="bug_report">Bug Report</option>
            <option value="help">Help / Support</option>
            <option value="feature_request">Feature Request</option>
            <option value="other">Other</option>
          </select>

          {(statusFilter || categoryFilter) && (
            <button
              onClick={() => { setStatusFilter(''); setCategoryFilter(''); setPage(1) }}
              className="text-xs text-accent-600 hover:text-accent-700 underline underline-offset-2"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Ticket List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 text-accent-600 animate-spin" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <Inbox className="h-10 w-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No tickets found</p>
            <p className="text-gray-400 text-sm mt-1">
              {statusFilter || categoryFilter ? 'Try changing the filters' : 'No contact submissions yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => {
              const isExpanded = expandedId === ticket.id

              return (
                <div
                  key={ticket.id}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden transition-shadow hover:shadow-sm"
                >
                  {/* Ticket row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                    className="w-full text-left px-5 py-4 flex items-center gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-400 font-mono">#{ticket.id}</span>
                        <CategoryBadge category={ticket.category} />
                      </div>
                      <h3 className="font-medium text-gray-900 truncate">{ticket.subject}</h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {ticket.name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(ticket.submitted_at)}
                        </span>
                      </div>
                    </div>

                    <StatusBadge status={ticket.status} />

                    {isExpanded
                      ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" />
                      : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                    }
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-gray-100">
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Message */}
                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Message</label>
                          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-800 whitespace-pre-wrap">
                            {ticket.message}
                          </div>
                        </div>

                        {/* Metadata */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-700">{ticket.email}</span>
                          </div>
                          {ticket.user_id && (
                            <div className="flex items-center gap-2 text-sm">
                              <User className="h-4 w-4 text-gray-400" />
                              <span className="text-gray-700">
                                Registered user: {ticket.user_name || ticket.user_email || `#${ticket.user_id}`}
                              </span>
                            </div>
                          )}
                          {ticket.ip_address && (
                            <div className="flex items-center gap-2 text-sm">
                              <Globe className="h-4 w-4 text-gray-400" />
                              <span className="text-gray-500">{ticket.ip_address}</span>
                            </div>
                          )}
                        </div>

                        {/* Status update */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Update Status</label>
                          <div className="flex gap-2 flex-wrap">
                            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                              <button
                                key={key}
                                onClick={() => handleStatusChange(ticket.id, key)}
                                disabled={ticket.status === key || updatingId === ticket.id}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 ${
                                  ticket.status === key
                                    ? `${config.bg} ${config.color}`
                                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                              >
                                {updatingId === ticket.id ? '...' : config.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <span className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
