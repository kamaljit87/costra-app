import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'
import { dashboardsAPI } from '../services/api'
import Layout from '../components/Layout'
import Breadcrumbs from '../components/Breadcrumbs'
import {
  LayoutGrid, Plus, Trash2, Share2, ArrowLeft,
  TrendingUp, PieChart, Wallet, AlertTriangle, BarChart3, DollarSign,
} from 'lucide-react'

interface Dashboard {
  id: number
  name: string
  description: string | null
  is_shared: boolean
  widget_count: number
  created_at: string
  creator_name?: string
}

interface Widget {
  id: number
  widget_type: string
  title: string
  config: Record<string, unknown>
  position: { x: number; y: number; w: number; h: number }
}

const WIDGET_TYPES = [
  { type: 'cost_trend', label: 'Cost Trend', icon: TrendingUp, description: 'Daily cost trend line chart' },
  { type: 'service_breakdown', label: 'Service Breakdown', icon: PieChart, description: 'Top services by cost' },
  { type: 'budget_status', label: 'Budget Status', icon: Wallet, description: 'Budget progress bars' },
  { type: 'anomaly_count', label: 'Anomaly Summary', icon: AlertTriangle, description: 'Open anomalies count' },
  { type: 'top_services', label: 'Top Services', icon: BarChart3, description: 'Top N cost services' },
  { type: 'cost_by_provider', label: 'Cost by Provider', icon: PieChart, description: 'Spend by cloud provider' },
  { type: 'custom_metric', label: 'KPI Metric', icon: DollarSign, description: 'Single number display' },
  { type: 'forecast', label: 'Forecast', icon: TrendingUp, description: 'Cost forecast chart' },
]

