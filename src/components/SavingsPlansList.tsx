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
      <div className="card p-4">
        <h3 className="text-base font-semibold text-[#0F172A] mb-3">Savings Plans</h3>
        <div className="text-center py-6">
          <p className="text-sm text-[#64748B] mb-1">No savings plans found</p>
          <p className="text-xs text-[#64748B]">Savings plans will appear here when available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-4">
      <h3 className="text-base font-semibold text-[#0F172A] mb-3">Savings Plans</h3>
      <div className="space-y-2">
        {plans.map((plan) => (
          <div key={plan.id} className="flex items-center justify-between p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
            <div className="flex items-center space-x-2.5">
              {getStatusIcon(plan.status)}
              <div>
                <div className="text-sm font-semibold text-[#0F172A]">{plan.name}</div>
                <div className="text-xs text-[#64748B]">{plan.provider}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-[#0F172A]">{plan.discount}% discount</div>
              <div className={`text-[10px] px-2 py-0.5 rounded-lg inline-block mt-1 ${getStatusColor(plan.status)}`}>
                {plan.status}
              </div>
              {plan.expiresAt && (
                <div className="text-[10px] text-[#64748B] mt-0.5">Expires {plan.expiresAt}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

