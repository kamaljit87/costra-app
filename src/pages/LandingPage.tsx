import { Link } from 'react-router-dom'
import { Globe, TrendingDown, Shield, Zap, ArrowRight } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="text-2xl font-bold text-primary-600">Costra</div>
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
            <span className="block text-primary-600 mt-2">Made Simple</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Track, optimize, and manage your cloud spending across AWS, Azure, and GCP.
            <span className="block mt-2 font-semibold text-primary-600">
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
      <section className="bg-gradient-to-br from-primary-50 to-blue-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
              <Globe className="h-8 w-8 text-primary-600" />
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
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                <TrendingDown className="h-6 w-6 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Cost Optimization
              </h3>
              <p className="text-gray-600">
                Identify savings opportunities and track credits across all your cloud providers.
              </p>
            </div>

            <div className="card">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Enterprise-Grade Security
              </h3>
              <p className="text-gray-600">
                Trusted by teams worldwide with bank-level security and compliance.
              </p>
            </div>

            <div className="card">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-primary-600" />
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

      {/* CTA Section */}
      <section className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Optimize Your Cloud Costs?</h2>
          <p className="text-xl text-gray-300 mb-8">
            Join teams worldwide managing their multi-cloud infrastructure with Costra.
          </p>
          <Link to="/signup" className="btn-primary bg-white text-gray-900 hover:bg-gray-100 inline-flex items-center">
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

