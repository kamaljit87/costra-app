import { useCurrency } from '../contexts/CurrencyContext'
import { Gift, TrendingDown } from 'lucide-react'

interface CreditsSavingsCardProps {
  credits: number
  savings: number
}

export default function CreditsSavingsCard({ credits, savings }: CreditsSavingsCardProps) {
  const { formatCurrency } = useCurrency()

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Credits */}
      <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center mb-2">
              <Gift className="h-5 w-5 text-green-600 mr-2" />
              <h3 className="text-sm font-medium text-gray-600">Active Credits</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(credits)}</p>
            <p className="text-sm text-gray-600 mt-1">Available to apply</p>
          </div>
        </div>
      </div>

      {/* Savings */}
      <div className="card bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center mb-2">
              <TrendingDown className="h-5 w-5 text-blue-600 mr-2" />
              <h3 className="text-sm font-medium text-gray-600">Total Savings</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(savings)}</p>
            <p className="text-sm text-gray-600 mt-1">This month</p>
          </div>
        </div>
      </div>
    </div>
  )
}

