import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useCurrency } from '../contexts/CurrencyContext'
import ProviderCostChart from './ProviderCostChart'
import { ArrowRight, TrendingUp, TrendingDown, Target, PiggyBank, ChevronDown } from 'lucide-react'
import { aggregateToMonthly } from '../services/costService'
import { ProviderIcon } from './CloudProviderIcons'
import { motion, AnimatePresence, MotionConfig } from 'motion/react'

interface CostDataPoint {
  date: string
  cost: number
}

interface ProviderSectionProps {
  providerId: string
  providerName: string
  currentMonth: number
  lastMonth: number
  lastMonthSamePeriod?: number
  taxCurrentMonth?: number
  taxLastMonth?: number
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
  maxHistoricalMonths?: number
  isExpanded?: boolean
  onToggle?: () => void
}

export default function ProviderSection({
  providerId,
  providerName,
  currentMonth,
  lastMonth,
  lastMonthSamePeriod,
  taxCurrentMonth = 0,
  taxLastMonth = 0,
  forecast,
  credits: _credits,
  savings: _savings,
  budgetCount = 0,
  chartData1Month: _chartData1Month,
  chartData2Months: _chartData2Months,
  chartData3Months: _chartData3Months,
  chartData4Months: _chartData4Months,
  chartData6Months: _chartData6Months,
  chartData12Months,
  maxHistoricalMonths = 12,
  isExpanded = false,
  onToggle,
}: ProviderSectionProps) {
  void _chartData1Month
  void _chartData2Months
  void _chartData3Months
  void _chartData4Months
  void _chartData6Months
  void _credits

  const { formatCurrency } = useCurrency()
  const availablePeriods = useMemo(() => {
    const periods: ('3months' | '6months' | '12months')[] = ['3months']
    if (maxHistoricalMonths >= 6) periods.push('6months')
    if (maxHistoricalMonths >= 12) periods.push('12months')
    return periods
  }, [maxHistoricalMonths])
  const defaultPeriod = availablePeriods.includes('6months') ? '6months' : availablePeriods[availablePeriods.length - 1]
  const [selectedPeriod, setSelectedPeriod] = useState<'3months' | '6months' | '12months'>(defaultPeriod)

  const hasTax = taxCurrentMonth > 0 || taxLastMonth > 0
  const displayCurrent = hasTax ? currentMonth + taxCurrentMonth : currentMonth
  const displayLast = hasTax ? lastMonth + taxLastMonth : lastMonth

  const changePercent = (() => {
    if (lastMonthSamePeriod != null && lastMonthSamePeriod > 0) {
      return ((currentMonth - lastMonthSamePeriod) / lastMonthSamePeriod) * 100
    }
    if (displayLast > 0) {
      return ((displayCurrent - displayLast) / displayLast) * 100
    }
    return 0
  })()

  const monthlyData = useMemo(() => {
    const allData = [...chartData12Months]
    return aggregateToMonthly(allData)
  }, [chartData12Months])

  const getChartData = () => {
    const monthsToShow = selectedPeriod === '3months' ? 3 : selectedPeriod === '6months' ? 6 : 12
    return monthlyData.slice(-monthsToShow)
  }

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't toggle if clicking a link or button
    const target = e.target as HTMLElement
    if (target.closest('a') || target.closest('button')) return
    onToggle?.()
  }

  return (
    <MotionConfig transition={{ type: 'spring', bounce: 0.1, duration: 0.4 }}>
      <motion.div
        layout
        className="card group cursor-pointer"
        onClick={handleCardClick}
      >
        {/* Provider Header — always visible */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 flex items-center justify-center rounded-2xl shrink-0">
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
                <div>
                  <div className="font-semibold text-gray-900">
                    {formatCurrency(displayCurrent)}
                  </div>
                  {hasTax && (
                    <div className="text-[10px] text-gray-400">
                      {formatCurrency(currentMonth)} + {formatCurrency(taxCurrentMonth)} tax
                    </div>
                  )}
                </div>
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
          <div className="flex items-center space-x-3">
            <Link
              to={`/provider/${providerId}`}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-accent-600 hover:text-accent-700 bg-accent-50 hover:bg-accent-100 rounded-lg transition-all duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <span>Details</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-gray-400"
            >
              <ChevronDown className="h-5 w-5" />
            </motion.div>
          </div>
        </div>

        {/* Expanded Content — chart + stats */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
              className="overflow-hidden"
            >
              <div className="pt-4">
                {/* Period Selector */}
                <div className="flex items-center space-x-2 mb-3 relative z-10">
                  <div className="flex bg-surface-100 rounded-xl p-1">
                    {availablePeriods.map((period) => (
                      <button
                        key={period}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
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
                    currentMonth={displayCurrent}
                    lastMonth={displayLast}
                    lastMonthSamePeriod={lastMonthSamePeriod}
                    currentMonthCost={lastMonthSamePeriod != null ? currentMonth : undefined}
                    period="monthly"
                    isMonthlyView={true}
                  />
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="bg-surface-50 rounded-xl p-3 border border-surface-200">
                    <div className="flex items-center space-x-1.5 text-gray-500 mb-1">
                      <Target className="h-3 w-3" />
                      <span className="text-[10px] font-semibold uppercase tracking-wide">Forecast</span>
                    </div>
                    <div className="text-sm font-bold text-gray-900">
                      {formatCurrency(forecast)}
                    </div>
                  </div>
                  <div className="bg-accent-50 rounded-xl p-3 border border-accent-200">
                    <div className="flex items-center space-x-1.5 text-accent-700 mb-1">
                      <PiggyBank className="h-3 w-3" />
                      <span className="text-[10px] font-semibold uppercase tracking-wide">Savings</span>
                    </div>
                    <div className="text-sm font-bold text-accent-700">
                      {formatCurrency(_savings)}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </MotionConfig>
  )
}
