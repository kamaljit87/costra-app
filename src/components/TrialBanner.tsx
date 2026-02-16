import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, X } from 'lucide-react'
import { billingAPI } from '../services/api'

interface SubscriptionStatus {
  planType: string
  status: string
  daysRemaining: number | null
  nextBillingDate: string | null
  isTrial: boolean
  isExpired: boolean
}

export default function TrialBanner() {
  const navigate = useNavigate()
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    loadSubscription()
  }, [])

  const loadSubscription = async () => {
    try {
      const response = await billingAPI.getSubscription()
      setSubscription(response.status)
    } catch (error) {
      console.error('Failed to load subscription:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Don't show banner if loading, dismissed, not trial, or expired
  if (isLoading || isDismissed || !subscription || !subscription.isTrial || subscription.isExpired) {
    return null
  }

  const daysRemaining = subscription.daysRemaining ?? 0

  // Only show if trial is active and has days remaining
  if (daysRemaining <= 0) {
    return null
  }

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/40 dark:to-orange-900/40 border-b border-amber-200 dark:border-amber-800 px-4 sm:px-6 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm sm:text-base text-amber-900 dark:text-amber-100 font-medium">
              Your trial ends in <span className="font-bold">{daysRemaining}</span> {daysRemaining === 1 ? 'day' : 'days'}
            </p>
            <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-200/90 mt-0.5">
              Upgrade to continue using all features after your trial expires
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 ml-4">
          <button
            onClick={() => navigate('/settings/billing')}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
          >
            Upgrade Now
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1.5 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800/50 rounded transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
