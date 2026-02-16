import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Globe, TrendingDown, Shield, Zap, ArrowRight, Check, BarChart3, Brain } from 'lucide-react'
import LandingNav from '../components/LandingNav'
import { usePublicConfig } from '../contexts/PublicConfigContext'
import { FlickeringGrid } from '@/components/ui/flickering-grid'

const PLANS = {
  starter: {
    name: 'Starter Plan (Default)',
    monthly: { inr: '₹1,249', usd: '$14.99' },
    annual: { inr: '₹12,499', usd: '$149.99' },
    annualSavings: { inr: '₹2,489', usd: '$29.89' },
    features: [
      'Up to 3 cloud provider accounts',
      'Up to 6 months of history',
      'Correct cost before & after credits',
      'Custom date ranges',
      'Monthly "What changed & why"',
      'Daily auto-sync',
    ],
    whoThisIsFor: 'Indie founders, Small startups, DevOps who want clarity without heavy FinOps tooling',
    priceWorksBecause: '$14.99 is less than 15 minutes of wasted cloud spend.',
  },
  pro: {
    name: 'Pro Plan (Active FinOps)',
    monthly: { inr: '₹2,099', usd: '$24.99' },
    annual: { inr: '₹20,999', usd: '$249.99' },
    annualSavings: { inr: '₹4,189', usd: '$49.89' },
    features: [
      'Everything in Starter',
      'Unlimited cloud provider accounts',
      '12+ months history',
      'Cost vs usage',
      'Unit economics',
      'Baseline anomaly detection',
      'Email summaries',
      'CSV exports',
    ],
    whoThisIsFor: 'Teams actively managing FinOps',
    priceWorksBecause: 'Unlimited accounts and advanced features for serious cost optimization',
  },
}

const FEATURES = [
  {
    icon: TrendingDown,
    title: 'Cost Optimization',
    description: 'Identify savings opportunities and track credits across all your cloud providers.',
  },
  {
    icon: Shield,
    title: 'Enterprise-Grade Security',
    description: 'Trusted by teams worldwide with bank-level encryption and compliance.',
  },
  {
    icon: Zap,
    title: 'Real-Time Insights',
    description: 'Get instant visibility into your cloud spending with live API integrations.',
  },
  {
    icon: BarChart3,
    title: 'Advanced Analytics',
    description: 'Deep insights into spending patterns with anomaly detection and forecasting.',
  },
  {
    icon: Brain,
    title: 'AI-Powered Analysis',
    description: 'Get intelligent recommendations to optimize costs with AI-driven insights.',
  },
  {
    icon: Globe,
    title: 'Global Currency Support',
    description: 'View costs in USD, EUR, GBP, INR, JPY, and more with real-time exchange rates.',
  },
]

