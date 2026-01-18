import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useCurrency } from '../contexts/CurrencyContext'
import ProviderCostChart from './ProviderCostChart'
import { ArrowRight, TrendingUp, TrendingDown, Gift, Target, PiggyBank } from 'lucide-react'
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
  credits,
  savings,
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
      {/* Provider Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center space-x-4">
          <div 
            className="w-14 h-14 flex items-center justify-center rounded-2xl transition-transform group-hover:scale-105"
            style={{ 
              backgroundColor: `${providerColor}15`,
              boxShadow: `0 4px 14px ${providerColor}20`
            }}
          >
            <ProviderIcon providerId={providerId} size={32} />
          </div>
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <h2 className="text-xl font-bold text-gray-900">{providerName}</h2>
              {credits > 0 && (
                <span className="badge-success">
                  <Gift className="h-3 w-3 mr-1" />
                  Credits
                </span>
              )}
            </div>
            <div className="flex items-center space-x-4 text-sm">
              <span className="font-semibold text-gray-900">
                {formatCurrency(convertAmount(currentMonth))}
              </span>
              {changePercent !== 0 && (
                <span className={`flex items-center font-medium ${
                  changePercent >= 0 ? 'text-red-500' : 'text-emerald-500'
                }`}>
                  {changePercent >= 0 ? (
                    <TrendingUp className="h-3.5 w-3.5 mr-1" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 mr-1" />
                  )}
                  {Math.abs(changePercent).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        </div>
        <Link
          to={`/provider/${providerId}`}
          className="flex items-center space-x-2 px-4 py-2.5 text-sm font-medium text-frozenWater-600 hover:text-frozenWater-700 bg-frozenWater-50 hover:bg-frozenWater-100 rounded-xl transition-all duration-200"
        >
          <span>Details</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Period Selector */}
      <div className="flex items-center space-x-2 mb-4">
        <div className="flex bg-gray-100 rounded-xl p-1">
          {(['3months', '6months', '12months'] as const).map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                selectedPeriod === period
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {period === '3months' && '3M'}
              {period === '6months' && '6M'}
              {period === '12months' && '12M'}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="chart-container mb-6">
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

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface-50 rounded-xl p-4 border border-gray-100">
          <div className="flex items-center space-x-2 text-gray-500 mb-2">
            <Target className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Forecast</span>
          </div>
          <div className="text-lg font-bold text-gray-900">
            {formatCurrency(convertAmount(forecast))}
          </div>
        </div>
        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
          <div className="flex items-center space-x-2 text-emerald-600 mb-2">
            <Gift className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Credits</span>
          </div>
          <div className="text-lg font-bold text-emerald-700">
            {formatCurrency(convertAmount(credits))}
          </div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-center space-x-2 text-blue-600 mb-2">
            <PiggyBank className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Savings</span>
          </div>
          <div className="text-lg font-bold text-blue-700">
            {formatCurrency(convertAmount(savings))}
          </div>
        </div>
      </div>
    </div>
  )
}
