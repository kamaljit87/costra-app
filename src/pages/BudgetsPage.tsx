import { useState, useEffect } from 'react'
import { Plus, AlertTriangle, Info } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'
import { budgetsAPI } from '../services/api'
import Layout from '../components/Layout'
import Breadcrumbs from '../components/Breadcrumbs'
import BudgetCard from '../components/BudgetCard'
import BudgetForm from '../components/BudgetForm'

interface Budget {
  id: number
  budgetName: string
  providerId?: string
  accountId?: number
  budgetAmount: number
  budgetPeriod: 'monthly' | 'quarterly' | 'yearly'
  alertThreshold: number
  currentSpend: number
  status: 'active' | 'paused' | 'exceeded'
  percentage: number
  createdAt: string
  updatedAt: string
}

export default function BudgetsPage() {
  const { isDemoMode } = useAuth()
  const { showError } = useNotification()
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)

  useEffect(() => {
    if (!isDemoMode) {
      loadBudgets()
      loadAlerts()
    }
  }, [isDemoMode])

  const loadBudgets = async () => {
    try {
      setIsLoading(true)
      const response = await budgetsAPI.getBudgets()
      setBudgets(response.budgets || [])
    } catch (error) {
      console.error('Failed to load budgets:', error)
      showError('Failed to load budgets')
    } finally {
      setIsLoading(false)
    }
  }

  const loadAlerts = async () => {
    try {
      const response = await budgetsAPI.getBudgetAlerts()
      setAlerts(response.alerts || [])
    } catch (error) {
      console.error('Failed to load budget alerts:', error)
    }
  }

  const handleCreateBudget = () => {
    setEditingBudget(null)
    setIsFormOpen(true)
  }

  const handleEditBudget = (budget: Budget) => {
    setEditingBudget(budget)
    setIsFormOpen(true)
  }

  const handleFormSuccess = () => {
    loadBudgets()
    loadAlerts()
  }

  if (isDemoMode) {
    return (
      <Layout>
        <div className="p-6">
          <Breadcrumbs />
          <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Budgets Not Available in Demo Mode</h2>
            <p className="text-gray-600">
              Please sign in to create and manage budgets for your cloud providers.
            </p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-6">
        <Breadcrumbs />

        {/* Header */}
        <div className="mt-6 mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Budgets</h1>
            <p className="mt-2 text-gray-600">
              Set and monitor budgets for your cloud spending
            </p>
          </div>
          <button
            onClick={handleCreateBudget}
            className="flex items-center gap-2 px-4 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Create Budget
          </button>
        </div>

        {/* Alerts Section */}
        {alerts.length > 0 && (
          <div className="mb-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <h2 className="text-lg font-semibold text-gray-900">Budget Alerts</h2>
            </div>
            <div className="space-y-2">
              {alerts.map((alert, index) => (
                <div key={index} className="text-sm text-gray-700">
                  <span className="font-medium">{alert.budgetName}:</span> {alert.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className="mb-8 bg-accent-50 border border-accent-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-accent-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-700">
              <p className="font-medium mb-1">About Budgets</p>
              <p>
                Create budgets to track your cloud spending and receive alerts when you approach or exceed your limits.
                Budgets can be set for specific providers, accounts, or across all providers. You'll receive alerts when
                spending reaches your configured threshold (default: 80%).
              </p>
            </div>
          </div>
        </div>

        {/* Budgets Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-600 mx-auto mb-4" />
              <p className="text-gray-500">Loading budgets...</p>
            </div>
          </div>
        ) : budgets.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="h-16 w-16 bg-accent-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="h-8 w-8 text-accent-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Budgets Yet</h3>
              <p className="text-gray-600 mb-6">
                Create your first budget to start tracking and controlling your cloud spending.
              </p>
              <button
                onClick={handleCreateBudget}
                className="px-4 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 transition-colors"
              >
                Create Your First Budget
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {budgets.map((budget) => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                onUpdate={loadBudgets}
                onEdit={handleEditBudget}
              />
            ))}
          </div>
        )}

        {/* Budget Form Modal */}
        {isFormOpen && (
          <BudgetForm
            budget={editingBudget}
            onClose={() => {
              setIsFormOpen(false)
              setEditingBudget(null)
            }}
            onSuccess={handleFormSuccess}
          />
        )}
      </div>
    </Layout>
  )
}
