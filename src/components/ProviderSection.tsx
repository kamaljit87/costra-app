import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCurrency } from '../contexts/CurrencyContext'
import ProviderCostChart from './ProviderCostChart'
import { ArrowRight, TrendingUp, TrendingDown, Gift } from 'lucide-react'

interface CostDataPoint {
  date: string
  cost: number
}

interface ProviderSectionProps {
  providerId: string
  providerName: string
  providerIcon: string
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
  providerIcon,
  currentMonth,
  lastMonth,
  forecast,
  credits,
  savings,
  chartData30Days,
  chartData60Days,
  chartData120Days,
  chartData180Days,
  chartData4Months,
  chartData6Months,
}: ProviderSectionProps) {
  const { formatCurrency, convertAmount } = useCurrency()
  const [selectedPeriod, setSelectedPeriod] = useState<'30days' | '60days' | '120days' | '180days' | '4months' | '6months'>('30days')

  const changePercent = lastMonth > 0
    ? ((currentMonth - lastMonth) / lastMonth) * 100
    : 0

  const getChartData = () => {
    switch (selectedPeriod) {
      case '30days':
        return chartData30Days
      case '60days':
        return chartData60Days
      case '120days':
        return chartData120Days
      case '180days':
        return chartData180Days
      case '4months':
        return chartData4Months
      case '6months':
        return chartData6Months
      default:
        return chartData30Days
    }
  }

  return (
    <div className="mb-8">
      {/* Provider Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <span className="text-3xl">{providerIcon}</span>
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

      {/* Period Selector */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(['30days', '60days', '120days', '180days', '4months', '6months'] as const).map((period) => (
          <button
            key={period}
            onClick={() => setSelectedPeriod(period)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedPeriod === period
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {period === '30days' && '30 Days'}
            {period === '60days' && '60 Days'}
            {period === '120days' && '120 Days'}
            {period === '180days' && '180 Days'}
            {period === '4months' && '4 Months'}
            {period === '6months' && '6 Months'}
          </button>
        ))}
      </div>

      {/* Chart */}
      <ProviderCostChart
        providerName={providerName}
        providerIcon={providerIcon}
        data={getChartData()}
        currentMonth={currentMonth}
        lastMonth={lastMonth}
        period={selectedPeriod}
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
