import { useCurrency } from '../contexts/CurrencyContext'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { ProviderIcon, getProviderColor } from './CloudProviderIcons'

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
  period: '30days' | '60days' | '120days' | '180days' | '4months' | '6months' | 'custom' | 'monthly'
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

  // Get currency symbol for Y-axis
  const getCurrencySymbol = () => {
    const symbols: Record<string, string> = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      INR: '₹',
      JPY: '¥',
      CAD: 'C$',
      AUD: 'A$',
    }
    return symbols[selectedCurrency] || '$'
  }

  // Format chart data - convert to selected currency for display
  // Note: Don't double-convert! The tooltip uses formatCurrency which expects original USD values
  const chartData = data.map(point => ({
    ...point,
    // Store converted cost for chart display
    cost: convertAmount(point.cost),
    // Store original cost for tooltip formatting
    originalCost: point.cost,
    // Add month label for monthly view
    monthLabel: isMonthlyView 
      ? new Date(point.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      : point.date,
  }))

  const getPeriodLabel = () => {
    if (isMonthlyView) return 'Monthly Cost Overview'
    switch (period) {
      case '30days': return 'Last 30 Days'
      case '60days': return 'Last 60 Days'
      case '120days': return 'Last 120 Days'
      case '180days': return 'Last 180 Days'
      case '4months': return 'Last 4 Months'
      case '6months': return 'Last 6 Months'
      case 'custom': return 'Custom Date Range'
      case 'monthly': return 'Monthly View'
      default: return ''
    }
  }

  const providerColor = getProviderColor(providerId)

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div 
            className="w-10 h-10 flex items-center justify-center rounded-lg"
            style={{ backgroundColor: `${providerColor}15` }}
          >
            <ProviderIcon providerId={providerId} size={24} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{providerName}</h3>
            <p className="text-sm text-gray-600">{getPeriodLabel()}</p>
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
        {isMonthlyView ? (
          // Bar chart for monthly view
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="monthLabel"
              stroke="#6b7280"
              fontSize={12}
            />
            <YAxis
              stroke="#6b7280"
              fontSize={12}
              tickFormatter={(value) => {
                const symbol = getCurrencySymbol()
                if (value >= 1000) {
                  return `${symbol}${(value / 1000).toFixed(1)}k`
                }
                return `${symbol}${value.toFixed(2)}`
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
              }}
              formatter={(value: number, _name: string, props: any) => {
                // Use originalCost to avoid double conversion
                const originalCost = props.payload?.originalCost ?? value
                return [formatCurrency(originalCost), 'Monthly Cost']
              }}
              labelFormatter={(label) => label}
            />
            <Bar 
              dataKey="cost" 
              fill="#0ea5e9" 
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        ) : (
          // Area chart for daily view
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
                if (data.length > 60) {
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                }
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              }}
            />
            <YAxis
              stroke="#6b7280"
              fontSize={12}
              tickFormatter={(value) => {
                const symbol = getCurrencySymbol()
                if (value >= 1000) {
                  return `${symbol}${(value / 1000).toFixed(1)}k`
                }
                return `${symbol}${value.toFixed(2)}`
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
              }}
              formatter={(value: number, _name: string, props: any) => {
                // Use originalCost to avoid double conversion
                const originalCost = props.payload?.originalCost ?? value
                return [formatCurrency(originalCost), 'Daily Cost']
              }}
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
        )}
      </ResponsiveContainer>
    </div>
  )
}
