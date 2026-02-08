import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { budgetsAPI } from '../services/api'
import { useNotification } from '../contexts/NotificationContext'
import { cloudProvidersAPI } from '../services/api'

interface Budget {
  id?: number
  budgetName: string
  providerId?: string
  accountId?: number
  budgetAmount: number
  budgetPeriod: 'monthly' | 'quarterly' | 'yearly'
  alertThreshold: number
}

interface BudgetFormProps {
  budget?: Budget | null
  onClose: () => void
  onSuccess: () => void
}

interface CloudProviderAccount {
  id: number
  accountId: number
  providerId: string
  providerName: string
  accountAlias: string
  isActive: boolean
}

export default function BudgetForm({ budget, onClose, onSuccess }: BudgetFormProps) {
  const { showSuccess, showError } = useNotification()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [providers, setProviders] = useState<CloudProviderAccount[]>([])
  const [formData, setFormData] = useState<Budget>({
    budgetName: budget?.budgetName || '',
    providerId: budget?.providerId || '',
    accountId: budget?.accountId,
    budgetAmount: budget?.budgetAmount || 0,
    budgetPeriod: budget?.budgetPeriod || 'monthly',
    alertThreshold: budget?.alertThreshold || 80,
  })
  const [createInCloudProvider, setCreateInCloudProvider] = useState(false)

  useEffect(() => {
    loadProviders()
  }, [])

  const loadProviders = async () => {
    try {
      const response = await cloudProvidersAPI.getCloudProviders()
      setProviders(response.providers || [])
    } catch (error) {
      console.error('Failed to load providers:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (budget?.id) {
        // Update existing budget
        await budgetsAPI.updateBudget(budget.id, formData)
        showSuccess('Budget updated successfully')
      } else {
        // Create new budget
        await budgetsAPI.createBudget({
          ...formData,
          accountId: formData.accountId || undefined,
          providerId: formData.providerId || undefined,
          createInCloudProvider: createInCloudProvider && formData.providerId ? true : false,
        })
        showSuccess(
          createInCloudProvider && formData.providerId
            ? 'Budget created successfully in app and cloud provider'
            : 'Budget created successfully'
        )
      }
      onSuccess()
      onClose()
    } catch (error: any) {
      showError(error.message || 'Failed to save budget')
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredAccounts = formData.providerId
    ? providers.filter(p => p.providerId === formData.providerId)
    : providers

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {budget?.id ? 'Edit Budget' : 'Create Budget'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Budget Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Budget Name *
            </label>
            <input
              type="text"
              value={formData.budgetName}
              onChange={(e) => setFormData({ ...formData, budgetName: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300/60 rounded-xl focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500/60 transition-all"
              required
              placeholder="e.g., AWS Production Budget"
            />
          </div>

          {/* Provider (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cloud Provider (Optional)
            </label>
            <select
              value={formData.providerId || ''}
              onChange={(e) => setFormData({ ...formData, providerId: e.target.value || undefined, accountId: undefined })}
              className="w-full px-4 py-2.5 border border-gray-300/60 rounded-xl focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500/60 transition-all"
            >
              <option value="">All Providers</option>
              {Array.from(new Set(providers.map(p => p.providerId))).map(providerId => (
                <option key={providerId} value={providerId}>
                  {providerId.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Account (Optional, filtered by provider) */}
          {formData.providerId && filteredAccounts.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account (Optional)
              </label>
              <select
                value={formData.accountId || ''}
                onChange={(e) => setFormData({ ...formData, accountId: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full px-4 py-2.5 border border-gray-300/60 rounded-xl focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500/60 transition-all"
              >
                <option value="">All Accounts</option>
                {filteredAccounts.map(account => (
                  <option key={account.accountId} value={account.accountId}>
                    {account.accountAlias || `${account.providerName} - Account ${account.accountId}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Budget Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Budget Amount ($) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.budgetAmount}
              onChange={(e) => setFormData({ ...formData, budgetAmount: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-2.5 border border-gray-300/60 rounded-xl focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500/60 transition-all"
              required
              placeholder="5000.00"
            />
          </div>

          {/* Budget Period */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Budget Period *
            </label>
            <select
              value={formData.budgetPeriod}
              onChange={(e) => setFormData({ ...formData, budgetPeriod: e.target.value as 'monthly' | 'quarterly' | 'yearly' })}
              className="w-full px-4 py-2.5 border border-gray-300/60 rounded-xl focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500/60 transition-all"
              required
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          {/* Alert Threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Alert Threshold (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={formData.alertThreshold}
              onChange={(e) => setFormData({ ...formData, alertThreshold: parseInt(e.target.value) || 80 })}
              className="w-full px-4 py-2.5 border border-gray-300/60 rounded-xl focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500/60 transition-all"
              placeholder="80"
            />
            <p className="mt-1 text-xs text-gray-500">
              Receive alerts when spending reaches this percentage of the budget
            </p>
          </div>

          {/* Create in Cloud Provider */}
          {!budget?.id && formData.providerId && formData.accountId && (
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <input
                type="checkbox"
                id="createInCloudProvider"
                checked={createInCloudProvider}
                onChange={(e) => setCreateInCloudProvider(e.target.checked)}
                className="mt-1 h-4 w-4 text-accent-600 focus:ring-accent-500 border-gray-300 rounded"
              />
              <div className="flex-1">
                <label htmlFor="createInCloudProvider" className="block text-sm font-medium text-gray-900 cursor-pointer">
                  Also create budget in {formData.providerId.toUpperCase()}
                </label>
                <p className="mt-1 text-xs text-gray-600">
                  This will create the budget directly in your cloud provider account, enabling native budget alerts and management.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Saving...' : budget?.id ? 'Update Budget' : 'Create Budget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
