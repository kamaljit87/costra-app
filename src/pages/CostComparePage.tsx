import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useCurrency } from '../contexts/CurrencyContext'
import { useNotification } from '../contexts/NotificationContext'
import { costDataAPI, cloudProvidersAPI, syncAPI } from '../services/api'
import { CostData, getCostData } from '../services/costService'
import Layout from '../components/Layout'
import Breadcrumbs from '../components/Breadcrumbs'
import { ProviderIcon, getProviderColor } from '../components/CloudProviderIcons'
import {
  ArrowLeftRight,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Plus,
  X,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface ServiceCost {
  name: string
  cost: number
  change: number
}

interface PanelData {
  id: string
  providerId: string
  month: number
  year: number
  totalCost: number
  services: ServiceCost[]
  dailyData: { date: string; cost: number }[]
  isLoading: boolean
  /** True when the selected month has no stored data — show "No data" instead of wrong data */
  noData?: boolean
  /** Set when we tried to fetch this month but the request failed */
  fetchMonthError?: string
}

// Generate last 12 months options
function getMonthOptions(): { label: string; month: number; year: number }[] {
  const options: { label: string; month: number; year: number }[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    options.push({
      label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      month: d.getMonth() + 1,
      year: d.getFullYear(),
    })
  }
  return options
}

function getMonthDateRange(month: number, year: number) {
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 0))
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  }
}