function WidgetCard({ widget, onRemove, data }: { widget: Widget; onRemove: () => void; data: Record<string, unknown> | null }) {
  const typeInfo = WIDGET_TYPES.find(t => t.type === widget.widget_type)
  const Icon = typeInfo?.icon || BarChart3

  const renderContent = () => {
    if (!data) return <div className="text-sm text-gray-400 text-center py-4">Loading...</div>

    switch (widget.widget_type) {
      case 'custom_metric': {
        const val = data.value as number
        return (
          <div className="text-center py-2">
            <p className="text-3xl font-bold text-accent-600">${(val || 0).toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-1">{(data.label as string) || 'Total Spend'}</p>
          </div>
        )
      }
      case 'anomaly_count': {
        const anomalies = (data.anomalies as { resolution_status: string; count: number }[]) || []
        const open = anomalies.find(a => a.resolution_status === 'open')?.count || 0
        const total = anomalies.reduce((s, a) => s + a.count, 0)
        return (
          <div className="text-center py-2">
            <p className="text-3xl font-bold text-yellow-600">{open}</p>
            <p className="text-xs text-gray-400 mt-1">Open / {total} total (30d)</p>
          </div>
        )
      }
      case 'top_services':
      case 'service_breakdown': {
        const services = (data.services as { service_name: string; cost: number }[]) || []
        return (
          <div className="space-y-1.5">
            {services.slice(0, 5).map((s, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-600 truncate flex-1">{s.service_name}</span>
                <span className="font-medium ml-2">${s.cost.toFixed(2)}</span>
              </div>
            ))}
            {services.length === 0 && <p className="text-sm text-gray-400 text-center">No data</p>}
          </div>
        )
      }
      case 'cost_by_provider': {
        const providers = (data.providers as { provider_id: string; cost: number }[]) || []
        return (
          <div className="space-y-1.5">
            {providers.map((p, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-600">{p.provider_id}</span>
                <span className="font-medium">${p.cost.toFixed(2)}</span>
              </div>
            ))}
            {providers.length === 0 && <p className="text-sm text-gray-400 text-center">No data</p>}
          </div>
        )
      }
      case 'budget_status': {
        const budgets = (data.budgets as { name: string; amount: number }[]) || []
        return (
          <div className="space-y-2">
            {budgets.slice(0, 3).map((b, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-gray-600">{b.name}</span>
                  <span className="font-medium">${b.amount.toFixed(0)}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className="bg-accent-500 h-1.5 rounded-full" style={{ width: '60%' }} />
                </div>
              </div>
            ))}
            {budgets.length === 0 && <p className="text-sm text-gray-400 text-center">No budgets</p>}
          </div>
        )
      }
      case 'cost_trend':
      case 'forecast': {
        const points = (data.points as { date: string; cost: number }[]) || (data.history as { date: string; cost: number }[]) || []
        if (points.length === 0) return <p className="text-sm text-gray-400 text-center py-4">No data</p>
        const max = Math.max(...points.map(p => p.cost), 1)
        return (
          <div className="flex items-end gap-0.5 h-20">
            {points.slice(-30).map((p, i) => (
              <div key={i} className="flex-1 bg-accent-400 rounded-t" title={`${p.date}: $${p.cost.toFixed(2)}`}
                style={{ height: `${(p.cost / max) * 100}%`, minHeight: '2px' }} />
            ))}
          </div>
        )
      }
      default:
        return <p className="text-sm text-gray-400 text-center py-4">Widget data</p>
    }
  }

  return (
    <div className="bg-white rounded-xl border p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium">{widget.title}</span>
        </div>
        <button onClick={onRemove} className="p-1 text-gray-300 hover:text-red-500">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex-1">{renderContent()}</div>
    </div>
  )
}

export default function CustomDashboardPage() {
  const { isDemoMode } = useAuth()
  const { showSuccess, showError } = useNotification()
  const { id } = useParams()
  const navigate = useNavigate()

  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [currentDashboard, setCurrentDashboard] = useState<Dashboard | null>(null)
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [widgetData, setWidgetData] = useState<Record<number, Record<string, unknown>>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showWidgetPicker, setShowWidgetPicker] = useState(false)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')

  useEffect(() => {
    if (!isDemoMode) {
      if (id) {
        loadDashboard(parseInt(id))
      } else {
        loadDashboards()
      }
    }
  }, [isDemoMode, id])

  const loadDashboards = async () => {
    try {
      setIsLoading(true)
      const res = await dashboardsAPI.list()
      setDashboards(res.dashboards || [])
    } catch {
      showError('Failed to load dashboards')
    } finally {
      setIsLoading(false)
    }
  }

  const loadDashboard = async (dashboardId: number) => {
    try {
      setIsLoading(true)
      const res = await dashboardsAPI.get(dashboardId)
      setCurrentDashboard(res.dashboard)
      setWidgets(res.widgets || [])
      // Fetch data for each widget
      const dataMap: Record<number, Record<string, unknown>> = {}
      for (const w of (res.widgets || [])) {
        try {
          const dataRes = await dashboardsAPI.getWidgetData({ widgetType: w.widget_type, config: w.config })
          dataMap[w.id] = dataRes.data
        } catch {
          dataMap[w.id] = {}
        }
      }
      setWidgetData(dataMap)
    } catch {
      showError('Failed to load dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!formName.trim()) return
    try {
      const res = await dashboardsAPI.create({ name: formName.trim(), description: formDescription.trim() || undefined })
      showSuccess('Dashboard created')
      setShowCreateForm(false)
      setFormName('')
      setFormDescription('')
      navigate(`/custom-dashboard/${res.dashboard.id}`)
    } catch {
      showError('Failed to create dashboard')
    }
  }

  const handleDelete = async (dashboardId: number) => {
    if (!confirm('Delete this dashboard and all its widgets?')) return
    try {
      await dashboardsAPI.delete(dashboardId)
      showSuccess('Dashboard deleted')
      if (id) {
        navigate('/custom-dashboard')
      } else {
        await loadDashboards()
      }
    } catch {
      showError('Failed to delete dashboard')
    }
  }

  const handleAddWidget = async (widgetType: string) => {
    if (!currentDashboard) return
    const typeInfo = WIDGET_TYPES.find(t => t.type === widgetType)
    try {
      const res = await dashboardsAPI.addWidget(currentDashboard.id, {
        widgetType,
        title: typeInfo?.label || widgetType,
        config: {},
        position: { x: 0, y: widgets.length * 3, w: 4, h: 3 },
      })
      setWidgets([...widgets, res.widget])
      // Fetch data for new widget
      try {
        const dataRes = await dashboardsAPI.getWidgetData({ widgetType, config: {} })
        setWidgetData(prev => ({ ...prev, [res.widget.id]: dataRes.data }))
      } catch {
        // silent
      }
      setShowWidgetPicker(false)
      showSuccess('Widget added')
    } catch {
      showError('Failed to add widget')
    }
  }

  const handleRemoveWidget = async (widgetId: number) => {
    if (!currentDashboard) return
    try {
      await dashboardsAPI.removeWidget(currentDashboard.id, widgetId)
      setWidgets(widgets.filter(w => w.id !== widgetId))
      showSuccess('Widget removed')
    } catch {
      showError('Failed to remove widget')
    }
  }

  const handleShare = async () => {
    if (!currentDashboard) return
    try {
      const res = await dashboardsAPI.share(currentDashboard.id)
      setCurrentDashboard(res.dashboard)
      showSuccess(res.dashboard.is_shared ? 'Dashboard shared with organization' : 'Dashboard unshared')
    } catch {
      showError('Failed to share dashboard')
    }
  }

  if (isDemoMode) {
    return (
      <Layout><div className="p-6"><Breadcrumbs />
        <div className="text-center py-12 text-gray-500">Custom dashboards are not available in demo mode.</div>
      </div></Layout>
    )
  }

  // Dashboard detail view
  if (currentDashboard) {
    return (
      <Layout>
        <div className="p-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => { setCurrentDashboard(null); navigate('/custom-dashboard') }}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
              <ArrowLeft className="h-4 w-4" /> Dashboards
            </button>
          </div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{currentDashboard.name}</h1>
              {currentDashboard.description && <p className="text-sm text-gray-500">{currentDashboard.description}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={handleShare}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${currentDashboard.is_shared ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                <Share2 className="h-4 w-4" /> {currentDashboard.is_shared ? 'Shared' : 'Share'}
              </button>
              <button onClick={() => setShowWidgetPicker(true)}
                className="flex items-center gap-2 px-4 py-2 bg-accent-600 text-white rounded-lg text-sm">
                <Plus className="h-4 w-4" /> Add Widget
              </button>
            </div>
          </div>

          {showWidgetPicker && (
            <div className="mb-6 p-5 bg-white rounded-xl border shadow-sm">
              <h3 className="font-semibold mb-4">Choose Widget Type</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {WIDGET_TYPES.map(wt => {
                  const Icon = wt.icon
                  return (
                    <button key={wt.type} onClick={() => handleAddWidget(wt.type)}
                      className="p-4 border rounded-xl hover:border-accent-400 hover:bg-accent-50 transition text-left">
                      <Icon className="h-5 w-5 text-accent-600 mb-2" />
                      <p className="text-sm font-medium">{wt.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{wt.description}</p>
                    </button>
                  )
                })}
              </div>
              <button onClick={() => setShowWidgetPicker(false)} className="mt-3 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 rounded-full border-2 border-gray-200 border-t-gray-600 animate-spin" />
            </div>
          ) : widgets.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border">
              <LayoutGrid className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-lg font-medium text-gray-700">Empty dashboard</p>
              <p className="text-sm text-gray-500 mt-1">Add widgets to start building your custom view.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {widgets.map(w => (
                <WidgetCard key={w.id} widget={w} data={widgetData[w.id] || null}
                  onRemove={() => handleRemoveWidget(w.id)} />
              ))}
            </div>
          )}
        </div>
      </Layout>
    )
  }

  // Dashboard list view
  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <Breadcrumbs />
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <LayoutGrid className="h-8 w-8 text-indigo-600" />
              Custom Dashboards
            </h1>
            <p className="text-sm text-gray-500 mt-1">Build personalized views with drag-and-drop cost widgets</p>
          </div>
          <button onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 text-sm">
            <Plus className="h-4 w-4" /> New Dashboard
          </button>
        </div>

        {showCreateForm && (
          <div className="mb-6 p-5 bg-white rounded-xl border shadow-sm">
            <h3 className="font-semibold mb-4">Create Dashboard</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Dashboard Name</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. Executive Overview" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description (optional)</label>
                <input type="text" value={formDescription} onChange={e => setFormDescription(e.target.value)}
                  placeholder="Brief description" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} className="px-4 py-2 bg-accent-600 text-white rounded-lg text-sm">Create</button>
              <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 rounded-full border-2 border-gray-200 border-t-gray-600 animate-spin" />
          </div>
        ) : dashboards.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border">
            <LayoutGrid className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-lg font-medium text-gray-700">No custom dashboards</p>
            <p className="text-sm text-gray-500 mt-1">Create a dashboard and add widgets for a personalized cost view.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dashboards.map(d => (
              <div key={d.id} className="bg-white rounded-xl border p-5 hover:border-accent-300 transition">
                <div className="flex items-center justify-between mb-2">
                  <button onClick={() => navigate(`/custom-dashboard/${d.id}`)} className="text-left flex-1">
                    <h3 className="font-semibold">{d.name}</h3>
                    {d.description && <p className="text-xs text-gray-500 mt-0.5">{d.description}</p>}
                  </button>
                  <button onClick={() => handleDelete(d.id)} className="p-1.5 text-gray-400 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>{d.widget_count} widgets</span>
                  {d.is_shared && <span className="text-green-600">Shared</span>}
                  <span>{new Date(d.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
