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
      gradient: 'from-blue-500 to-blue-600',
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
    },
    {
      label: 'Forecast',
      value: formatCurrency(convertAmount(totalForecast)),
      icon: Target,
      gradient: 'from-purple-500 to-purple-600',
      iconBg: 'bg-purple-500/10',
      iconColor: 'text-purple-500',
    },
    {
      label: 'Credits Applied',
      value: `-${formatCurrency(convertAmount(totalCredits))}`,
      icon: Gift,
      gradient: 'from-emerald-500 to-emerald-600',
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-500',
      valueColor: 'text-emerald-600',
    },
    {
      label: 'Net Cost',
      value: formatCurrency(convertAmount(netCost)),
      icon: Zap,
      gradient: 'from-primary-500 to-accent-500',
      iconBg: 'bg-primary-500/10',
      iconColor: 'text-primary-500',
      highlight: true,
    },
  ]

  return (
    <div className="mb-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Total Spend</h2>
          <p className="text-gray-500 mt-1">Overview across all cloud providers</p>
        </div>
        {changePercent !== 0 && (
          <div className={`flex items-center px-4 py-2 rounded-xl ${
            changePercent >= 0 
              ? 'bg-red-50 text-red-600 border border-red-100' 
              : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
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

      {/* Stats Grid */}
      <div className="grid md:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div 
              key={stat.label}
              className={`
                relative overflow-hidden rounded-2xl p-5
                ${stat.highlight 
                  ? 'bg-gradient-to-br from-primary-500 to-accent-500 text-white shadow-lg shadow-primary-500/25' 
                  : 'bg-white border border-gray-100 shadow-card hover:shadow-card-hover'
                }
                transition-all duration-300 hover:-translate-y-0.5
                animate-slide-up
              `}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Background decoration */}
              <div className={`absolute -top-4 -right-4 w-24 h-24 rounded-full opacity-10 ${
                stat.highlight ? 'bg-white' : `bg-gradient-to-br ${stat.gradient}`
              }`} />
              
              <div className="relative">
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3 ${
                  stat.highlight ? 'bg-white/20' : stat.iconBg
                }`}>
                  <Icon className={`h-5 w-5 ${stat.highlight ? 'text-white' : stat.iconColor}`} />
                </div>
                
                <div className={`text-sm font-medium mb-1 ${
                  stat.highlight ? 'text-white/80' : 'text-gray-500'
                }`}>
                  {stat.label}
                </div>
                
                <div className={`text-2xl font-bold tracking-tight ${
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
