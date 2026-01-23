import { useNavigate } from 'react-router-dom'
import { Lock, ArrowRight } from 'lucide-react'

interface UpgradePromptProps {
  feature: string
  requiredPlan: 'Starter' | 'Pro'
  description?: string
}

export default function UpgradePrompt({ feature, requiredPlan, description }: UpgradePromptProps) {
  const navigate = useNavigate()

  const planPrices = {
    Starter: { inr: '₹850', usd: '$10' },
    Pro: { inr: '₹1,999', usd: '$24' },
  }

  const price = planPrices[requiredPlan]

  return (
    <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-8 text-center">
      <div className="flex justify-center mb-4">
        <div className="p-3 bg-gray-100 rounded-full">
          <Lock className="h-8 w-8 text-gray-400" />
        </div>
      </div>
      
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        {feature} requires {requiredPlan}
      </h3>
      
      {description && (
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          {description}
        </p>
      )}
      
      <div className="mb-6">
        <div className="inline-flex items-center space-x-2 bg-frozenWater-50 px-4 py-2 rounded-lg">
          <span className="text-2xl font-bold text-frozenWater-700">{price.inr}</span>
          <span className="text-gray-500">/</span>
          <span className="text-lg font-semibold text-frozenWater-600">{price.usd}</span>
          <span className="text-gray-500 text-sm">/month</span>
        </div>
      </div>
      
      <button
        onClick={() => navigate('/settings/billing')}
        className="btn-primary inline-flex items-center space-x-2"
      >
        <span>Upgrade to {requiredPlan}</span>
        <ArrowRight className="h-4 w-4" />
      </button>
      
      <p className="text-xs text-gray-500 mt-4">
        Cancel anytime. No credit card required for trial.
      </p>
    </div>
  )
}
