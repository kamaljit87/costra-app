import { useCurrency } from '../contexts/CurrencyContext'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface CostDataPoint {
  date: string
  cost: number
}

interface ProviderCostChartProps {
  providerName: string
  providerIcon: string
  data: CostDataPoint[]
  currentMonth: number
  lastMonth: number
  period: '30days' | '60days' | '120days' | '180days' | '4months' | '6months' | 'custom'
}

export default function ProviderCostChart({
  providerName,
  providerIcon,
  data,
  currentMonth,
  lastMonth,
  period,
}: ProviderCostChartProps) {
  const { formatCurrency, convertAmount } = useCurrency()

  const changePercent = lastMonth > 0
    ? ((currentMonth - lastMonth) / lastMonth) * 100
    : 0

  // Format chart data
  const chartData = data.map(point => ({
    ...point,
    cost: convertAmount(point.cost),
  }))

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">{providerIcon}</span>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{providerName}</h3>
            <p className="text-sm text-gray-600">
              {period === '30days' && 'Last 30 Days'}
              {period === '60days' && 'Last 60 Days'}
              {period === '120days' && 'Last 120 Days'}
              {period === '180days' && 'Last 180 Days'}
              {period === '4months' && 'Last 4 Months'}
              {period === '6months' && 'Last 6 Months'}
              {period === 'custom' && 'Custom Date Range'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">
            {formatCurrency(convertAmount(currentMonth))}
          </div>
          {changePercent !== 0 && (
            <div className={`flex items-center justify-end text-sm ${
              changePercent >= 0 ? 'text-red-600' : 'text-green-600'
            }`}>
              {changePercent >= 0 ? (
                <TrendingUp className="h-4 w-4 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 mr-1" />
              )}
              <span>{Math.abs(changePercent).toFixed(1)}%</span>
            </div>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={`color${providerName}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            stroke="#6b7280"
            fontSize={12}
            tickFormatter={(value) => {
              const date = new Date(value)
              // For daily data (30, 60, 120, 180 days, custom)
              if (period === '30days' || period === '60days' || period === '120days' || period === '180days' || period === 'custom') {
                // Show fewer labels for longer periods
                if (data.length > 60) {
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                }
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              }
              // For monthly data
              return date.toLocaleDateString('en-US', { month: 'short' })
            }}
          />
          <YAxis
            stroke="#6b7280"
            fontSize={12}
            tickFormatter={(value) => {
              if (value >= 1000) {
                return `$${(value / 1000).toFixed(1)}k`
              }
              return `$${value}`
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
            formatter={(value: number) => formatCurrency(value)}
            labelFormatter={(label) => {
              const date = new Date(label)
              return date.toLocaleDateString('en-US', { 
                month: 'long', 
                day: 'numeric',
                year: 'numeric'
              })
            }}
          />
          <Area
            type="monotone"
            dataKey="cost"
            stroke="#0ea5e9"
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#color${providerName})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
