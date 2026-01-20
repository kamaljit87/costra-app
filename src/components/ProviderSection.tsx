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
  credits,
  savings,
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
    <div className="card-modern group animate-fade-in">
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
              <h2 className="text-lg font-bold text-[#0F172A]">{providerName}</h2>
              {Math.abs(credits || 0) > 0 && (
                <span 
                  className="badge-success text-[10px] px-2 py-0.5"
                  title={`Credits applied: ${formatCurrency(convertAmount(Math.abs(credits || 0)))}`}
                >
                  <Gift className="h-2.5 w-2.5 mr-0.5" />
                  Credits: {formatCurrency(convertAmount(Math.abs(credits || 0)))}
                </span>
              )}
              {budgetCount > 0 && (
                <span 
                  className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-medium bg-[#EFF6FF] text-[#1F3A5F] border border-[#DBEAFE]"
                  title={`You have ${budgetCount} budget${budgetCount === 1 ? '' : 's'} configured for this provider`}
                >
                  <Target className="h-2.5 w-2.5 mr-0.5" />
                  {budgetCount} budget{budgetCount === 1 ? '' : 's'}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-3 text-sm">
              <span className="font-semibold text-[#0F172A]">
                {formatCurrency(convertAmount(currentMonth))}
              </span>
              {changePercent !== 0 && (
                <span className={`flex items-center font-medium text-xs ${
                  changePercent >= 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'
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
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-[#22B8A0] hover:text-[#1F3A5F] bg-[#F0FDFA] hover:bg-[#CCFBF1] rounded-lg transition-all duration-150"
        >
          <span>Details</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Period Selector */}
      <div className="flex items-center space-x-2 mb-3 relative z-10">
        <div className="flex bg-gray-100 rounded-xl p-1">
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
                  ? 'bg-white text-[#0F172A] shadow-sm'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-gray-50'
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
        <div className="bg-[#F8FAFC] rounded-xl p-3 border border-[#E2E8F0]">
          <div className="flex items-center space-x-1.5 text-[#64748B] mb-1">
            <Target className="h-3 w-3" />
            <span className="text-[10px] font-semibold uppercase tracking-wide">Forecast</span>
          </div>
          <div className="text-sm font-bold text-[#0F172A]">
            {formatCurrency(convertAmount(forecast))}
          </div>
        </div>
        <div className="bg-[#F0FDF4] rounded-xl p-3 border border-[#BBF7D0]">
          <div className="flex items-center space-x-1.5 text-[#16A34A] mb-1">
            <Gift className="h-3 w-3" />
            <span className="text-[10px] font-semibold uppercase tracking-wide">Credits</span>
          </div>
          <div className="text-sm font-bold text-[#16A34A]">
            {formatCurrency(convertAmount(credits))}
          </div>
        </div>
        <div className="bg-[#EFF6FF] rounded-xl p-3 border border-[#DBEAFE]">
          <div className="flex items-center space-x-1.5 text-[#1F3A5F] mb-1">
            <PiggyBank className="h-3 w-3" />
            <span className="text-[10px] font-semibold uppercase tracking-wide">Savings</span>
          </div>
          <div className="text-sm font-bold text-[#1F3A5F]">
            {formatCurrency(convertAmount(savings))}
          </div>
        </div>
      </div>
    </div>
  )
}
