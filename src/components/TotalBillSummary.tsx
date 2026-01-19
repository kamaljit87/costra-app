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
      iconBg: 'bg-[#F0FDFA]',
      iconColor: 'text-[#22B8A0]',
    },
    {
      label: 'Forecast',
      value: formatCurrency(convertAmount(totalForecast)),
      icon: Target,
      iconBg: 'bg-[#F0FDFA]',
      iconColor: 'text-[#22B8A0]',
    },
    {
      label: 'Credits Applied',
      value: `-${formatCurrency(convertAmount(totalCredits))}`,
      icon: Gift,
      iconBg: 'bg-[#F0FDFA]',
      iconColor: 'text-[#22B8A0]',
      valueColor: 'text-[#22B8A0]',
    },
    {
      label: 'Net Cost',
      value: formatCurrency(convertAmount(netCost)),
      icon: Zap,
      iconBg: 'bg-white/20',
      iconColor: 'text-white',
      highlight: true,
    },
  ]

  return (
    <div className="mb-6 animate-fade-in">
      {/* Header - Compact, Total Spend as Primary Focal Point */}
      <div className="flex flex-col items-center text-center mb-5">
        <h2 className="text-5xl font-bold text-[#0F172A] mb-1.5">
          Total Spend
        </h2>
        <p className="text-xs text-[#64748B] mb-3">Overview across all cloud providers</p>
        {changePercent !== 0 && (
          <div className={`flex items-center px-4 py-1.5 rounded-xl text-xs ${
            changePercent >= 0 
              ? 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]' 
              : 'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]'
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-7xl mx-auto">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div 
              key={stat.label}
              className={`
                relative overflow-hidden rounded-2xl p-4 h-full flex flex-col
                ${stat.highlight 
                  ? 'bg-[#1F3A5F] text-white shadow-sm' 
                  : 'bg-white border border-[#E2E8F0] shadow-sm'
                }
                transition-all duration-150 ease-out
                hover:shadow-md
                animate-slide-up
              `}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-start justify-between mb-2.5">
                <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl ${
                  stat.highlight ? 'bg-white/20' : 'bg-[#F0FDFA]'
                }`}>
                  <Icon className={`h-4 w-4 ${stat.highlight ? 'text-white' : 'text-[#22B8A0]'}`} />
                </div>
              </div>
              
              <div className="flex-1 flex flex-col justify-end">
                <div className={`text-[10px] font-semibold mb-1.5 uppercase tracking-wider ${
                  stat.highlight ? 'text-white/70' : 'text-[#64748B]'
                }`}>
                  {stat.label}
                </div>
                
                <div className={`text-2xl font-bold tracking-tight leading-tight ${
                  stat.highlight ? 'text-white' : stat.valueColor || 'text-[#0F172A]'
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
