import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Wallet } from 'lucide-react'
import { budgetsAPI } from '../services/api'
import { useCurrency } from '../contexts/CurrencyContext'
import { useAuth } from '../contexts/AuthContext'

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
}

export default function BudgetWidget() {
  const { convertAmount } = useCurrency()
  const { isDemoMode } = useAuth()
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isDemoMode) {
      loadData()
    }
  }, [isDemoMode])

  const loadData = async () => {
    try {
      const [budgetsResponse, alertsResponse] = await Promise.all([
        budgetsAPI.getBudgets().catch(() => ({ budgets: [] })),
        budgetsAPI.getBudgetAlerts().catch(() => ({ alerts: [] })),
      ])
      setBudgets(budgetsResponse.budgets || [])
      setAlerts(alertsResponse.alerts || [])
    } catch (error) {
      console.error('Failed to load budget data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isDemoMode || isLoading) {
    return null
  }

  if (budgets.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200/60 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-frozenWater-600" />
            <h3 className="text-lg font-semibold text-gray-900">Budgets</h3>
          </div>
          <Link
            to="/budgets"
            className="text-sm text-frozenWater-600 hover:text-frozenWater-700 font-medium"
          >
            Manage
          </Link>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          No budgets configured. Create one to track your spending.
        </p>
        <Link
          to="/budgets"
          className="inline-flex items-center gap-2 px-4 py-2 bg-frozenWater-600 text-white rounded-lg hover:bg-frozenWater-700 transition-colors text-sm"
        >
          <Wallet className="h-4 w-4" />
          Create Budget
        </Link>
      </div>
    )
  }

  const activeBudgets = budgets.filter(b => b.status === 'active')
  const exceededBudgets = budgets.filter(b => b.percentage >= 100)
  const warningBudgets = budgets.filter(b => b.percentage >= b.alertThreshold && b.percentage < 100)

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-[#22B8A0]" />
          <h3 className="text-base font-semibold text-[#0F172A]">Budgets</h3>
        </div>
        <Link
          to="/budgets"
          className="text-xs text-[#22B8A0] hover:text-[#1F3A5F] font-medium"
        >
          View All
        </Link>
      </div>

      {/* Alerts Summary */}
      {alerts.length > 0 && (
        <div className="mb-3 bg-[#FEF3C7] border border-[#FDE68A] rounded-xl p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="h-3.5 w-3.5 text-[#F59E0B]" />
            <span className="text-xs font-semibold text-[#92400E]">
              {alerts.length} Budget Alert{alerts.length > 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-[10px] text-[#78350F]">
            {exceededBudgets.length > 0 && `${exceededBudgets.length} exceeded`}
            {exceededBudgets.length > 0 && warningBudgets.length > 0 && ', '}
            {warningBudgets.length > 0 && `${warningBudgets.length} approaching limit`}
          </p>
        </div>
      )}

      {/* Budget Summary Stats */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center">
          <div className="text-xl font-bold text-[#0F172A]">{activeBudgets.length}</div>
          <div className="text-[10px] text-[#64748B]">Active</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-[#F59E0B]">{warningBudgets.length}</div>
          <div className="text-[10px] text-[#64748B]">Warning</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-[#DC2626]">{exceededBudgets.length}</div>
          <div className="text-[10px] text-[#64748B]">Exceeded</div>
        </div>
      </div>

      {/* Top Budgets */}
      <div className="space-y-2">
        {budgets.slice(0, 3).map((budget) => {
          const progressWidth = Math.min(budget.percentage, 100)
          return (
            <div key={budget.id} className="border border-[#E2E8F0] rounded-xl p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-[#0F172A] truncate">
                  {budget.budgetName}
                </span>
                <span className={`text-[10px] font-semibold ${
                  budget.percentage >= 100
                    ? 'text-[#DC2626]'
                    : budget.percentage >= budget.alertThreshold
                    ? 'text-[#F59E0B]'
                    : 'text-[#22B8A0]'
                }`}>
                  {budget.percentage.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-[#E2E8F0] rounded-full h-1.5 mb-1">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    budget.percentage >= 100
                      ? 'bg-[#DC2626]'
                      : budget.percentage >= budget.alertThreshold
                      ? 'bg-[#F59E0B]'
                      : 'bg-[#22B8A0]'
                  }`}
                  style={{ width: `${progressWidth}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#64748B]">
                <span>{convertAmount(budget.currentSpend)}</span>
                <span>of {convertAmount(budget.budgetAmount)}</span>
              </div>
            </div>
          )
        })}
      </div>

      {budgets.length > 3 && (
        <Link
          to="/budgets"
          className="mt-3 block text-center text-xs text-[#22B8A0] hover:text-[#1F3A5F] font-medium"
        >
          View all {budgets.length} budgets →
        </Link>
      )}
    </div>
  )
}
