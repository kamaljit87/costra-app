import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useCurrency } from '../contexts/CurrencyContext'
import ProviderCostChart from './ProviderCostChart'
import { ArrowRight, TrendingUp, TrendingDown, Target, PiggyBank } from 'lucide-react'
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
  credits: number // Kept for backward compatibility but not used
  savings: number
  budgetCount?: number
  chartData1Month: CostDataPoint[]
  chartData2Months: CostDataPoint[]
  chartData3Months: CostDataPoint[]
  chartData4Months: CostDataPoint[]
  chartData6Months: CostDataPoint[]
  chartData12Months: CostDataPoint[]
}

export default function ProviderSection({
  providerId,
  providerName,
  currentMonth,
  lastMonth,
  forecast,
  credits: _credits, // Unused but kept for interface compatibility
  savings: _savings, // Unused but kept for interface compatibility
  budgetCount = 0,
  chartData1Month: _chartData1Month,
  chartData2Months: _chartData2Months,
  chartData3Months: _chartData3Months,
  chartData4Months: _chartData4Months,
  chartData6Months: _chartData6Months,
  chartData12Months,
}: ProviderSectionProps) {
  void _chartData1Month
  void _chartData2Months
  void _chartData3Months
  void _chartData4Months
  void _chartData6Months

  const { formatCurrency, convertAmount } = useCurrency()
  const [selectedPeriod, setSelectedPeriod] = useState<'3months' | '6months' | '12months'>('6months')

  const changePercent = lastMonth > 0
    ? ((currentMonth - lastMonth) / lastMonth) * 100
    : 0

  const monthlyData = useMemo(() => {
    const allData = [...chartData12Months]
    return aggregateToMonthly(allData)
  }, [chartData12Months])

  const getChartData = () => {
    const monthsToShow = selectedPeriod === '3months' ? 3 : selectedPeriod === '6months' ? 6 : 12
    return monthlyData.slice(-monthsToShow)
  }

  const providerColor = getProviderColor(providerId)

  return (
    <div className="card group animate-fade-in">
      {/* Provider Header - Compact */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-4">
          <div
            className="w-14 h-14 flex items-center justify-center rounded-2xl transition-all duration-200"
            style={{
              backgroundColor: `${providerColor}15`
            }}
          >
            <ProviderIcon providerId={providerId} size={32} />
          </div>
          <div>
            <div className="flex items-center space-x-2.5 mb-1">
              <h2 className="text-lg font-bold text-gray-900">{providerName}</h2>
              {budgetCount > 0 && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-medium bg-accent-50 text-accent-700 border border-accent-200"
                  title={`You have ${budgetCount} budget${budgetCount === 1 ? '' : 's'} configured for this provider`}
                >
                  <Target className="h-2.5 w-2.5 mr-0.5" />
                  {budgetCount} budget{budgetCount === 1 ? '' : 's'}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-3 text-sm">
              <span className="font-semibold text-gray-900">
                {formatCurrency(convertAmount(currentMonth))}
              </span>
              {changePercent !== 0 && (
                <span className={`flex items-center font-medium text-xs ${
                  changePercent >= 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {changePercent >= 0 ? (
                    <TrendingUp className="h-3 w-3 mr-0.5" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-0.5" />
                  )}
                  {Math.abs(changePercent).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        </div>
        <Link
          to={`/provider/${providerId}`}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-accent-600 hover:text-accent-700 bg-accent-50 hover:bg-accent-100 rounded-lg transition-all duration-150"
        >
          <span>Details</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Period Selector */}
      <div className="flex items-center space-x-2 mb-3 relative z-10">
        <div className="flex bg-surface-100 rounded-xl p-1">
          {(['3months', '6months', '12months'] as const).map((period) => (
            <button
              key={period}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                console.log(`Period button clicked: ${period}`)
                setSelectedPeriod(period)
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 relative z-10 cursor-pointer ${
                selectedPeriod === period
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-surface-50'
              }`}
              type="button"
            >
              {period === '3months' && '3M'}
              {period === '6months' && '6M'}
              {period === '12months' && '12M'}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="chart-container mb-4">
        <ProviderCostChart
          providerId={providerId}
          providerName={providerName}
          data={getChartData()}
          currentMonth={currentMonth}
          lastMonth={lastMonth}
          period="monthly"
          isMonthlyView={true}
        />
      </div>

      {/* Quick Stats - Compact, Equal Heights */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-surface-50 rounded-xl p-3 border border-surface-200">
          <div className="flex items-center space-x-1.5 text-gray-500 mb-1">
            <Target className="h-3 w-3" />
            <span className="text-[10px] font-semibold uppercase tracking-wide">Forecast</span>
          </div>
          <div className="text-sm font-bold text-gray-900">
            {formatCurrency(convertAmount(forecast))}
          </div>
        </div>
        <div className="bg-accent-50 rounded-xl p-3 border border-accent-200">
          <div className="flex items-center space-x-1.5 text-accent-700 mb-1">
            <PiggyBank className="h-3 w-3" />
            <span className="text-[10px] font-semibold uppercase tracking-wide">Savings</span>
          </div>
          <div className="text-sm font-bold text-accent-700">
            {formatCurrency(convertAmount(_savings))}
          </div>
        </div>
      </div>
    </div>
  )
}
