import { useState, useEffect } from 'react'
import { Check, X, Loader2, CreditCard, Calendar, AlertCircle } from 'lucide-react'
import { billingAPI } from '../services/api'
import UpgradePrompt from '../components/UpgradePrompt'

interface Subscription {
  planType: string
  status: string
  trialStartDate: string | null
  trialEndDate: string | null
  subscriptionStartDate: string | null
  subscriptionEndDate: string | null
}

interface SubscriptionStatus {
  planType: string
  status: string
  daysRemaining: number | null
  nextBillingDate: string | null
  historicalDataMonths: number
  isTrial: boolean
  isExpired: boolean
  canAccessFeatures: boolean
}

const PLANS = {
  trial: {
    name: 'Free Trial',
    price: { inr: '₹0', usd: '$0' },
    period: '7 days',
    features: [
      'Connect all cloud providers',
      'Full historical data (12 months)',
      'Cost vs usage',
      'Cost summaries',
      'Untagged resources',
      'Anomaly detection',
      'Auto-sync',
    ],
    restrictions: ['CSV export', 'Email alerts', 'Scheduled sync', 'Unit economics'],
  },
  starter: {
    name: 'Starter Plan (Default)',
    monthly: { inr: '₹850', usd: '$10' },
    annual: { inr: '₹8,500', usd: '$100' },
    annualSavings: { inr: '₹1,700', usd: '$20' },
    features: [
      'Unlimited cloud providers',
      'Up to 6 months of history',
      'Correct cost before & after credits',
      'Custom date ranges',
      'Monthly "What changed & why"',
      'Daily auto-sync',
    ],
    restrictions: ['CSV export', 'Email alerts', 'Unit economics'],
    whoThisIsFor: 'Indie founders, Small startups, DevOps who want clarity without heavy FinOps tooling',
    priceWorksBecause: '$10 is less than 15 minutes of wasted cloud spend.',
  },
  pro: {
    name: 'Pro Plan (Active FinOps)',
    monthly: { inr: '₹2,040', usd: '$24' },
    annual: { inr: '₹20,400', usd: '$240' },
    annualSavings: { inr: '₹4,080', usd: '$48' },
    features: [
      'Everything in Starter',
      '12+ months history',
      'Cost vs usage',
      'Unit economics',
      'Baseline anomaly detection',
      'Email summaries',
      'CSV exports',
    ],
    restrictions: [],
    whoThisIsFor: 'Teams actively managing FinOps',
    priceWorksBecause: 'Advanced features for serious cost optimization',
  },
}

