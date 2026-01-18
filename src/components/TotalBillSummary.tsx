import { useCurrency } from '../contexts/CurrencyContext'
import { TrendingUp, TrendingDown, Wallet, Target, Gift, Zap } from 'lucide-react'

interface TotalBillSummaryProps {
  totalCurrent: number
  totalLastMonth: number
  totalForecast: number
  totalCredits: number
  totalSavings: number
}

export default function TotalBillSummary({
  totalCurrent,
  totalLastMonth,
  totalForecast,
  totalCredits,
  totalSavings,
}: TotalBillSummaryProps) {
  const { formatCurrency, convertAmount } = useCurrency()

  const changePercent = totalLastMonth > 0
    ? ((totalCurrent - totalLastMonth) / totalLastMonth) * 100
    : 0

  const netCost = totalCurrent - totalCredits - totalSavings

  const stats = [
    {
      label: 'Current Month',
      value: formatCurrency(convertAmount(totalCurrent)),
      icon: Wallet,
      gradient: 'from-frozenWater-400 to-frozenWater-500',
      iconBg: 'bg-frozenWater-100',
      iconColor: 'text-frozenWater-500',
    },
    {
      label: 'Forecast',
      value: formatCurrency(convertAmount(totalForecast)),
      icon: Target,
      gradient: 'from-frozenWater-300 to-frozenWater-400',
      iconBg: 'bg-frozenWater-100',
      iconColor: 'text-frozenWater-500',
    },
    {
      label: 'Credits Applied',
      value: `-${formatCurrency(convertAmount(totalCredits))}`,
      icon: Gift,
      gradient: 'from-frozenWater-400 to-frozenWater-500',
      iconBg: 'bg-frozenWater-100',
      iconColor: 'text-frozenWater-500',
      valueColor: 'text-frozenWater-600',
    },
    {
      label: 'Net Cost',
      value: formatCurrency(convertAmount(netCost)),
      icon: Zap,
      gradient: 'from-frozenWater-600 to-frozenWater-500',
      iconBg: 'bg-white/20',
      iconColor: 'text-white',
      highlight: true,
    },
  ]

  return (
    <div className="mb-10 animate-fade-in">
      {/* Header - Centered */}
      <div className="flex flex-col items-center text-center mb-10">
        <h2 className="text-4xl font-bold text-gray-900 mb-3">Total Spend</h2>
        <p className="text-xl text-gray-500">Overview across all cloud providers</p>
        {changePercent !== 0 && (
          <div className={`flex items-center px-5 py-2.5 rounded-full mt-4 ${
            changePercent >= 0 
              ? 'bg-red-50 text-red-600 border border-red-100' 
              : 'bg-frozenWater-50 text-frozenWater-700 border border-frozenWater-200'
          }`}>
            {changePercent >= 0 ? (
              <TrendingUp className="h-4 w-4 mr-2" />
            ) : (
              <TrendingDown className="h-4 w-4 mr-2" />
            )}
            <span className="text-sm font-semibold">
              {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}% vs last month
            </span>
          </div>
        )}
      </div>

      {/* Stats Grid - Centered and balanced layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div 
              key={stat.label}
              className={`
                relative overflow-hidden rounded-2xl p-6
                ${stat.highlight 
                  ? 'bg-gradient-to-br from-frozenWater-600 to-frozenWater-500 text-white shadow-xl shadow-frozenWater-500/30' 
                  : 'bg-white border border-gray-100 shadow-md hover:shadow-lg'
                }
                transition-all duration-300 hover:-translate-y-1
                animate-slide-up
              `}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Background decoration */}
              <div className={`absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-10 ${
                stat.highlight ? 'bg-white' : 'bg-frozenWater-200'
              }`} />
              
              <div className="relative">
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 ${
                  stat.highlight ? 'bg-white/20' : stat.iconBg
                }`}>
                  <Icon className={`h-6 w-6 ${stat.highlight ? 'text-white' : stat.iconColor}`} />
                </div>
                
                <div className={`text-sm font-medium mb-2 ${
                  stat.highlight ? 'text-white/90' : 'text-gray-600'
                }`}>
                  {stat.label}
                </div>
                
                <div className={`text-3xl font-bold tracking-tight ${
                  stat.highlight ? 'text-white' : stat.valueColor || 'text-gray-900'
                }`}>
                  {stat.value}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