export default function CostComparePage() {
  const { isDemoMode } = useAuth()
  const { formatCurrency, convertAmount, selectedCurrency } = useCurrency()
  const { showError } = useNotification()

  const [providers, setProviders] = useState<{ id: string; name: string }[]>([])
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [allCostData, setAllCostData] = useState<CostData[]>([])

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const [panels, setPanels] = useState<PanelData[]>([])
  const nextPanelId = useRef(0)
  const createPanelId = () => `panel-${nextPanelId.current++}`

  const monthOptions = getMonthOptions()

  // Load initial data - providers list from both cost data AND configured providers
  useEffect(() => {
    const load = async () => {
      try {
        const [data, providersResponse] = await Promise.all([
          getCostData(isDemoMode),
          isDemoMode
            ? Promise.resolve({ providers: [] })
            : cloudProvidersAPI.getCloudProviders().catch(() => ({ providers: [] })),
        ])
        setAllCostData(data)

        // Build a deduplicated provider list from both sources
        const providerMap = new Map<string, string>()

        // Add providers from cost data
        data.forEach((d) => providerMap.set(d.provider.id, d.provider.name))

        // Add configured providers (may have providers with no cost data yet)
        const configured = (providersResponse as any).providers || []
        configured
          .filter((p: any) => p.isActive)
          .forEach((p: any) => {
            if (!providerMap.has(p.providerId)) {
              providerMap.set(p.providerId, p.providerName)
            }
          })

        const providerList = Array.from(providerMap.entries()).map(([id, name]) => ({ id, name }))
        setProviders(providerList)

        // Auto-create one panel per provider
        const initialPanels: PanelData[] = providerList.map((provider) => ({
          id: createPanelId(),
          providerId: provider.id,
          month: currentMonth,
          year: currentYear,
          totalCost: 0,
          services: [],
          dailyData: [],
          isLoading: false,
        }))

        // Fallback: if fewer than 2 providers, pad with empty panels
        while (initialPanels.length < 2) {
          initialPanels.push({
            id: createPanelId(),
            providerId: '',
            month: currentMonth,
            year: currentYear,
            totalCost: 0,
            services: [],
            dailyData: [],
            isLoading: false,
          })
        }

        setPanels(initialPanels)
      } catch (error) {
        console.error('Failed to load providers:', error)
        showError('Load Failed', 'Could not load cloud provider data.')
      } finally {
        setIsInitialLoading(false)
      }
    }
    load()
  }, [isDemoMode])

  // Fetch data for a panel
  const fetchPanelData = useCallback(
    async (panelId: string, providerId: string, month: number, year: number) => {
      if (!providerId) return

      setPanels((prev) =>
        prev.map((p) => (p.id === panelId ? { ...p, isLoading: true } : p))
      )

      try {
        const { startDate, endDate } = getMonthDateRange(month, year)
        const isCurrentMonth = month === currentMonth && year === currentYear

        if (isDemoMode) {
          // In demo mode, use existing mock data with slight variations for different months
          const providerData = allCostData.find((d) => d.provider.id === providerId)
          if (providerData) {
            const monthFactor = isCurrentMonth ? 1 : 0.85 + Math.random() * 0.3
            const dailyData = providerData.chartData1Month.map((d) => ({
              date: d.date,
              cost: d.cost * monthFactor,
            }))
            setPanels((prev) =>
              prev.map((p) =>
                p.id === panelId
                  ? {
                      ...p,
                      totalCost: providerData.currentMonth * monthFactor,
                      services: providerData.services.map((s) => ({
                        ...s,
                        cost: s.cost * monthFactor,
                      })),
                      dailyData,
                      isLoading: false,
                    }
                  : p
              )
            )
          } else {
            setPanels((prev) =>
              prev.map((p) => (p.id === panelId ? { ...p, isLoading: false } : p))
            )
          }
          return
        }

        // Fetch daily data, services, cost data, and (for historical months) the accurate
        // monthly total directly from the cloud provider API.
        const fetchList: [Promise<any>, Promise<any>, Promise<any>, Promise<any>?] = [
          costDataAPI.getCostData(month, year),
          costDataAPI.getDailyCostData(providerId, startDate, endDate),
          costDataAPI.getServicesForDateRange(providerId, startDate, endDate),
        ]
        if (!isCurrentMonth) {
          // Fetch the accurate monthly total directly from AWS Cost Explorer
          fetchList.push(
            costDataAPI.getMonthlyTotal(providerId, year, month).catch(() => null)
          )
        }

        const [costResponse, dailyResponse, servicesResponse, monthlyTotalResponse] =
          await Promise.all(fetchList)

        const noData = !!(servicesResponse as any).noData
        if (noData) {
          const fetchKey = `${panelId}-${providerId}-${month}-${year}`
          const alreadyTried = fetchMonthAttemptedRef.current.has(fetchKey)
          if (!alreadyTried) {
            fetchMonthAttemptedRef.current.add(fetchKey)
            setPanels((prev) =>
              prev.map((p) =>
                p.id === panelId ? { ...p, isLoading: true, noData: true, fetchMonthError: undefined } : p
              )
            );
            try {
              const fetchRes = await syncAPI.fetchMonth(providerId, month, year)
              if (fetchRes.results?.length > 0) {
                const firstError = (fetchRes as any).errors?.[0]?.error
                await new Promise((r) => setTimeout(r, 800))
                const [costRes, dailyRes, servicesRes, monthlyRes] = await Promise.all([
                  costDataAPI.getCostData(month, year),
                  costDataAPI.getDailyCostData(providerId, startDate, endDate),
                  costDataAPI.getServicesForDateRange(providerId, startDate, endDate),
                  !isCurrentMonth ? costDataAPI.getMonthlyTotal(providerId, year, month).catch(() => null) : Promise.resolve(null),
                ])
                const stillNoData = !!(servicesRes as any).noData
                if (!stillNoData && Array.isArray((servicesRes as any).services)) {
                  const costData = (costRes as any).costData || []
                  const providerCost = costData.find((c: any) => c.provider?.id === providerId || c.provider_code === providerId)
                  const dailyData = ((dailyRes as any).dailyData || []).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  const services = ((servicesRes as any).services || []).map((s: any) => ({ name: s.name, cost: s.cost, change: s.change || 0 }))
                  let totalCost: number
                  if (isCurrentMonth && providerCost) totalCost = providerCost.currentMonth
                  else if ((monthlyRes as any)?.total != null) totalCost = (monthlyRes as any).total
                  else totalCost = dailyData.reduce((sum: number, d: any) => sum + (d.cost || 0), 0)
                  setPanels((prev) =>
                    prev.map((p) =>
                      p.id === panelId
                        ? { ...p, totalCost, services, dailyData, isLoading: false, noData: false, fetchMonthError: undefined }
                        : p
                    )
                  )
                  return
                }
                if (stillNoData) {
                  setPanels((prev) =>
                    prev.map((p) =>
                      p.id === panelId
                        ? { ...p, isLoading: false, noData: true, fetchMonthError: firstError || 'Data was fetched but not available yet. Try "Fetch data for this month" again.' }
                        : p
                    )
                  )
                  return
                }
              } else {
                const errMsg = (fetchRes as any).error || (fetchRes as any).errors?.[0]?.error || 'Fetch did not return data.'
                setPanels((prev) =>
                  prev.map((p) =>
                    p.id === panelId ? { ...p, isLoading: false, noData: true, fetchMonthError: errMsg } : p
                  )
                )
                return
              }
            } catch (fetchErr: any) {
              setPanels((prev) =>
                prev.map((p) =>
                  p.id === panelId
                    ? {
                        ...p,
                        totalCost: 0,
                        services: [],
                        dailyData: [],
                        isLoading: false,
                        noData: true,
                        fetchMonthError: fetchErr?.message || fetchErr?.error || 'Fetch failed',
                      }
                    : p
                )
              )
              return
            }
          }
          setPanels((prev) =>
            prev.map((p) =>
              p.id === panelId
                ? {
                    ...p,
                    totalCost: 0,
                    services: [],
                    dailyData: [],
                    isLoading: false,
                    noData: true,
                  }
                : p
            )
          )
          return
        }

        const costData = costResponse.costData || []
        const providerCost = costData.find(
          (c: any) => c.provider.id === providerId || c.provider_code === providerId
        )
        const dailyData = (dailyResponse.dailyData || []).sort(
          (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
        )
        const services = ((servicesResponse.services || []) as any[]).map((s: any) => ({
          name: s.name,
          cost: s.cost,
          change: s.change || 0,
        }))

        let totalCost: number
        if (isCurrentMonth && providerCost) {
          totalCost = providerCost.currentMonth
        } else if (monthlyTotalResponse?.total != null) {
          totalCost = monthlyTotalResponse.total
        } else {
          totalCost = dailyData.reduce((sum: number, d: any) => sum + (d.cost || 0), 0)
        }

        setPanels((prev) =>
          prev.map((p) =>
            p.id === panelId
              ? { ...p, totalCost, services, dailyData, isLoading: false, noData: false }
              : p
          )
        )
      } catch (error) {
        console.error('Failed to fetch panel data:', error)
        setPanels((prev) =>
          prev.map((p) => (p.id === panelId ? { ...p, isLoading: false } : p))
        )
      }
    },
    [isDemoMode, allCostData, currentMonth, currentYear]
  )

  // Fetch data when panel selections change
  const prevPanelSelections = useRef<Record<string, string>>({})
  const fetchMonthAttemptedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    panels.forEach((panel) => {
      const key = `${panel.providerId}-${panel.month}-${panel.year}`
      if (panel.providerId && prevPanelSelections.current[panel.id] !== key) {
        prevPanelSelections.current[panel.id] = key
        fetchPanelData(panel.id, panel.providerId, panel.month, panel.year)
      }
    })
    const activeIds = new Set(panels.map((p) => p.id))
    Object.keys(prevPanelSelections.current).forEach((id) => {
      if (!activeIds.has(id)) delete prevPanelSelections.current[id]
    })
  }, [panels, fetchPanelData])

  // Panel management
  const addPanel = () => {
    setPanels((prev) => [
      ...prev,
      {
        id: createPanelId(),
        providerId: '',
        month: currentMonth,
        year: currentYear,
        totalCost: 0,
        services: [],
        dailyData: [],
        isLoading: false,
      },
    ])
  }

  const removePanel = (panelId: string) => {
    setPanels((prev) => prev.filter((p) => p.id !== panelId))
  }

  const updatePanel = (panelId: string, updates: Partial<PanelData>) => {
    setPanels((prev) =>
      prev.map((p) => (p.id === panelId ? { ...p, ...updates } : p))
    )
  }

  const getCurrencySymbol = () => {
    const symbols: Record<string, string> = {
      USD: '$', EUR: '\u20ac', GBP: '\u00a3', INR: '\u20b9',
      JPY: '\u00a5', CAD: 'C$', AUD: 'A$', CNY: '\u00a5', CHF: 'CHF', SGD: 'S$',
    }
    return symbols[selectedCurrency] || '$'
  }

  // Loaded panels for comparison summary (only panels with data)
  const loadedPanels = panels.filter((p) => p.providerId && !p.isLoading && !p.noData)

  // Build service comparison data for N panels
  const serviceComparison = (() => {
    if (loadedPanels.length < 2) return []

    const serviceMap = new Map<string, Map<string, number>>()

    loadedPanels.forEach((panel) => {
      panel.services.forEach((s) => {
        if (!serviceMap.has(s.name)) {
          serviceMap.set(s.name, new Map())
        }
        serviceMap.get(s.name)!.set(panel.id, s.cost)
      })
    })

    return Array.from(serviceMap.entries())
      .map(([name, costsByPanel]) => {
        const maxCost = Math.max(...Array.from(costsByPanel.values()))
        return { name, costsByPanel, maxCost }
      })
      .sort((a, b) => b.maxCost - a.maxCost)
  })()

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-surface-200 p-3">
          <p className="text-xs text-gray-500 mb-1">
            {new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
          <p className="text-sm font-bold text-gray-900">
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      )
    }
    return null
  }

  const renderPanel = (panel: PanelData, index: number) => {
    const providerColor = panel.providerId ? getProviderColor(panel.providerId) : '#6B7280'
    const label = providers.find((p) => p.id === panel.providerId)?.name || `Panel ${index + 1}`

    return (
      <div className="card h-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 flex items-center justify-center rounded-lg shrink-0">
              {panel.providerId ? (
                <ProviderIcon providerId={panel.providerId} size={20} />
              ) : (
                <BarChart3 className="h-5 w-5 text-gray-400" />
              )}
            </div>
            <span className="text-sm font-semibold text-gray-700">{label}</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              removePanel(panel.id)
            }}
            className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50"
            title="Remove this panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Provider Selector */}
        <div className="mb-3">
          <label className="label text-xs">Cloud Provider</label>
          <select
            value={panel.providerId}
            onChange={(e) => updatePanel(panel.id, { providerId: e.target.value })}
            className="input text-sm"
          >
            <option value="">Select provider...</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Month Selector */}
        <div className="mb-4">
          <label className="label text-xs">Month</label>
          <select
            value={`${panel.month}-${panel.year}`}
            onChange={(e) => {
              const [m, y] = e.target.value.split('-').map(Number)
              updatePanel(panel.id, { month: m, year: y })
            }}
            className="input text-sm"
          >
            {monthOptions.map((opt) => (
              <option key={`${opt.month}-${opt.year}`} value={`${opt.month}-${opt.year}`}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Loading or Content */}
        {panel.isLoading ? (
          <div className="flex items-center justify-center h-48">
            <RefreshCw className="h-6 w-6 text-accent-500 animate-spin" />
          </div>
        ) : !panel.providerId ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
            Select a provider to view costs
          </div>
        ) : panel.noData ? (
          <div
            className="flex flex-col items-center justify-center h-48 text-gray-500 text-sm text-center px-4 rounded-xl border border-dashed border-gray-300 bg-gray-50/50"
            style={{ borderColor: `${providerColor}30` }}
          >
            <span className="font-medium text-gray-600">No data for this month</span>
            {panel.fetchMonthError ? (
              <span className="text-xs mt-1 text-amber-600">{panel.fetchMonthError}</span>
            ) : (
              <span className="text-xs mt-1">We don&apos;t have cost data for the selected month.</span>
            )}
            <button
              type="button"
              onClick={() => {
                fetchMonthAttemptedRef.current.delete(`${panel.id}-${panel.providerId}-${panel.month}-${panel.year}`)
                fetchPanelData(panel.id, panel.providerId, panel.month, panel.year)
              }}
              className="mt-3 px-3 py-1.5 text-xs font-medium text-accent-600 bg-accent-50 hover:bg-accent-100 rounded-lg transition-colors"
            >
              Fetch data for this month
            </button>
          </div>
        ) : (
          <>
            {/* Total Cost */}
            <div
              className="rounded-xl p-4 mb-4 border"
              style={{
                backgroundColor: `${providerColor}08`,
                borderColor: `${providerColor}25`,
              }}
            >
              <div className="text-xs font-medium text-gray-500 mb-1">Total Cost</div>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(panel.totalCost)}
              </div>
            </div>

            {/* Daily Cost Chart */}
            {panel.dailyData.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                  Daily Costs
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={panel.dailyData.map((d) => ({ ...d, cost: convertAmount(d.cost) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E9ECEF" opacity={0.6} vertical={false} />
                    <XAxis
                      dataKey="date"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#64748B' }}
                      tickFormatter={(v) => new Date(v).getDate().toString()}
                    />
                    <YAxis
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#64748B' }}
                      tickFormatter={(v) => {
                        const s = getCurrencySymbol()
                        return v >= 1000 ? `${s}${(v / 1000).toFixed(0)}k` : `${s}${v.toFixed(0)}`
                      }}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: `${providerColor}10` }} />
                    <Bar dataKey="cost" fill={providerColor} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Top Services */}
            {panel.services.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                  Top Services
                </div>
                <div className="space-y-2">
                  {panel.services.slice(0, 5).map((s) => (
                    <div key={s.name} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 truncate flex-1 mr-2">{s.name}</span>
                      <span className="font-semibold text-gray-900 whitespace-nowrap">
                        {formatCurrency(s.cost)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <Layout>
      <div className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <Breadcrumbs />

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-1">
                <ArrowLeftRight className="h-6 w-6 text-accent-600" />
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Cost Comparison</h1>
              </div>
              <p className="text-xs text-gray-500 ml-9">
                Compare costs across all your cloud providers and months
              </p>
            </div>
            {!isInitialLoading && providers.length > 0 && (
              <button
                onClick={addPanel}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-accent-600 hover:text-accent-700 bg-accent-50 hover:bg-accent-100 rounded-lg transition-all duration-150"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add</span>
              </button>
            )}
          </div>
        </div>

        {isInitialLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 text-accent-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Loading providers...</p>
            </div>
          </div>
        ) : providers.length === 0 ? (
          <div className="card text-center py-16">
            <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Providers Available</h3>
            <p className="text-gray-500 text-sm">
              Connect cloud providers from the dashboard to start comparing costs.
            </p>
          </div>
        ) : (
          <>
            {/* Provider Panels — horizontal scroll */}
            {panels.length > 0 ? (
              <div className="flex gap-4 lg:gap-6 mb-6 overflow-x-auto pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
                {panels.map((panel, index) => (
                  <div key={panel.id} className="min-w-[320px] max-w-[400px] flex-shrink-0">
                    {renderPanel(panel, index)}
                  </div>
                ))}
              </div>
            ) : (
              <div className="card text-center py-12 mb-6">
                <BarChart3 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm mb-3">No comparison panels</p>
                <button
                  onClick={addPanel}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 text-sm font-medium text-accent-600 bg-accent-50 hover:bg-accent-100 rounded-lg transition-all duration-150"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Panel</span>
                </button>
              </div>
            )}

            {/* Comparison Summary */}
            {loadedPanels.length >= 2 && (
              <div className="card animate-fade-in">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center space-x-2">
                  <ArrowLeftRight className="h-5 w-5 text-accent-600" />
                  <span>Comparison Summary</span>
                </h2>

                {/* Overall Costs per Provider */}
                <div className={`grid grid-cols-1 sm:grid-cols-2 ${
                  loadedPanels.length > 2 ? 'lg:grid-cols-3 xl:grid-cols-4' : 'lg:grid-cols-2'
                } gap-3 mb-6`}>
                  {loadedPanels.map((panel) => {
                    const providerName = providers.find((p) => p.id === panel.providerId)?.name || panel.providerId
                    const monthLabel = monthOptions.find((m) => m.month === panel.month && m.year === panel.year)?.label || ''
                    const pColor = getProviderColor(panel.providerId)
                    return (
                      <div
                        key={panel.id}
                        className="rounded-xl p-4 border text-center"
                        style={{ backgroundColor: `${pColor}08`, borderColor: `${pColor}25` }}
                      >
                        <div className="flex items-center justify-center space-x-2 mb-1">
                          <ProviderIcon providerId={panel.providerId} size={16} />
                          <span className="text-xs font-medium text-gray-500">{providerName}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 mb-1">{monthLabel}</div>
                        <div className="text-xl font-bold text-gray-900">
                          {formatCurrency(panel.totalCost)}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Cost Range Summary */}
                {(() => {
                  const sorted = [...loadedPanels].sort((a, b) => a.totalCost - b.totalCost)
                  const cheapest = sorted[0]
                  const mostExpensive = sorted[sorted.length - 1]
                  const spread = mostExpensive.totalCost - cheapest.totalCost
                  const cheapestName = providers.find((p) => p.id === cheapest.providerId)?.name || cheapest.providerId
                  const expensiveName = providers.find((p) => p.id === mostExpensive.providerId)?.name || mostExpensive.providerId

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                      <div className="bg-green-50 rounded-xl p-3 border border-green-200 text-center">
                        <div className="flex items-center justify-center space-x-1 mb-1">
                          <TrendingDown className="h-3.5 w-3.5 text-green-600" />
                          <span className="text-xs text-green-600 font-medium">Lowest Cost</span>
                        </div>
                        <div className="text-sm font-bold text-green-700">{cheapestName}</div>
                        <div className="text-lg font-bold text-green-800">{formatCurrency(cheapest.totalCost)}</div>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 text-center flex flex-col justify-center">
                        <div className="text-xs text-gray-500 font-medium mb-1">Cost Spread</div>
                        <div className="text-lg font-bold text-gray-900">{formatCurrency(spread)}</div>
                      </div>
                      <div className="bg-red-50 rounded-xl p-3 border border-red-200 text-center">
                        <div className="flex items-center justify-center space-x-1 mb-1">
                          <TrendingUp className="h-3.5 w-3.5 text-red-600" />
                          <span className="text-xs text-red-600 font-medium">Highest Cost</span>
                        </div>
                        <div className="text-sm font-bold text-red-700">{expensiveName}</div>
                        <div className="text-lg font-bold text-red-800">{formatCurrency(mostExpensive.totalCost)}</div>
                      </div>
                    </div>
                  )
                })()}

                {/* Service-Level Comparison */}
                {serviceComparison.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Service Breakdown</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-surface-200">
                            <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide sticky left-0 bg-white z-10">
                              Service
                            </th>
                            {loadedPanels.map((panel) => {
                              const name = providers.find((p) => p.id === panel.providerId)?.name || panel.providerId
                              const monthLabel = monthOptions.find((m) => m.month === panel.month && m.year === panel.year)?.label || ''
                              return (
                                <th key={panel.id} className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                                  <div className="flex flex-col items-end">
                                    <div className="flex items-center space-x-1">
                                      <ProviderIcon providerId={panel.providerId} size={12} />
                                      <span>{name}</span>
                                    </div>
                                    <span className="text-[10px] font-normal text-gray-400 normal-case tracking-normal">{monthLabel}</span>
                                  </div>
                                </th>
                              )
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {serviceComparison.slice(0, 15).map((row) => {
                            const costs = Array.from(row.costsByPanel.values()).filter((v) => v > 0)
                            const minCost = costs.length > 0 ? Math.min(...costs) : 0
                            const maxCost = costs.length > 0 ? Math.max(...costs) : 0

                            return (
                              <tr key={row.name} className="border-b border-surface-100">
                                <td className="py-2.5 pr-4 text-gray-700 font-medium sticky left-0 bg-white z-10">
                                  {row.name}
                                </td>
                                {loadedPanels.map((panel) => {
                                  const cost = row.costsByPanel.get(panel.id) || 0
                                  const isMin = cost > 0 && cost === minCost && costs.length > 1
                                  const isMax = cost > 0 && cost === maxCost && costs.length > 1
                                  return (
                                    <td
                                      key={panel.id}
                                      className={`py-2.5 px-3 text-right font-semibold whitespace-nowrap ${
                                        isMin ? 'text-green-600' : isMax ? 'text-red-600' : 'text-gray-900'
                                      }`}
                                    >
                                      {cost > 0 ? formatCurrency(cost) : '-'}
                                    </td>
                                  )
                                })}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
