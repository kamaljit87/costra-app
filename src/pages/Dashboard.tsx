import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useCurrency } from '../contexts/CurrencyContext'
import { getCostData, getSavingsPlans, CostData, SavingsPlan } from '../services/costService'
import Layout from '../components/Layout'
import CostOverview from '../components/CostOverview'
import CreditsSavingsCard from '../components/CreditsSavingsCard'
import ProviderCostCard from '../components/ProviderCostCard'
import SavingsPlansList from '../components/SavingsPlansList'
import { Sparkles, RefreshCw } from 'lucide-react'

export default function Dashboard() {
  const { isDemoMode } = useAuth()
  const { formatCurrency, convertAmount } = useCurrency()
  const [costData, setCostData] = useState<CostData[]>([])
  const [savingsPlans, setSavingsPlans] = useState<SavingsPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const loadData = async () => {
    try {
      const [costs, plans] = await Promise.all([
        getCostData(isDemoMode),
        getSavingsPlans(isDemoMode),
      ])
      setCostData(costs)
      setSavingsPlans(plans)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleRefresh = () => {
    setIsRefreshing(true)
    loadData()
  }

  const totalCredits = costData.reduce((sum, data) => sum + convertAmount(data.credits), 0)
  const totalSavings = costData.reduce((sum, data) => sum + convertAmount(data.savings), 0)

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Demo Mode Banner */}
        {isDemoMode && (
          <div className="mb-6 bg-primary-50 border border-primary-200 rounded-lg px-4 py-3 flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-primary-600" />
            <span className="text-primary-700 font-medium">Demo Mode</span>
            <span className="text-primary-600 text-sm">
              - You're viewing sample data. Sign up to connect your cloud accounts.
            </span>
          </div>
        )}

        {/* Header with Refresh */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Cost Dashboard</h1>
            <p className="text-gray-600">
              Multi-cloud cost overview across all your providers
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh data"
          >
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 text-primary-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Loading cost data...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Cost Overview */}
            <CostOverview costData={costData} />

            {/* Credits & Savings */}
            <div className="mb-8">
              <CreditsSavingsCard credits={totalCredits} savings={totalSavings} />
            </div>

            {/* Provider Costs */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">By Provider</h2>
              <div className="grid md:grid-cols-3 gap-6">
                {costData.map((data) => (
                  <ProviderCostCard key={data.provider.id} data={data} />
                ))}
              </div>
            </div>

            {/* Savings Plans */}
            <div className="mb-8">
              <SavingsPlansList plans={savingsPlans} />
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
