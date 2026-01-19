import { useState } from 'react'
import { AlertTriangle, DollarSign, Calendar, Target, MoreVertical, Edit, Trash2, Pause, Play } from 'lucide-react'
import { budgetsAPI } from '../services/api'
import { useNotification } from '../contexts/NotificationContext'
import { useCurrency } from '../contexts/CurrencyContext'

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

interface BudgetCardProps {
  budget: Budget
  onUpdate: () => void
  onEdit: (budget: Budget) => void
}

export default function BudgetCard({ budget, onUpdate, onEdit }: BudgetCardProps) {
  const { convertAmount } = useCurrency()
  const { showSuccess, showError } = useNotification()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const getStatusColor = () => {
    if (budget.percentage >= 100) return 'text-red-600 bg-red-50 border-red-200'
    if (budget.percentage >= budget.alertThreshold) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    return 'text-frozenWater-600 bg-frozenWater-50 border-frozenWater-200'
  }

  const getStatusIcon = () => {
    if (budget.percentage >= 100) return <AlertTriangle className="h-5 w-5 text-red-600" />
    if (budget.percentage >= budget.alertThreshold) return <AlertTriangle className="h-5 w-5 text-yellow-600" />
    return null
  }

  const getStatusText = () => {
    if (budget.status === 'paused') return 'Paused'
    if (budget.percentage >= 100) return 'Exceeded'
    if (budget.percentage >= budget.alertThreshold) return 'Warning'
    return 'On Track'
  }

  const handleTogglePause = async () => {
    setIsUpdating(true)
    try {
      const newStatus = budget.status === 'paused' ? 'active' : 'paused'
      await budgetsAPI.updateBudget(budget.id, { status: newStatus })
      showSuccess(`Budget ${newStatus === 'paused' ? 'paused' : 'resumed'} successfully`)
      onUpdate()
    } catch (error) {
      showError('Failed to update budget status')
    } finally {
      setIsUpdating(false)
      setIsMenuOpen(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${budget.budgetName}"?`)) return
    
    setIsUpdating(true)
    try {
      await budgetsAPI.deleteBudget(budget.id)
      showSuccess('Budget deleted successfully')
      onUpdate()
    } catch (error) {
      showError('Failed to delete budget')
    } finally {
      setIsUpdating(false)
      setIsMenuOpen(false)
    }
  }

  const progressWidth = Math.min(budget.percentage, 100)

  return (
    <div className={`bg-white rounded-lg border-2 ${getStatusColor()} p-6 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">{budget.budgetName}</h3>
            {getStatusIcon()}
          </div>
          {budget.providerId && (
            <p className="text-sm text-gray-500 capitalize">{budget.providerId}</p>
          )}
        </div>
        
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            disabled={isUpdating}
          >
            <MoreVertical className="h-5 w-5 text-gray-600" />
          </button>
          
          {isMenuOpen && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setIsMenuOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                <button
                  onClick={() => {
                    onEdit(budget)
                    setIsMenuOpen(false)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </button>
                <button
                  onClick={handleTogglePause}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  {budget.status === 'paused' ? (
                    <>
                      <Play className="h-4 w-4" />
                      Resume
                    </>
                  ) : (
                    <>
                      <Pause className="h-4 w-4" />
                      Pause
                    </>
                  )}
                </button>
                <button
                  onClick={handleDelete}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Budget Amount and Period */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-600">
            <DollarSign className="h-5 w-5" />
            <span className="text-sm">Budget</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar className="h-5 w-5" />
            <span className="text-sm capitalize">{budget.budgetPeriod}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl font-bold text-gray-900">
              {convertAmount(budget.currentSpend)}
            </span>
            <span className="text-sm text-gray-500">
              of {convertAmount(budget.budgetAmount)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                budget.percentage >= 100
                  ? 'bg-red-500'
                  : budget.percentage >= budget.alertThreshold
                  ? 'bg-yellow-500'
                  : 'bg-frozenWater-500'
              }`}
              style={{ width: `${progressWidth}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className={`text-sm font-medium ${getStatusColor().split(' ')[0]}`}>
              {getStatusText()}
            </span>
            <span className="text-sm text-gray-600">
              {budget.percentage.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Alert Threshold */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Target className="h-4 w-4" />
          <span>Alert at {budget.alertThreshold}%</span>
        </div>
      </div>
    </div>
  )
}