export default function BillingPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [status, setStatus] = useState<SubscriptionStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly')

  useEffect(() => {
    loadSubscription()
  }, [])

  const loadSubscription = async () => {
    try {
      setIsLoading(true)
      const response = await billingAPI.getSubscription()
      setSubscription(response.subscription)
      setStatus(response.status)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to load subscription')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpgrade = async (planType: 'starter' | 'pro') => {
    try {
      setIsProcessing(true)
      setError(null)
      const response = await billingAPI.createCheckoutSession(planType, billingPeriod)
      
      // Redirect to Stripe checkout
      if (response.url) {
        window.location.href = response.url
      } else {
        throw new Error('No checkout URL received')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create checkout session')
      setIsProcessing(false)
    }
  }

  const handleManageBilling = async () => {
    try {
      setIsProcessing(true)
      setError(null)
      const response = await billingAPI.createPortalSession()
      
      // Redirect to Stripe portal
      if (response.url) {
        window.location.href = response.url
      } else {
        throw new Error('No portal URL received')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to open billing portal')
      setIsProcessing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-frozenWater-600" />
      </div>
    )
  }

  const currentPlan = subscription?.planType || 'trial'
  const planInfo = PLANS[currentPlan as keyof typeof PLANS]

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Billing & Subscription</h1>
        <p className="mt-2 text-gray-600">Manage your subscription and billing preferences</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Current Plan */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Current Plan</h2>
            <p className="text-sm text-gray-500 mt-1">
              {status?.isTrial ? 'Free trial' : 'Active subscription'}
            </p>
          </div>
          <div className="text-right">
            {currentPlan === 'trial' ? (
              <>
                <div className="text-2xl font-bold text-frozenWater-700">
                  {planInfo.price.inr} <span className="text-lg text-gray-500">/ {planInfo.period}</span>
                </div>
                <div className="text-sm text-gray-500 mt-1">{planInfo.price.usd} / {planInfo.period}</div>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-frozenWater-700">
                  {(planInfo as any).monthly.inr} <span className="text-lg text-gray-500">/ month</span>
                </div>
                <div className="text-sm text-gray-500 mt-1">{(planInfo as any).monthly.usd} / month</div>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Plan</p>
              <p className="font-medium text-gray-900">{planInfo.name}</p>
            </div>
          </div>
          
          {status?.daysRemaining !== null && (
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">
                  {status.isTrial ? 'Trial ends in' : 'Next billing'}
                </p>
                <p className="font-medium text-gray-900">
                  {status.daysRemaining} {status.daysRemaining === 1 ? 'day' : 'days'}
                </p>
              </div>
            </div>
          )}
          
          <div className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">History</p>
              <p className="font-medium text-gray-900">{status?.historicalDataMonths || 0} months</p>
            </div>
          </div>
        </div>

        {subscription?.status === 'active' && !status?.isTrial && (
          <button
            onClick={handleManageBilling}
            disabled={isProcessing}
            className="btn-secondary inline-flex items-center space-x-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading...</span>
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                <span>Manage Billing</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Available Plans */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Available Plans</h2>
          
          {/* Billing Period Toggle */}
          <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingPeriod === 'monthly'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('annual')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingPeriod === 'annual'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Annual
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Starter Plan */}
          <div className={`bg-white rounded-xl border-2 p-6 ${
            currentPlan === 'starter' 
              ? 'border-frozenWater-500 shadow-lg' 
              : 'border-gray-200'
          }`}>
            <div className="mb-4">
              <h3 className="text-xl font-semibold text-gray-900">{PLANS.starter.name}</h3>
              <div className="mt-3">
                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {billingPeriod === 'monthly' ? PLANS.starter.monthly.usd : PLANS.starter.annual.usd}
                  </span>
                  <span className="text-gray-500">
                    / {billingPeriod === 'monthly' ? 'month' : 'year'}
                  </span>
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {billingPeriod === 'monthly' ? PLANS.starter.monthly.inr : PLANS.starter.annual.inr}
                  {' '}/ {billingPeriod === 'monthly' ? 'month' : 'year'}
                </div>
                {billingPeriod === 'annual' && (
                  <div className="mt-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Save {PLANS.starter.annualSavings.usd}/year • 2 months free
                    </span>
                  </div>
                )}
              </div>
            </div>

            <ul className="space-y-2 mb-6">
              <li className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Includes:</li>
              {PLANS.starter.features.map((feature, idx) => (
                <li key={idx} className="flex items-start space-x-2">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mb-6 pt-4 border-t border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Who this is for:</p>
              <p className="text-sm text-gray-600">{PLANS.starter.whoThisIsFor}</p>
            </div>

            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">This price works because:</p>
              <p className="text-sm text-gray-600 italic">{PLANS.starter.priceWorksBecause}</p>
            </div>

            <button
              onClick={() => handleUpgrade('starter')}
              disabled={isProcessing || currentPlan === 'starter'}
              className={`w-full py-2.5 rounded-lg font-medium transition-colors ${
                currentPlan === 'starter'
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'btn-primary'
              }`}
            >
              {currentPlan === 'starter' ? 'Current Plan' : `Upgrade to Starter${billingPeriod === 'annual' ? ' (Annual)' : ''}`}
            </button>
          </div>

          {/* Pro Plan */}
          <div className={`bg-white rounded-xl border-2 p-6 ${
            currentPlan === 'pro' 
              ? 'border-frozenWater-500 shadow-lg' 
              : 'border-frozenWater-300'
          }`}>
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">{PLANS.pro.name}</h3>
                {currentPlan !== 'pro' && (
                  <span className="px-2 py-1 bg-frozenWater-100 text-frozenWater-700 text-xs font-medium rounded">
                    Recommended
                  </span>
                )}
              </div>
              <div className="mt-3">
                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {billingPeriod === 'monthly' ? PLANS.pro.monthly.usd : PLANS.pro.annual.usd}
                  </span>
                  <span className="text-gray-500">
                    / {billingPeriod === 'monthly' ? 'month' : 'year'}
                  </span>
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {billingPeriod === 'monthly' ? PLANS.pro.monthly.inr : PLANS.pro.annual.inr}
                  {' '}/ {billingPeriod === 'monthly' ? 'month' : 'year'}
                </div>
                {billingPeriod === 'annual' && (
                  <div className="mt-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Save {PLANS.pro.annualSavings.usd}/year • 2.5 months free
                    </span>
                  </div>
                )}
              </div>
            </div>

            <ul className="space-y-2 mb-6">
              <li className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Includes:</li>
              {PLANS.pro.features.map((feature, idx) => (
                <li key={idx} className="flex items-start space-x-2">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mb-6 pt-4 border-t border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Who this is for:</p>
              <p className="text-sm text-gray-600">{PLANS.pro.whoThisIsFor}</p>
            </div>

            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">This price works because:</p>
              <p className="text-sm text-gray-600 italic">{PLANS.pro.priceWorksBecause}</p>
            </div>

            <button
              onClick={() => handleUpgrade('pro')}
              disabled={isProcessing || currentPlan === 'pro'}
              className={`w-full py-2.5 rounded-lg font-medium transition-colors ${
                currentPlan === 'pro'
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'btn-primary'
              }`}
            >
              {currentPlan === 'pro' ? 'Current Plan' : `Upgrade to Pro${billingPeriod === 'annual' ? ' (Annual)' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
