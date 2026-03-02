import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'
import { forecastsAPI } from '../services/api'
import Layout from '../components/Layout'
import Breadcrumbs from '../components/Breadcrumbs'
import { TrendingUp, Plus, Trash2, Play, ChevronDown, ChevronUp } from 'lucide-react'

interface ForecastMonth {
  month: string
  forecast: number
  confidenceLow: number
  confidenceHigh: number
}

interface Adjustment {
  type: 'growth_rate' | 'service_change' | 'pricing_change'
  value?: number
  unit?: string
  service?: string
  action?: string
  monthly_cost?: number
  change_percent?: number
}

interface Scenario {
  id: number
  name: string
  description: string
  adjustments: Adjustment[]
  forecast_months: number
  forecast_data: unknown
  ai_narrative: string
  created_at: string
}

export default function ForecastPage() {
  const { isDemoMode } = useAuth()
  const { showSuccess, showError } = useNotification()
  const [baseForecast, setBaseForecast] = useState<ForecastMonth[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [expandedScenario, setExpandedScenario] = useState<number | null>(null)
  const [scenarioResults, setScenarioResults] = useState<Record<number, {
    baseForecast: ForecastMonth[]
    scenarioForecast: ForecastMonth[]
    narrative: string
  }>>({})

  // Create form state
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formMonths, setFormMonths] = useState(6)
  const [formAdjustments, setFormAdjustments] = useState<Adjustment[]>([])
  const [adjType, setAdjType] = useState<Adjustment['type']>('growth_rate')
  const [adjValue, setAdjValue] = useState('')
  const [adjService, setAdjService] = useState('')
  const [adjAction, setAdjAction] = useState('add')

  useEffect(() => {
    if (!isDemoMode) loadData()
  }, [isDemoMode])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [forecastRes, scenariosRes] = await Promise.all([
        forecastsAPI.getBaseForecast(6),
        forecastsAPI.listScenarios(),
      ])
      setBaseForecast(forecastRes.forecast || [])
      setScenarios(scenariosRes.scenarios || [])
    } catch {
      showError('Failed to load forecast data')
    } finally {
      setIsLoading(false)
    }
  }

  const addAdjustment = () => {
    if (!adjValue && adjType !== 'service_change') return
    const adj: Adjustment = { type: adjType }

    if (adjType === 'growth_rate') {
      adj.value = parseFloat(adjValue)
      adj.unit = 'percent_monthly'
    } else if (adjType === 'service_change') {
      adj.service = adjService
      adj.action = adjAction
      if (adjAction === 'add') adj.monthly_cost = parseFloat(adjValue) || 0
    } else if (adjType === 'pricing_change') {
      adj.service = adjService
      adj.change_percent = parseFloat(adjValue)
    }

    setFormAdjustments([...formAdjustments, adj])
    setAdjValue('')
    setAdjService('')
  }

  const handleCreate = async () => {
    if (!formName.trim() || formAdjustments.length === 0) return
    try {
      const result = await forecastsAPI.createScenario({
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        adjustments: formAdjustments,
        forecastMonths: formMonths,
      })
      showSuccess('Scenario created')
      if (result.scenario) {
        setScenarioResults(prev => ({
          ...prev,
          [result.scenario.id]: {
            baseForecast: result.baseForecast,
            scenarioForecast: result.scenarioForecast,
            narrative: result.narrative,
          },
        }))
        setExpandedScenario(result.scenario.id)
      }
      setShowCreateForm(false)
      setFormName('')
      setFormDescription('')
      setFormAdjustments([])
      await loadData()
    } catch {
      showError('Failed to create scenario')
    }
  }

  const handleCompute = async (scenario: Scenario) => {
    try {
      const result = await forecastsAPI.computeScenario(scenario.id)
      setScenarioResults(prev => ({
        ...prev,
        [scenario.id]: {
          baseForecast: result.baseForecast,
          scenarioForecast: result.scenarioForecast,
          narrative: result.narrative,
        },
      }))
      setExpandedScenario(scenario.id)
      showSuccess('Scenario recomputed')
    } catch {
      showError('Failed to compute scenario')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this scenario?')) return
    try {
      await forecastsAPI.deleteScenario(id)
      showSuccess('Scenario deleted')
      await loadData()
    } catch {
      showError('Failed to delete scenario')
    }
  }

  const formatCurrency = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  const formatAdjustment = (adj: Adjustment) => {
    if (adj.type === 'growth_rate') return `Growth: ${adj.value}%/mo`
    if (adj.type === 'service_change') {
      if (adj.action === 'remove') return `Remove: ${adj.service}`
      return `Add: ${adj.service} ($${adj.monthly_cost}/mo)`
    }
    if (adj.type === 'pricing_change') return `${adj.service}: ${adj.change_percent}% pricing change`
    return JSON.stringify(adj)
  }

  // Find max forecast value for bar scaling
  const maxForecast = baseForecast.reduce((max, m) => Math.max(max, m.confidenceHigh || m.forecast), 0)

  if (isDemoMode) {
    return (
      <Layout><div className="p-6"><Breadcrumbs />
        <div className="text-center py-12 text-gray-500">Forecasts are not available in demo mode.</div>
      </div></Layout>
    )
  }

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <Breadcrumbs />
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-accent-600" />
              Forecast & Scenarios
            </h1>
            <p className="text-sm text-gray-500 mt-1">Multi-month cost projections with what-if scenario modeling</p>
          </div>
          <button onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 text-sm">
            <Plus className="h-4 w-4" /> New Scenario
          </button>
        </div>

        {/* Base Forecast */}
        <div className="bg-white rounded-xl border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Base Forecast (6 Months)</h2>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 rounded-full border-2 border-gray-200 dark:border-gray-700 border-t-gray-600 animate-spin" />
            </div>
          ) : baseForecast.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">Not enough historical data to generate a forecast. Sync your cloud costs first.</p>
          ) : (
            <div className="space-y-3">
              {baseForecast.map((m, i) => (
                <div key={i} className="flex items-center gap-4">
                  <span className="text-sm text-gray-600 w-24 shrink-0">{m.month}</span>
                  <div className="flex-1 relative h-8">
                    {/* Confidence range */}
                    <div className="absolute inset-y-0 bg-blue-50 rounded"
                      style={{
                        left: `${maxForecast ? (m.confidenceLow / maxForecast) * 100 : 0}%`,
                        width: `${maxForecast ? ((m.confidenceHigh - m.confidenceLow) / maxForecast) * 100 : 0}%`,
                      }} />
                    {/* Forecast bar */}
                    <div className="absolute inset-y-1 bg-accent-500 rounded"
                      style={{ width: `${maxForecast ? (m.forecast / maxForecast) * 100 : 0}%` }} />
                  </div>
                  <span className="text-sm font-medium w-28 text-right">{formatCurrency(m.forecast)}</span>
                  <span className="text-xs text-gray-400 w-40 text-right">
                    {formatCurrency(m.confidenceLow)} – {formatCurrency(m.confidenceHigh)}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                <div className="w-4 h-3 bg-accent-500 rounded" /> Forecast
                <div className="w-4 h-3 bg-blue-50 border rounded ml-2" /> Confidence range
              </div>
            </div>
          )}
        </div>

        {/* Create Scenario Form */}
        {showCreateForm && (
          <div className="mb-6 p-5 bg-white rounded-xl border shadow-sm">
            <h3 className="font-semibold mb-4">Create Scenario</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Scenario Name</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. Migrate to Aurora" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Forecast Months</label>
                <select value={formMonths} onChange={e => setFormMonths(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                  {[3, 6, 9, 12].map(m => <option key={m} value={m}>{m} months</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Description (optional)</label>
                <input type="text" value={formDescription} onChange={e => setFormDescription(e.target.value)}
                  placeholder="Brief description" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>

            {/* Adjustment Builder */}
            <div className="border rounded-lg p-4 mb-4">
              <h4 className="text-sm font-medium mb-3">Adjustments</h4>
              {formAdjustments.length > 0 && (
                <div className="mb-3 space-y-1">
                  {formAdjustments.map((adj, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded text-sm">
                      <span>{formatAdjustment(adj)}</span>
                      <button onClick={() => setFormAdjustments(formAdjustments.filter((_, j) => j !== i))}
                        className="text-red-400 hover:text-red-600 text-xs">Remove</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 items-end flex-wrap">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Type</label>
                  <select value={adjType} onChange={e => setAdjType(e.target.value as Adjustment['type'])}
                    className="px-3 py-2 border rounded-lg text-sm bg-white">
                    <option value="growth_rate">Growth Rate</option>
                    <option value="service_change">Service Change</option>
                    <option value="pricing_change">Pricing Change</option>
                  </select>
                </div>
                {(adjType === 'service_change' || adjType === 'pricing_change') && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Service</label>
                    <input type="text" value={adjService} onChange={e => setAdjService(e.target.value)}
                      placeholder="e.g. Amazon EC2" className="px-3 py-2 border rounded-lg text-sm w-40" />
                  </div>
                )}
                {adjType === 'service_change' && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Action</label>
                    <select value={adjAction} onChange={e => setAdjAction(e.target.value)}
                      className="px-3 py-2 border rounded-lg text-sm bg-white">
                      <option value="add">Add</option>
                      <option value="remove">Remove</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    {adjType === 'growth_rate' ? 'Rate (%)' : adjType === 'pricing_change' ? 'Change (%)' : adjAction === 'add' ? 'Monthly Cost ($)' : ''}
                  </label>
                  {!(adjType === 'service_change' && adjAction === 'remove') && (
                    <input type="number" value={adjValue} onChange={e => setAdjValue(e.target.value)}
                      placeholder="15" className="px-3 py-2 border rounded-lg text-sm w-24" />
                  )}
                </div>
                <button onClick={addAdjustment}
                  className="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">Add</button>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={handleCreate}
                disabled={!formName.trim() || formAdjustments.length === 0}
                className="px-4 py-2 bg-accent-600 text-white rounded-lg text-sm disabled:opacity-50">
                Create & Compute
              </button>
              <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        )}

        {/* Scenarios List */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Saved Scenarios ({scenarios.length})</h2>
          {scenarios.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border">
              <TrendingUp className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-lg font-medium text-gray-700">No scenarios yet</p>
              <p className="text-sm text-gray-500 mt-1">Create what-if scenarios to model cost changes.</p>
            </div>
          ) : (
            scenarios.map(scenario => {
              const isExpanded = expandedScenario === scenario.id
              const results = scenarioResults[scenario.id]
              const adjustments: Adjustment[] = typeof scenario.adjustments === 'string'
                ? JSON.parse(scenario.adjustments as unknown as string)
                : (scenario.adjustments || [])

              return (
                <div key={scenario.id} className="bg-white rounded-xl border">
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex-1 cursor-pointer" onClick={() => setExpandedScenario(isExpanded ? null : scenario.id)}>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{scenario.name}</span>
                        <span className="text-xs text-gray-400">{scenario.forecast_months}mo</span>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      </div>
                      {scenario.description && <p className="text-xs text-gray-500 mt-1">{scenario.description}</p>}
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {adjustments.map((adj, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">
                            {formatAdjustment(adj)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleCompute(scenario)}
                        className="p-1.5 text-gray-400 hover:text-accent-600" title="Recompute">
                        <Play className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(scenario.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded: show forecast comparison */}
                  {isExpanded && (
                    <div className="border-t px-4 pb-4 pt-3">
                      {results ? (
                        <>
                          {results.narrative && (
                            <div className="mb-4 p-3 bg-accent-50 rounded-lg text-sm text-accent-800">
                              {results.narrative}
                            </div>
                          )}
                          <div className="space-y-2">
                            <div className="grid grid-cols-4 gap-2 text-xs font-medium text-gray-500 px-1">
                              <span>Month</span>
                              <span className="text-right">Base</span>
                              <span className="text-right">Scenario</span>
                              <span className="text-right">Difference</span>
                            </div>
                            {results.scenarioForecast.map((sf, i) => {
                              const base = results.baseForecast[i]
                              const diff = sf.forecast - (base?.forecast || 0)
                              const diffPct = base?.forecast ? (diff / base.forecast) * 100 : 0
                              return (
                                <div key={i} className="grid grid-cols-4 gap-2 text-sm px-1 py-1 hover:bg-gray-50 rounded">
                                  <span className="text-gray-600">{sf.month}</span>
                                  <span className="text-right">{base ? formatCurrency(base.forecast) : '—'}</span>
                                  <span className="text-right font-medium">{formatCurrency(sf.forecast)}</span>
                                  <span className={`text-right ${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-green-600' : ''}`}>
                                    {diff > 0 ? '+' : ''}{formatCurrency(diff)} ({diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%)
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-4">
                          <button onClick={() => handleCompute(scenario)}
                            className="px-4 py-2 bg-accent-50 text-accent-600 rounded-lg text-sm hover:bg-accent-100">
                            <Play className="h-4 w-4 inline mr-1" /> Compute Forecast
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </Layout>
  )
}
