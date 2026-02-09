import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useCurrency } from '../contexts/CurrencyContext'
import { useNotification } from '../contexts/NotificationContext'
import { costDataAPI, cloudProvidersAPI } from '../services/api'
import { CostData, getCostData } from '../services/costService'
import Layout from '../components/Layout'
import Breadcrumbs from '../components/Breadcrumbs'
import { ProviderIcon, getProviderColor } from '../components/CloudProviderIcons'
import {
  ArrowLeftRight,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
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
  providerId: string
  month: number
  year: number
  totalCost: number
  services: ServiceCost[]
  dailyData: { date: string; cost: number }[]
  isLoading: boolean
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
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0) // last day of month
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

  const [panelA, setPanelA] = useState<PanelData>({
    providerId: '',
    month: currentMonth,
    year: currentYear,
    totalCost: 0,
    services: [],
    dailyData: [],
    isLoading: false,
  })

  const [panelB, setPanelB] = useState<PanelData>({
    providerId: '',
    month: currentMonth,
    year: currentYear,
    totalCost: 0,
    services: [],
    dailyData: [],
    isLoading: false,
  })

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

        // Auto-select first two providers if available
        if (providerList.length >= 2) {
          setPanelA((p) => ({ ...p, providerId: providerList[0].id }))
          setPanelB((p) => ({ ...p, providerId: providerList[1].id }))
        } else if (providerList.length === 1) {
          setPanelA((p) => ({ ...p, providerId: providerList[0].id }))
          setPanelB((p) => ({ ...p, providerId: providerList[0].id }))
        }
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
    async (
      providerId: string,
      month: number,
      year: number,
      setPanel: React.Dispatch<React.SetStateAction<PanelData>>
    ) => {
      if (!providerId) return

      setPanel((p) => ({ ...p, isLoading: true }))

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
            setPanel((p) => ({
              ...p,
              totalCost: providerData.currentMonth * monthFactor,
              services: providerData.services.map((s) => ({
                ...s,
                cost: s.cost * monthFactor,
              })),
              dailyData,
              isLoading: false,
            }))
          } else {
            setPanel((p) => ({ ...p, isLoading: false }))
          }
          return
        }

        // Fetch cost data for the selected month/year
        const [costResponse, dailyResponse, servicesResponse] = await Promise.all([
          costDataAPI.getCostData(month, year),
          costDataAPI.getDailyCostData(providerId, startDate, endDate),
          costDataAPI.getServicesForDateRange(providerId, startDate, endDate),
        ])

        const costData = costResponse.costData || []
        const providerCost = costData.find(
          (c: any) => c.provider.id === providerId || c.provider_code === providerId
        )
        const dailyData = (dailyResponse.dailyData || []).sort(
          (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
        )
        const services = (servicesResponse.services || []).map((s: any) => ({
          name: s.name,
          cost: s.cost,
          change: s.change || 0,
        }))

        const totalCost = providerCost
          ? providerCost.currentMonth
          : dailyData.reduce((sum: number, d: any) => sum + (d.cost || 0), 0)

        setPanel((p) => ({
          ...p,
          totalCost,
          services,
          dailyData,
          isLoading: false,
        }))
      } catch (error) {
        console.error('Failed to fetch panel data:', error)
        setPanel((p) => ({ ...p, isLoading: false }))
      }
    },
    [isDemoMode, allCostData, currentMonth, currentYear]
  )

  // Fetch data when panel selections change
  useEffect(() => {
    if (panelA.providerId) {
      fetchPanelData(panelA.providerId, panelA.month, panelA.year, setPanelA)
    }
  }, [panelA.providerId, panelA.month, panelA.year, fetchPanelData])

  useEffect(() => {
    if (panelB.providerId) {
      fetchPanelData(panelB.providerId, panelB.month, panelB.year, setPanelB)
    }
  }, [panelB.providerId, panelB.month, panelB.year, fetchPanelData])

  const getCurrencySymbol = () => {
    const symbols: Record<string, string> = {
      USD: '$', EUR: '\u20ac', GBP: '\u00a3', INR: '\u20b9',
      JPY: '\u00a5', CAD: 'C$', AUD: 'A$', CNY: '\u00a5', CHF: 'CHF', SGD: 'S$',
    }
    return symbols[selectedCurrency] || '$'
  }

  // Cost difference
  const costDiff = panelA.totalCost - panelB.totalCost
  const costDiffPercent =
    panelB.totalCost > 0 ? ((costDiff) / panelB.totalCost) * 100 : 0

  // Build service comparison data
  const serviceComparison = (() => {
    const serviceMap = new Map<string, { a: number; b: number }>()
    panelA.services.forEach((s) => {
      const existing = serviceMap.get(s.name) || { a: 0, b: 0 }
      existing.a = s.cost
      serviceMap.set(s.name, existing)
    })
    panelB.services.forEach((s) => {
      const existing = serviceMap.get(s.name) || { a: 0, b: 0 }
      existing.b = s.cost
      serviceMap.set(s.name, existing)
    })
    return Array.from(serviceMap.entries())
      .map(([name, costs]) => ({ name, costA: costs.a, costB: costs.b, diff: costs.a - costs.b }))
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
  })()

  const providerAName = providers.find((p) => p.id === panelA.providerId)?.name || 'Provider A'
  const providerBName = providers.find((p) => p.id === panelB.providerId)?.name || 'Provider B'
  const monthALabel = monthOptions.find((m) => m.month === panelA.month && m.year === panelA.year)?.label || ''
  const monthBLabel = monthOptions.find((m) => m.month === panelB.month && m.year === panelB.year)?.label || ''

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-surface-200 p-3">
          <p className="text-xs text-gray-500 mb-1">
            {new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
          <p className="text-sm font-bold text-gray-900">
            {formatCurrency(convertAmount(payload[0].value))}
          </p>
        </div>
      )
    }
    return null
  }

  const renderPanel = (
    panel: PanelData,
    setPanel: React.Dispatch<React.SetStateAction<PanelData>>,
    label: string,
    color: string
  ) => {
    const providerColor = panel.providerId ? getProviderColor(panel.providerId) : '#6B7280'

    return (
      <div className="card flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-8 h-8 flex items-center justify-center rounded-lg shrink-0">
            {panel.providerId ? (
              <ProviderIcon providerId={panel.providerId} size={20} />
            ) : (
              <BarChart3 className="h-5 w-5 text-gray-400" />
            )}
          </div>
          <span className="text-sm font-semibold text-gray-700">{label}</span>
        </div>

        {/* Provider Selector */}
        <div className="mb-3">
          <label className="label text-xs">Cloud Provider</label>
          <select
            value={panel.providerId}
            onChange={(e) => setPanel((p) => ({ ...p, providerId: e.target.value }))}
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
              setPanel((p) => ({ ...p, month: m, year: y }))
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
                {formatCurrency(convertAmount(panel.totalCost))}
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
                    <Bar dataKey="cost" fill={color} radius={[3, 3, 0, 0]} />
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
                        {formatCurrency(convertAmount(s.cost))}
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
          <div className="flex items-center space-x-3 mb-1">
            <ArrowLeftRight className="h-6 w-6 text-accent-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Cost Comparison</h1>
          </div>
          <p className="text-xs text-gray-500 ml-9">
            Compare costs between cloud providers and across different months
          </p>
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
            {/* Side-by-side Panels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6">
              {renderPanel(panelA, setPanelA, 'Side A', getProviderColor(panelA.providerId || 'default'))}
              {renderPanel(panelB, setPanelB, 'Side B', getProviderColor(panelB.providerId || 'default'))}
            </div>

            {/* Comparison Summary */}
            {panelA.providerId && panelB.providerId && !panelA.isLoading && !panelB.isLoading && (
              <div className="card animate-fade-in">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center space-x-2">
                  <ArrowLeftRight className="h-5 w-5 text-accent-600" />
                  <span>Comparison Summary</span>
                </h2>

                {/* Overall Difference */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="bg-surface-50 rounded-xl p-4 border border-surface-200 text-center">
                    <div className="text-xs font-medium text-gray-500 mb-1">
                      {providerAName} ({monthALabel})
                    </div>
                    <div className="text-xl font-bold text-gray-900">
                      {formatCurrency(convertAmount(panelA.totalCost))}
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className={`rounded-xl px-4 py-3 text-center ${
                      costDiff > 0 ? 'bg-red-50 border border-red-200' :
                      costDiff < 0 ? 'bg-green-50 border border-green-200' :
                      'bg-gray-50 border border-gray-200'
                    }`}>
                      <div className="flex items-center justify-center space-x-1 mb-0.5">
                        {costDiff > 0 ? (
                          <TrendingUp className="h-4 w-4 text-red-500" />
                        ) : costDiff < 0 ? (
                          <TrendingDown className="h-4 w-4 text-green-500" />
                        ) : (
                          <Minus className="h-4 w-4 text-gray-400" />
                        )}
                        <span className={`text-sm font-bold ${
                          costDiff > 0 ? 'text-red-600' : costDiff < 0 ? 'text-green-600' : 'text-gray-500'
                        }`}>
                          {costDiff > 0 ? '+' : ''}{formatCurrency(convertAmount(Math.abs(costDiff)))}
                        </span>
                      </div>
                      {costDiffPercent !== 0 && (
                        <div className={`text-xs font-medium ${
                          costDiff > 0 ? 'text-red-500' : 'text-green-500'
                        }`}>
                          {costDiff > 0 ? '+' : ''}{costDiffPercent.toFixed(1)}%
                        </div>
                      )}
                      <div className="text-[10px] text-gray-400 mt-0.5">A vs B</div>
                    </div>
                  </div>
                  <div className="bg-surface-50 rounded-xl p-4 border border-surface-200 text-center">
                    <div className="text-xs font-medium text-gray-500 mb-1">
                      {providerBName} ({monthBLabel})
                    </div>
                    <div className="text-xl font-bold text-gray-900">
                      {formatCurrency(convertAmount(panelB.totalCost))}
                    </div>
                  </div>
                </div>

                {/* Service-Level Comparison */}
                {serviceComparison.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Service Breakdown</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-surface-200">
                            <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              Service
                            </th>
                            <th className="text-right py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              {providerAName}
                            </th>
                            <th className="text-right py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              {providerBName}
                            </th>
                            <th className="text-right py-2 pl-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              Difference
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {serviceComparison.slice(0, 10).map((row) => (
                            <tr key={row.name} className="border-b border-surface-100">
                              <td className="py-2.5 pr-4 text-gray-700 font-medium">{row.name}</td>
                              <td className="py-2.5 px-4 text-right text-gray-900 font-semibold">
                                {row.costA > 0 ? formatCurrency(convertAmount(row.costA)) : '-'}
                              </td>
                              <td className="py-2.5 px-4 text-right text-gray-900 font-semibold">
                                {row.costB > 0 ? formatCurrency(convertAmount(row.costB)) : '-'}
                              </td>
                              <td className={`py-2.5 pl-4 text-right font-semibold ${
                                row.diff > 0 ? 'text-red-600' : row.diff < 0 ? 'text-green-600' : 'text-gray-400'
                              }`}>
                                {row.diff !== 0 ? (
                                  <>
                                    {row.diff > 0 ? '+' : ''}{formatCurrency(convertAmount(row.diff))}
                                  </>
                                ) : (
                                  '-'
                                )}
                              </td>
                            </tr>
                          ))}
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
