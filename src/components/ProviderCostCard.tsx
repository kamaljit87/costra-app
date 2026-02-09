import { useCurrency } from '../contexts/CurrencyContext'
import { CostData } from '../services/costService'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { ProviderIcon } from './CloudProviderIcons'

interface ProviderCostCardProps {
  data: CostData
}

export default function ProviderCostCard({ data }: ProviderCostCardProps) {
  const { formatCurrency, convertAmount } = useCurrency()

  const currentMonth = convertAmount(data.currentMonth)
  const lastMonth = convertAmount(data.lastMonth)
  const changePercent = lastMonth > 0 ? ((currentMonth - lastMonth) / lastMonth) * 100 : 0

  return (
    <div className="card group">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center mb-2">
            <div className="w-10 h-10 flex items-center justify-center rounded-2xl mr-3 group-hover:scale-110 transition-transform duration-300 shrink-0">
              <ProviderIcon providerId={data.provider.id} size={24} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{data.provider.name}</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(currentMonth)}</p>
        </div>
        <div className="text-right">
          {changePercent >= 0 ? (
            <ArrowUpRight className="h-5 w-5 text-red-600 mx-auto mb-1" />
          ) : (
            <ArrowDownRight className="h-5 w-5 text-green-600 mx-auto mb-1" />
          )}
          <span className={`text-sm font-medium ${changePercent >= 0 ? 'text-red-600' : 'text-green-600'}`}>
            {Math.abs(changePercent).toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="space-y-3 pt-6 border-t border-gray-200/60">
        {data.services.slice(0, 3).map((service) => (
          <div key={service.name} className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{service.name}</span>
            <div className="flex items-center space-x-3">
              <span className="font-medium text-gray-900">{formatCurrency(service.cost)}</span>
              {service.change >= 0 ? (
                <span className="text-red-600 text-xs">+{service.change.toFixed(1)}%</span>
              ) : (
                <span className="text-green-600 text-xs">{service.change.toFixed(1)}%</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

