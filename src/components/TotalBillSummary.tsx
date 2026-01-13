import { useCurrency } from '../contexts/CurrencyContext'
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react'

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

  return (
    <div className="card bg-gradient-to-br from-primary-50 to-blue-50 border-primary-200 mb-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center mb-2">
            <DollarSign className="h-6 w-6 text-primary-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Total Bill</h2>
          </div>
          <p className="text-sm text-gray-600">Across all cloud providers</p>
        </div>
        {changePercent !== 0 && (
          <div className={`flex items-center px-3 py-1 rounded-full ${
            changePercent >= 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
          }`}>
            {changePercent >= 0 ? (
              <TrendingUp className="h-4 w-4 mr-1" />
            ) : (
              <TrendingDown className="h-4 w-4 mr-1" />
            )}
            <span className="text-sm font-medium">
              {Math.abs(changePercent).toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        {/* Current Month */}
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Current Month</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatCurrency(convertAmount(totalCurrent))}
          </div>
        </div>

        {/* Forecast */}
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Forecast</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatCurrency(convertAmount(totalForecast))}
          </div>
        </div>

        {/* Credits Applied */}
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Credits</div>
          <div className="text-2xl font-bold text-green-600">
            -{formatCurrency(convertAmount(totalCredits))}
          </div>
        </div>

        {/* Net Cost */}
        <div className="bg-white rounded-lg p-4 border-2 border-primary-300 bg-primary-50">
          <div className="text-sm text-gray-600 mb-1">Net Cost</div>
          <div className="text-2xl font-bold text-primary-700">
            {formatCurrency(convertAmount(netCost))}
          </div>
        </div>
      </div>
    </div>
  )
}
