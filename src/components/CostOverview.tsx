import { useCurrency } from '../contexts/CurrencyContext'
import { CostData } from '../services/costService'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface CostOverviewProps {
  costData: CostData[]
}

export default function CostOverview({ costData }: CostOverviewProps) {
  const { formatCurrency, convertAmount } = useCurrency()

  const totalCurrent = costData.reduce((sum, data) => sum + convertAmount(data.currentMonth), 0)
  const totalLastMonth = costData.reduce((sum, data) => sum + convertAmount(data.lastMonth), 0)
  const totalForecast = costData.reduce((sum, data) => sum + convertAmount(data.forecast), 0)
  const totalCredits = costData.reduce((sum, data) => sum + convertAmount(data.credits), 0)
  const totalSavings = costData.reduce((sum, data) => sum + convertAmount(data.savings), 0)

  const changePercent = totalLastMonth > 0 
    ? ((totalCurrent - totalLastMonth) / totalLastMonth) * 100 
    : 0

  return (
    <div className="grid md:grid-cols-3 gap-6 mb-8">
      {/* Current Month */}
      <div className="card">
        <h3 className="text-sm font-medium text-gray-600 mb-2">Current Month</h3>
        <p className="text-3xl font-bold text-gray-900 mb-2">{formatCurrency(totalCurrent)}</p>
        <div className="flex items-center">
          {changePercent >= 0 ? (
            <ArrowUpRight className="h-4 w-4 text-red-600 mr-1" />
          ) : (
            <ArrowDownRight className="h-4 w-4 text-green-600 mr-1" />
          )}
          <span className={`text-sm font-medium ${changePercent >= 0 ? 'text-red-600' : 'text-green-600'}`}>
            {Math.abs(changePercent).toFixed(1)}% vs last month
          </span>
        </div>
      </div>

      {/* Forecast */}
      <div className="card">
        <h3 className="text-sm font-medium text-gray-600 mb-2">Forecast</h3>
        <p className="text-3xl font-bold text-gray-900 mb-2">{formatCurrency(totalForecast)}</p>
        <p className="text-sm text-gray-600">End of month projection</p>
      </div>

      {/* Net Cost */}
      <div className="card bg-gradient-to-br from-gray-50 to-gray-100">
        <h3 className="text-sm font-medium text-gray-600 mb-2">Net Cost</h3>
        <p className="text-3xl font-bold text-gray-900 mb-2">
          {formatCurrency(totalCurrent - totalCredits - totalSavings)}
        </p>
        <p className="text-sm text-gray-600">After credits & savings</p>
      </div>
    </div>
  )
}

