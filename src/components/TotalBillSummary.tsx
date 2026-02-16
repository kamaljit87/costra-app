import { useCurrency } from '../contexts/CurrencyContext'
import { TrendingUp, TrendingDown, Wallet, Target, Zap } from 'lucide-react'

interface TotalBillSummaryProps {
  totalCurrent: number
  totalLastMonth: number
  totalForecast: number
  totalSavings: number
  forecastConfidence?: number | null
  totalTaxCurrent?: number
  totalTaxLastMonth?: number
}

const getConfidenceLabel = (confidence: number | null | undefined) => {
  if (confidence == null) return null
  if (confidence >= 70) return { text: 'High confidence', color: 'text-green-600' }
  if (confidence >= 40) return { text: 'Medium confidence', color: 'text-amber-600' }
  return { text: 'Low confidence', color: 'text-red-500' }
}

export default function TotalBillSummary({
  totalCurrent,
  totalLastMonth,
  totalForecast,
  totalSavings,
  forecastConfidence,
  totalTaxCurrent = 0,
  totalTaxLastMonth = 0,
}: TotalBillSummaryProps) {
  const { formatCurrency } = useCurrency()

  const currentWithTax = totalCurrent + totalTaxCurrent
  const lastMonthWithTax = totalLastMonth + totalTaxLastMonth
  const changePercent = lastMonthWithTax > 0
    ? ((currentWithTax - lastMonthWithTax) / lastMonthWithTax) * 100
    : 0

  void totalSavings

  const confidenceLabel = getConfidenceLabel(forecastConfidence)

  const hasTax = totalTaxCurrent > 0 || totalTaxLastMonth > 0

  const stats = [
    {
      label: 'Current Month',
      value: formatCurrency(hasTax ? totalCurrent + totalTaxCurrent : totalCurrent),
      icon: Wallet,
      highlight: true,
      subtitle: null as string | null,
      subtitleColor: '',
      taxBreakdown: hasTax ? `${formatCurrency(totalCurrent)} + ${formatCurrency(totalTaxCurrent)} tax` : null,
    },
    {
      label: 'Last Month',
      value: formatCurrency(hasTax ? totalLastMonth + totalTaxLastMonth : totalLastMonth),
      icon: Target,
      highlight: false,
      subtitle: null as string | null,
      subtitleColor: '',
      taxBreakdown: hasTax ? `${formatCurrency(totalLastMonth)} + ${formatCurrency(totalTaxLastMonth)} tax` : null,
    },
    {
      label: 'Forecast',
      value: formatCurrency(totalForecast),
      icon: Zap,
      highlight: false,
      subtitle: confidenceLabel?.text || null,
      subtitleColor: confidenceLabel?.color || '',
      taxBreakdown: null,
    },
  ]

  return (
    <div className="mb-6 animate-fade-in">
      {/* Header - Compact, Total Spend as Primary Focal Point */}
      <div className="flex flex-col items-center text-center mb-5">
        <h2 className="text-5xl font-bold text-gray-900 dark:text-gray-100 mb-1.5">
          Total Spend
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-300 mb-3">Overview across all cloud providers{hasTax ? '' : ' (before tax)'}</p>
        {changePercent !== 0 && (
          <div className={`flex items-center px-4 py-1.5 rounded-xl text-xs ${
            changePercent >= 0
              ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
              : 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800'
          }`}>
            {changePercent >= 0 ? (
              <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 mr-1.5" />
            )}
            <span className="font-semibold">
              {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}% vs last month
            </span>
          </div>
        )}
      </div>

      {/* Stats Grid - Compact, Equal Heights, Horizontal Grouping */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-7xl mx-auto">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className={`
                relative overflow-hidden rounded-2xl p-4 h-full flex flex-col
                ${stat.highlight
                  ? 'bg-accent-50 dark:bg-accent-900/40 border border-accent-100 dark:border-accent-800 shadow-sm'
                  : 'bg-white dark:bg-gray-800 border border-surface-300 dark:border-gray-700 shadow-sm'
                }
                transition-all duration-150 ease-out
                hover:shadow-md
                animate-slide-up
              `}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-start justify-between mb-2.5">
                <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl ${
                  stat.highlight ? 'bg-accent-100 dark:bg-accent-800/50' : 'bg-accent-50 dark:bg-accent-900/30'
                }`}>
                  <Icon className={`h-4 w-4 ${stat.highlight ? 'text-accent-600 dark:text-accent-400' : 'text-accent-500 dark:text-accent-400'}`} />
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-end">
                <div className={`text-[10px] font-semibold mb-1.5 uppercase tracking-wider ${
                  stat.highlight ? 'text-accent-600 dark:text-accent-400' : 'text-gray-500 dark:text-gray-300'
                }`}>
                  {stat.label}
                </div>

                <div className={`text-2xl font-bold tracking-tight leading-tight ${
                  stat.highlight ? 'text-accent-900 dark:text-accent-100' : 'text-gray-900 dark:text-gray-100'
                }`}>
                  {stat.value}
                </div>

                {stat.taxBreakdown && (
                  <div className="text-[10px] mt-1.5 text-gray-400 dark:text-gray-400">
                    {stat.taxBreakdown}
                  </div>
                )}

                {stat.subtitle && (
                  <div className={`text-[10px] mt-1 font-medium ${stat.subtitleColor}`}>
                    {stat.subtitle}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
