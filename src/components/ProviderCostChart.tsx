import { useCurrency } from '../contexts/CurrencyContext'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { ProviderIcon } from './CloudProviderIcons'

interface CostDataPoint {
  date: string
  cost: number
}

interface ProviderCostChartProps {
  providerId: string
  providerName: string
  data: CostDataPoint[]
  currentMonth: number
  lastMonth: number
  period: '1month' | '2months' | '3months' | '4months' | '6months' | '12months' | 'custom' | 'monthly'
  isMonthlyView?: boolean
}

export default function ProviderCostChart({
  providerId,
  providerName,
  data,
  currentMonth,
  lastMonth,
  period,
  isMonthlyView = false,
}: ProviderCostChartProps) {
  const { formatCurrency, convertAmount, selectedCurrency } = useCurrency()

  const changePercent = lastMonth > 0
    ? ((currentMonth - lastMonth) / lastMonth) * 100
    : 0

  const getCurrencySymbol = () => {
    const symbols: Record<string, string> = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      INR: '₹',
      JPY: '¥',
      CAD: 'C$',
      AUD: 'A$',
      CNY: '¥',
      CHF: 'CHF',
      SGD: 'S$',
    }
    return symbols[selectedCurrency] || '$'
  }

  const chartData = data.map(point => ({
    ...point,
    cost: convertAmount(point.cost),
    originalCost: point.cost,
    monthLabel: isMonthlyView
      ? new Date(point.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      : point.date,
  }))

  const getPeriodLabel = () => {
    if (isMonthlyView) return 'Monthly Cost Overview'
    switch (period) {
      case '1month': return 'Last 1 Month'
      case '2months': return 'Last 2 Months'
      case '3months': return 'Last 3 Months'
      case '4months': return 'Last 4 Months'
      case '6months': return 'Last 6 Months'
      case '12months': return 'Last 1 Year'
      case 'custom': return 'Custom Date Range'
      case 'monthly': return 'Monthly View'
      default: return ''
    }
  }

  // Modern tooltip style
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const originalCost = payload[0]?.payload?.originalCost ?? payload[0]?.value
      const displayDate = isMonthlyView
        ? label
        : new Date(label).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

      return (
        <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-accent-200 p-4">
          <p className="text-sm text-accent-700 mb-1">{displayDate}</p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(originalCost)}</p>
        </div>
      )
    }
    return null
  }

  return (
      <div className="bg-white rounded-2xl border border-surface-200 shadow-card">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 flex items-center justify-center rounded-xl shrink-0">
            <ProviderIcon providerId={providerId} size={26} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">{providerName}</h3>
            <p className="text-sm text-gray-500">{getPeriodLabel()}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">
            {formatCurrency(convertAmount(currentMonth))}
          </div>
          {changePercent !== 0 && (
            <div className={`flex items-center justify-end text-sm font-medium ${
              changePercent >= 0 ? 'text-red-500' : 'text-emerald-500'
            }`}>
              {changePercent >= 0 ? (
                <TrendingUp className="h-4 w-4 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 mr-1" />
              )}
              <span>{changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}%</span>
            </div>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280} className="min-h-[200px] sm:min-h-[280px]">
        {isMonthlyView ? (
          <BarChart data={chartData} barCategoryGap="40%" maxBarSize={48}>
            <defs>
              <linearGradient id={`barGradient-${providerId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#656DEE" />
                <stop offset="100%" stopColor="#3F4ABF" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E9ECEF" opacity={0.6} vertical={false} />
            <XAxis
              dataKey="monthLabel"
              stroke="#8B91F3"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              dy={10}
              tick={{ fill: '#64748B' }}
            />
            <YAxis
              stroke="#8B91F3"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              dx={-10}
              tick={{ fill: '#64748B' }}
              tickFormatter={(value) => {
                const symbol = getCurrencySymbol()
                if (value >= 1000000) return `${symbol}${(value / 1000000).toFixed(1)}M`
                if (value >= 1000) return `${symbol}${(value / 1000).toFixed(0)}k`
                return `${symbol}${value.toFixed(0)}`
              }}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: '#D8DAFC', opacity: 0.5 }}
            />
            <Bar
              dataKey="cost"
              fill={`url(#barGradient-${providerId})`}
              radius={[6, 6, 0, 0]}
              stroke="none"
            />
          </BarChart>
        ) : (
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={`areaGradient-${providerId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3F4ABF" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#3F4ABF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E9ECEF" opacity={0.6} vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#8B91F3"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              dy={10}
              tick={{ fill: '#64748B' }}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              }}
            />
            <YAxis
              stroke="#8B91F3"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              dx={-10}
              tick={{ fill: '#64748B' }}
              tickFormatter={(value) => {
                const symbol = getCurrencySymbol()
                if (value >= 1000000) return `${symbol}${(value / 1000000).toFixed(1)}M`
                if (value >= 1000) return `${symbol}${(value / 1000).toFixed(0)}k`
                return `${symbol}${value.toFixed(0)}`
              }}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: '#3F4ABF', strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            <Area
              type="monotone"
              dataKey="cost"
              stroke="#3F4ABF"
              strokeWidth={2.5}
              fill={`url(#areaGradient-${providerId})`}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
