import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useCurrency } from '../contexts/CurrencyContext'
import ProviderCostChart from './ProviderCostChart'
import { ArrowRight, TrendingUp, TrendingDown, Gift } from 'lucide-react'
import { aggregateToMonthly } from '../services/costService'
import { ProviderIcon, getProviderColor } from './CloudProviderIcons'

interface CostDataPoint {
  date: string
  cost: number
}

interface ProviderSectionProps {
  providerId: string
  providerName: string
  currentMonth: number
  lastMonth: number
  forecast: number
  credits: number
  savings: number
  chartData30Days: CostDataPoint[]
  chartData60Days: CostDataPoint[]
  chartData120Days: CostDataPoint[]
  chartData180Days: CostDataPoint[]
  chartData4Months: CostDataPoint[]
  chartData6Months: CostDataPoint[]
}

export default function ProviderSection({
  providerId,
  providerName,
  currentMonth,
  lastMonth,
  forecast,
  credits,
  savings,
  chartData30Days: _chartData30Days,
  chartData60Days: _chartData60Days,
  chartData120Days: _chartData120Days,
  chartData180Days,
  chartData4Months: _chartData4Months,
  chartData6Months: _chartData6Months,
}: ProviderSectionProps) {
  // Suppress unused variable warnings - these props are passed but we only use 180 days for monthly aggregation
  void _chartData30Days
  void _chartData60Days
  void _chartData120Days
  void _chartData4Months
  void _chartData6Months
  const { formatCurrency, convertAmount } = useCurrency()
  const [selectedPeriod, setSelectedPeriod] = useState<'3months' | '6months' | '12months'>('6months')

  const changePercent = lastMonth > 0
    ? ((currentMonth - lastMonth) / lastMonth) * 100
    : 0

  // Aggregate daily data to monthly for dashboard view
  const monthlyData = useMemo(() => {
    // Combine all available daily data for monthly aggregation
    const allData = [...chartData180Days]
    return aggregateToMonthly(allData)
  }, [chartData180Days])

  // Get chart data based on selected period (monthly)
  const getChartData = () => {
    const monthsToShow = selectedPeriod === '3months' ? 3 : selectedPeriod === '6months' ? 6 : 12
    return monthlyData.slice(-monthsToShow)
  }

  return (
    <div className="mb-8">
      {/* Provider Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div 
            className="w-12 h-12 flex items-center justify-center rounded-xl"
            style={{ backgroundColor: `${getProviderColor(providerId)}15` }}
          >
            <ProviderIcon providerId={providerId} size={32} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-semibold text-gray-900">{providerName}</h2>
              {credits > 0 && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                  <Gift className="h-3 w-3 mr-1" />
                  Credits Applied
                </span>
              )}
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
              <span>Current: {formatCurrency(convertAmount(currentMonth))}</span>
              {credits > 0 && (
                <span className="flex items-center text-green-600 font-medium">
                  <Gift className="h-3 w-3 mr-1" />
                  -{formatCurrency(convertAmount(credits))} credits
                </span>
              )}
              {changePercent !== 0 && (
                <span className={`flex items-center ${
                  changePercent >= 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {changePercent >= 0 ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  {Math.abs(changePercent).toFixed(1)}% vs last month
                </span>
              )}
            </div>
          </div>
        </div>
        <Link
          to={`/provider/${providerId}`}
          className="flex items-center space-x-2 px-4 py-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
        >
          <span>View Details</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Period Selector - Monthly view */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(['3months', '6months', '12months'] as const).map((period) => (
          <button
            key={period}
            onClick={() => setSelectedPeriod(period)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedPeriod === period
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {period === '3months' && 'Last 3 Months'}
            {period === '6months' && 'Last 6 Months'}
            {period === '12months' && 'Last 12 Months'}
          </button>
        ))}
      </div>

      {/* Chart - Monthly view */}
      <ProviderCostChart
        providerId={providerId}
        providerName={providerName}
        data={getChartData()}
        currentMonth={currentMonth}
        lastMonth={lastMonth}
        period="monthly"
        isMonthlyView={true}
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mt-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Forecast</div>
          <div className="text-lg font-semibold text-gray-900">
            {formatCurrency(convertAmount(forecast))}
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Credits</div>
          <div className="text-lg font-semibold text-green-700">
            {formatCurrency(convertAmount(credits))}
          </div>
        </div>
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Savings</div>
          <div className="text-lg font-semibold text-blue-700">
            {formatCurrency(convertAmount(savings))}
          </div>
        </div>
      </div>
    </div>
  )
}
