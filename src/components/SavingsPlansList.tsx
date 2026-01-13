import { useCurrency } from '../contexts/CurrencyContext'
import { SavingsPlan } from '../services/costService'
import { CheckCircle, Clock, XCircle } from 'lucide-react'

interface SavingsPlansListProps {
  plans: SavingsPlan[]
}

export default function SavingsPlansList({ plans }: SavingsPlansListProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-600" />
      case 'expired':
        return <XCircle className="h-5 w-5 text-gray-400" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'expired':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (!plans || plans.length === 0) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Savings Plans</h3>
        <div className="text-center py-8">
          <p className="text-gray-600 mb-2">No savings plans found</p>
          <p className="text-sm text-gray-500">Savings plans will appear here when available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Savings Plans</h3>
      <div className="space-y-3">
        {plans.map((plan) => (
          <div key={plan.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              {getStatusIcon(plan.status)}
              <div>
                <div className="font-medium text-gray-900">{plan.name}</div>
                <div className="text-sm text-gray-600">{plan.provider}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold text-gray-900">{plan.discount}% discount</div>
              <div className={`text-xs px-2 py-1 rounded-full inline-block mt-1 ${getStatusColor(plan.status)}`}>
                {plan.status}
              </div>
              {plan.expiresAt && (
                <div className="text-xs text-gray-500 mt-1">Expires {plan.expiresAt}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

