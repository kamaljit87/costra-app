import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Globe, TrendingDown, Shield, Zap, ArrowRight, Check, BarChart3, Brain } from 'lucide-react'
import Logo from '../components/Logo'

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
    gradient: 'from-accent-500/10 to-accent-600/5',
  },
  {
    icon: Shield,
    title: 'Enterprise-Grade Security',
    description: 'Trusted by teams worldwide with bank-level encryption and compliance.',
    gradient: 'from-blue-500/10 to-blue-600/5',
  },
  {
    icon: Zap,
    title: 'Real-Time Insights',
    description: 'Get instant visibility into your cloud spending with live API integrations.',
    gradient: 'from-amber-500/10 to-amber-600/5',
  },
  {
    icon: BarChart3,
    title: 'Advanced Analytics',
    description: 'Deep insights into spending patterns with anomaly detection and forecasting.',
    gradient: 'from-purple-500/10 to-purple-600/5',
  },
  {
    icon: Brain,
    title: 'AI-Powered Analysis',
    description: 'Get intelligent recommendations to optimize costs with AI-driven insights.',
    gradient: 'from-indigo-500/10 to-indigo-600/5',
  },
  {
    icon: Globe,
    title: 'Global Currency Support',
    description: 'View costs in USD, EUR, GBP, INR, JPY, and more with real-time exchange rates.',
    gradient: 'from-accent-500/10 to-emerald-600/5',
  },
]

export default function LandingPage() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly')

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-surface-200/60 bg-white/80 backdrop-blur-lg sticky top-0 z-50 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Logo height={40} />
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/login" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
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
      <section className="relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-accent-200/20 rounded-full blur-3xl animate-float" />
          <div className="absolute top-40 right-20 w-96 h-96 bg-accent-100/30 rounded-full blur-3xl animate-float-delayed" />
          <div className="absolute -bottom-20 left-1/3 w-80 h-80 bg-primary-100/20 rounded-full blur-3xl" />
          {/* Dot grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'radial-gradient(circle, #1A2540 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }} />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 relative">
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-accent-50 border border-accent-200 text-accent-700 text-sm font-medium mb-8">
              <Zap className="h-4 w-4 mr-2" />
              Start your 7-day free trial
            </div>
            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 tracking-tight">
              Multi-Cloud Cost
              <span className="block text-gradient-accent mt-2">Management Made Simple</span>
            </h1>
            <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
              Track, optimize, and manage your cloud spending across AWS, Azure, and GCP
              with AI-powered insights and global currency support.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link to="/signup" className="btn-primary text-base px-8 py-3.5 flex items-center shadow-glow-accent">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <Link to="/login" className="btn-secondary text-base px-8 py-3.5">
                Sign In
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
      <section className="py-24 bg-surface-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need for FinOps
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Built for DevOps engineers, IT managers, and startup founders
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => {
              const Icon = feature.icon
              return (
                <div
                  key={feature.title}
                  className="group bg-white rounded-2xl border border-surface-200 p-6 shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300"
                >
                  <div className={`w-14 h-14 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="h-7 w-7 text-accent-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 bg-white">
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
              <div className="flex items-center bg-surface-100 rounded-xl p-1.5">
                <button
                  onClick={() => setBillingPeriod('monthly')}
                  className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    billingPeriod === 'monthly'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingPeriod('annual')}
                  className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    billingPeriod === 'annual'
                      ? 'bg-white text-gray-900 shadow-sm'
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
            <div className="bg-white rounded-2xl border-2 border-surface-200 p-8 shadow-card hover:shadow-card-hover transition-all duration-300">
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
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-accent-50 text-accent-700 border border-accent-200">
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

              <div className="mb-6 pt-4 border-t border-surface-200">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Who this is for:</p>
                <p className="text-sm text-gray-600">{PLANS.starter.whoThisIsFor}</p>
              </div>

              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">This price works because:</p>
                <p className="text-sm text-gray-600 italic">{PLANS.starter.priceWorksBecause}</p>
              </div>

              <Link
                to="/signup"
                className="w-full btn-secondary text-center block py-3 rounded-xl font-semibold"
              >
                Start Free Trial
              </Link>
            </div>

            {/* Pro Plan */}
            <div className="bg-white rounded-2xl p-8 shadow-card-hover relative border-2 border-accent-400">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="px-4 py-1.5 bg-gradient-to-r from-accent-600 to-accent-500 text-white text-xs font-semibold rounded-full shadow-glow-accent">
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
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-accent-50 text-accent-700 border border-accent-200">
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

              <div className="mb-6 pt-4 border-t border-surface-200">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Who this is for:</p>
                <p className="text-sm text-gray-600">{PLANS.pro.whoThisIsFor}</p>
              </div>

              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">This price works because:</p>
                <p className="text-sm text-gray-600 italic">{PLANS.pro.priceWorksBecause}</p>
              </div>

              <Link
                to="/signup"
                className="w-full btn-primary text-center block py-3 rounded-xl font-semibold"
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
      <section className="relative bg-gradient-to-br from-primary-800 via-primary-900 to-primary-800 text-white py-24 overflow-hidden">
        {/* Decorative blurred orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 left-1/4 w-64 h-64 bg-accent-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-accent-400/8 rounded-full blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Optimize Your Cloud Costs?</h2>
          <p className="text-xl text-primary-200 mb-10 max-w-2xl mx-auto">
            Join teams worldwide managing their multi-cloud infrastructure with Costra.
          </p>
          <Link to="/signup" className="inline-flex items-center px-8 py-3.5 bg-white text-primary-800 rounded-xl font-semibold text-base hover:bg-accent-50 transition-all duration-200 shadow-lg hover:shadow-xl">
            Get Started Free
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-surface-50 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-gray-500 space-y-2 sm:space-y-0">
            <p>&copy; {new Date().getFullYear()} Costra. All rights reserved.</p>
            <div className="flex space-x-6">
              <Link to="/privacy" className="hover:text-gray-900 transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-gray-900 transition-colors">Terms of Service</Link>
            </div>
          </div>
          <p className="text-center text-xs text-gray-400 mt-4">Prices shown exclude applicable taxes. Tax is calculated at checkout by our payment partner.</p>
        </div>
      </footer>
    </div>
  )
}
