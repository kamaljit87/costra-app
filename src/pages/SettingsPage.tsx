import { useState } from 'react'
import Layout from '../components/Layout'
import Breadcrumbs from '../components/Breadcrumbs'
import CurrencySelector from '../components/CurrencySelector'
import CloudProviderManager from '../components/CloudProviderManager'
import { Settings, Globe, Cloud } from 'lucide-react'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'providers'>('general')

  return (
    <Layout>
      <div className="w-full max-w-[1920px] mx-auto px-6 lg:px-12 xl:px-16 py-10">
        {/* Breadcrumbs */}
        <Breadcrumbs />

        {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">
          Manage your account preferences and cloud provider integrations
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('general')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm
              ${
                activeTab === 'general'
                  ? 'border-accent-500 text-accent-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            <div className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>General</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('providers')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm
              ${
                activeTab === 'providers'
                  ? 'border-accent-500 text-accent-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            <div className="flex items-center space-x-2">
              <Cloud className="h-4 w-4" />
              <span>Cloud Providers</span>
            </div>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'general' && (
          <div className="space-y-6">
            {/* Currency Settings */}
            <div className="card">
              <div className="flex items-center mb-4">
                <Globe className="h-5 w-5 text-accent-700 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Currency Preferences
                </h2>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Select your preferred currency for displaying cost data. All financial
                information will be converted and displayed in your chosen currency.
              </p>
              <div className="max-w-xs">
                <CurrencySelector />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'providers' && (
          <div>
            <CloudProviderManager />
          </div>
        )}
      </div>
      </div>
    </Layout>
  )
}
