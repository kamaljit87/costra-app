import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Globe, TrendingDown, Shield, Zap, ArrowRight, Check } from 'lucide-react'
import Logo from '../components/Logo'

const PLANS = {
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
    whoThisIsFor: 'Teams actively managing FinOps',
    priceWorksBecause: 'Advanced features for serious cost optimization',
  },
}

export default function LandingPage() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly')

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Logo height={40} />
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/login" className="text-gray-600 hover:text-gray-900 font-medium">
                Sign In
              </Link>
              <Link to="/signup" className="btn-primary">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Multi-Cloud Cost Management
            <span className="block text-frozenWater-600 mt-2">Made Simple</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Track, optimize, and manage your cloud spending across AWS, Azure, and GCP.
            <span className="block mt-2 font-semibold text-frozenWater-600">
              With global currency support for teams worldwide.
            </span>
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/signup" className="btn-primary text-lg px-8 py-3 flex items-center">
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link to="/login" className="btn-secondary text-lg px-8 py-3">
              Try Demo
            </Link>
          </div>
        </div>
      </section>

      {/* Currency Feature Highlight */}
      <section className="bg-gradient-to-br from-frozenWater-50 to-frozenWater-100 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-frozenWater-200 rounded-full mb-4">
              <Globe className="h-8 w-8 text-frozenWater-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Global Currency Support
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              View your cloud costs in your local currency. We support USD, EUR, GBP, INR, JPY, 
              CNY, AUD, CAD, CHF, SGD, and more with real-time exchange rates.
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 max-w-4xl mx-auto">
            {['USD', 'EUR', 'GBP', 'INR', 'JPY'].map((currency) => (
              <div key={currency} className="bg-white rounded-lg p-4 text-center shadow-sm border border-gray-200">
                <div className="text-2xl font-bold text-gray-900">{currency}</div>
                <div className="text-sm text-gray-500 mt-1">Supported</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Everything You Need for FinOps
            </h2>
            <p className="text-lg text-gray-600">
              Built for DevOps engineers, IT managers, and startup founders
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="card">
              <div className="w-12 h-12 bg-frozenWater-100 rounded-lg flex items-center justify-center mb-4">
                <TrendingDown className="h-6 w-6 text-frozenWater-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Cost Optimization
              </h3>
              <p className="text-gray-600">
                Identify savings opportunities and track credits across all your cloud providers.
              </p>
            </div>

            <div className="card">
              <div className="w-12 h-12 bg-frozenWater-100 rounded-lg flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-frozenWater-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Enterprise-Grade Security
              </h3>
              <p className="text-gray-600">
                Trusted by teams worldwide with bank-level security and compliance.
              </p>
            </div>

            <div className="card">
              <div className="w-12 h-12 bg-frozenWater-100 rounded-lg flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-frozenWater-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Real-Time Insights
              </h3>
              <p className="text-gray-600">
                Get instant visibility into your cloud spending with live API integrations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Start with a 7-day free trial. No credit card required. Cancel anytime.
            </p>
            
            {/* Billing Period Toggle */}
            <div className="flex items-center justify-center mt-8">
              <div className="flex items-center space-x-2 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
                <button
                  onClick={() => setBillingPeriod('monthly')}
                  className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                    billingPeriod === 'monthly'
                      ? 'bg-frozenWater-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingPeriod('annual')}
                  className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                    billingPeriod === 'annual'
                      ? 'bg-frozenWater-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Annual
                </button>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Starter Plan */}
            <div className="bg-white rounded-xl border-2 border-gray-200 p-8 shadow-sm hover:shadow-lg transition-shadow">
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
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Save {PLANS.starter.annualSavings.usd}/year • 2 months free
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <ul className="space-y-3 mb-6">
                <li className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Includes:</li>
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

              <Link
                to="/signup"
                className="w-full btn-primary text-center block py-2.5 rounded-lg font-medium"
              >
                Start Free Trial
              </Link>
            </div>

            {/* Pro Plan */}
            <div className="bg-white rounded-xl border-2 border-frozenWater-500 p-8 shadow-lg relative">
              <div className="absolute top-0 right-0 -mt-4 -mr-4">
                <span className="px-3 py-1 bg-frozenWater-600 text-white text-xs font-medium rounded-full shadow-lg">
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
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Save {PLANS.pro.annualSavings.usd}/year • 2.5 months free
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <ul className="space-y-3 mb-6">
                <li className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Includes:</li>
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

              <Link
                to="/signup"
                className="w-full btn-primary text-center block py-2.5 rounded-lg font-medium"
              >
                Start Free Trial
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
      <section className="bg-frozenWater-800 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Optimize Your Cloud Costs?</h2>
          <p className="text-xl text-frozenWater-200 mb-8">
            Join teams worldwide managing their multi-cloud infrastructure with Costra.
          </p>
          <Link to="/signup" className="btn-primary bg-frozenWater-500 text-white hover:bg-frozenWater-600 inline-flex items-center">
            Get Started Free
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-600">
            <p>&copy; 2024 Costra. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