export default function LandingPage() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly')
  const location = useLocation()
  const { signupDisabled } = usePublicConfig()

  // Scroll to pricing when navigating to /#pricing
  useEffect(() => {
    if (location.hash === '#pricing') {
      const el = document.getElementById('pricing')
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [location.pathname, location.hash])

  return (
    <div className="min-h-screen bg-white">
      <LandingNav />

      {/* Hero Section */}
      <section className="relative py-24 lg:py-32 bg-white overflow-hidden">
        <FlickeringGrid
          className="absolute inset-0 z-0 w-full h-full"
          squareSize={4}
          gridGap={6}
          color="#8B91F3"
          maxOpacity={0.35}
          flickerChance={0.08}
        />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-accent-50 border border-accent-100 text-accent-700 text-sm font-medium mb-8">
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              Start your 7-day free trial
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 tracking-tight leading-[1.15]">
              Multi-Cloud Cost
              <span className="block text-accent-500 mt-2">Management Made Simple</span>
            </h1>
            <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
              Track, optimize, and manage your cloud spending across AWS, Azure, and GCP
              with AI-powered insights and global currency support.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              {!signupDisabled && (
                <Link to="/signup" className="btn-primary text-base px-8 py-3 flex items-center">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              )}
              <Link to="/login" className={signupDisabled ? 'btn-primary text-base px-8 py-3 flex items-center' : 'btn-secondary text-base px-8 py-3'}>
                Sign In
                {signupDisabled && <ArrowRight className="ml-2 h-4 w-4" />}
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span>AES-256 Encrypted</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                <span>GDPR Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <span>10+ Currencies</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-surface-100 border-y border-surface-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need for FinOps
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Built for DevOps engineers, IT managers, and startup founders
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => {
              const Icon = feature.icon
              return (
                <div
                  key={feature.title}
                  className="bg-white rounded-xl border border-surface-300 p-6 shadow-xs hover:shadow-card transition-shadow duration-200"
                >
                  <div className="w-12 h-12 bg-accent-50 rounded-lg flex items-center justify-center mb-5">
                    <Icon className="h-6 w-6 text-accent-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-white scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Start with a 7-day free trial. No credit card required. Cancel anytime.
            </p>

            {/* Billing Period Toggle */}
            <div className="flex items-center justify-center mt-8">
              <div className="flex items-center bg-surface-200 rounded-lg p-1">
                <button
                  onClick={() => setBillingPeriod('monthly')}
                  className={`px-6 py-2.5 rounded-md text-sm font-semibold transition-colors duration-150 ${
                    billingPeriod === 'monthly'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingPeriod('annual')}
                  className={`px-6 py-2.5 rounded-md text-sm font-semibold transition-colors duration-150 ${
                    billingPeriod === 'annual'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Annual
                </button>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Starter Plan */}
            <div className="bg-white rounded-xl border border-surface-300 p-8 shadow-card">
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{PLANS.starter.name}</h3>
                <div className="mt-3">
                  <div className="flex items-baseline space-x-2">
                    <span className="text-4xl font-bold text-gray-900">
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
                    <div className="mt-3">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-accent-50 text-accent-700 border border-accent-100">
                        Save {PLANS.starter.annualSavings.usd}/year
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <ul className="space-y-3 mb-6">
                <li className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Includes:</li>
                {PLANS.starter.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start space-x-2">
                    <Check className="h-5 w-5 text-accent-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mb-6 pt-4 border-t border-surface-300">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Who this is for:</p>
                <p className="text-sm text-gray-600">{PLANS.starter.whoThisIsFor}</p>
              </div>

              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">This price works because:</p>
                <p className="text-sm text-gray-600 italic">{PLANS.starter.priceWorksBecause}</p>
              </div>

              <Link
                to={signupDisabled ? '/login' : '/signup'}
                className="w-full btn-secondary text-center block py-3 rounded-lg font-semibold"
              >
                {signupDisabled ? 'Sign In' : 'Start Free Trial'}
              </Link>
            </div>

            {/* Pro Plan */}
            <div className="bg-white rounded-xl p-8 shadow-card relative border-2 border-accent-500">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="px-4 py-1.5 bg-accent-500 text-white text-xs font-semibold rounded-full">
                  Recommended
                </span>
              </div>

              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{PLANS.pro.name}</h3>
                <div className="mt-3">
                  <div className="flex items-baseline space-x-2">
                    <span className="text-4xl font-bold text-gray-900">
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
                    <div className="mt-3">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-accent-50 text-accent-700 border border-accent-100">
                        Save {PLANS.pro.annualSavings.usd}/year
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <ul className="space-y-3 mb-6">
                <li className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Includes:</li>
                {PLANS.pro.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start space-x-2">
                    <Check className="h-5 w-5 text-accent-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mb-6 pt-4 border-t border-surface-300">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Who this is for:</p>
                <p className="text-sm text-gray-600">{PLANS.pro.whoThisIsFor}</p>
              </div>

              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">This price works because:</p>
                <p className="text-sm text-gray-600 italic">{PLANS.pro.priceWorksBecause}</p>
              </div>

              <Link
                to={signupDisabled ? '/login' : '/signup'}
                className="w-full btn-primary text-center block py-3 rounded-lg font-semibold"
              >
                {signupDisabled ? 'Sign In' : 'Start Free Trial'}
              </Link>
            </div>
          </div>

          <div className="text-center mt-12">
            <p className="text-sm text-gray-500">
              All plans include a 7-day free trial. No credit card required.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-accent-500 text-white py-24">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Optimize Your Cloud Costs?</h2>
          <p className="text-xl text-accent-100 mb-10 max-w-2xl mx-auto">
            Join teams worldwide managing their multi-cloud infrastructure with Costra.
          </p>
          <Link to={signupDisabled ? '/login' : '/signup'} className="inline-flex items-center px-8 py-3.5 bg-white text-accent-700 rounded-lg font-semibold text-base hover:bg-accent-50 transition-colors duration-150">
            {signupDisabled ? 'Sign In' : 'Get Started Free'}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-surface-100 border-t border-surface-300 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-gray-500 space-y-2 sm:space-y-0">
            <p>&copy; {new Date().getFullYear()} Costra. All rights reserved.</p>
            <div className="flex space-x-6">
              <Link to="/privacy" className="hover:text-gray-900 transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-gray-900 transition-colors">Terms of Service</Link>
              <Link to="/contact" className="hover:text-gray-900 transition-colors">Contact Us</Link>
            </div>
          </div>
          <p className="text-center text-xs text-gray-400 mt-4">Prices shown exclude applicable taxes. Tax is calculated at checkout by our payment partner.</p>
        </div>
      </footer>
    </div>
  )
}
