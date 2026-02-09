import { useState, useEffect } from 'react'
import { useCurrency } from '../contexts/CurrencyContext'
import { Gift, Calendar, TrendingUp, Info, ExternalLink } from 'lucide-react'
import { costDataAPI } from '../services/api'

interface CreditDetail {
  creditName?: string
  issuedAmount?: number
  expirationDate?: string
  amountUsed: number
  amountRemaining?: number
  applicableProducts?: string[]
  creditType?: string
  date?: string
}

interface CreditsDetailProps {
  providerId: string
  accountId?: number
  startDate: string
  endDate: string
  isDemoMode?: boolean
}

export default function CreditsDetail({ providerId, accountId, startDate, endDate, isDemoMode }: CreditsDetailProps) {
  const { formatCurrency } = useCurrency()
  const [credits, setCredits] = useState<CreditDetail[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [summary, setSummary] = useState({
    totalRemaining: 0,
    totalUsed: 0,
    activeCredits: 0
  })

  useEffect(() => {
    if (isDemoMode) {
      // Demo data - similar to AWS console
      setCredits([
        {
          creditName: 'AWS Activate - Founders',
          issuedAmount: 1000,
          expirationDate: '2027-11-30',
          amountUsed: 107.93,
          amountRemaining: 892.07,
          applicableProducts: ['All AWS Services'],
          creditType: 'Promotional',
          date: new Date().toISOString().split('T')[0]
        }
      ])
      setSummary({
        totalRemaining: 892.07,
        totalUsed: 107.93,
        activeCredits: 1
      })
      setIsLoading(false)
      return
    }

    loadCredits()
  }, [providerId, accountId, startDate, endDate, isDemoMode])

  const loadCredits = async () => {
    if (!providerId || isDemoMode) return

    setIsLoading(true)
    try {
      // Fetch detailed credit information from API
      const response = await costDataAPI.getCreditsDetail(providerId, startDate, endDate, accountId)
      
      const creditsData: CreditDetail[] = response.creditsDetail || []
      
      // If we have credits but no detailed breakdown, create a summary entry
      if (response.credits > 0 && creditsData.length === 0) {
        creditsData.push({
          creditName: 'Applied Credits',
          amountUsed: response.credits,
          creditType: 'Applied',
          date: endDate
        })
      }

      setCredits(creditsData)
      
      // Use summary from API or calculate it
      if (response.summary) {
        setSummary(response.summary)
      } else {
        const totalUsed = creditsData.reduce((sum, c) => sum + (c.amountUsed || 0), 0)
        const totalRemaining = creditsData.reduce((sum, c) => sum + (c.amountRemaining || 0), 0)
        
        setSummary({
          totalRemaining,
          totalUsed,
          activeCredits: creditsData.length
        })
      }
    } catch (error) {
      console.error('Failed to load credits:', error)
      // On error, show empty state
      setCredits([])
      setSummary({ totalRemaining: 0, totalUsed: 0, activeCredits: 0 })
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
    } catch {
      return dateString
    }
  }

  if (isLoading) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-500">Loading credit information...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary Section */}
      <div className="card p-5 bg-gradient-to-br from-[#F0FDF4] to-[#ECFDF5] border-accent-200">
        <div className="flex items-center gap-2 mb-4">
          <Gift className="h-5 w-5 text-[#16A34A]" />
          <h3 className="text-lg font-semibold text-gray-900">Credit Summary</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-gray-500 mb-1.5 uppercase tracking-wide">Total Amount Remaining</div>
            <div className="text-2xl font-bold text-[#16A34A]">
              {formatCurrency(summary.totalRemaining)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1.5 uppercase tracking-wide">Total Amount Used</div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(summary.totalUsed)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1.5 uppercase tracking-wide">Active Credits</div>
            <div className="text-2xl font-bold text-accent-700">
              {summary.activeCredits}
            </div>
          </div>
        </div>
      </div>

      {/* Active Credits Table */}
      <div className="card p-0 overflow-hidden">
        <div className="p-4 border-b border-surface-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900">
              Active Credits ({summary.activeCredits})
            </h3>
            <div className="group relative">
              <Info className="h-4 w-4 text-gray-500 cursor-help" />
              <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                Credits are promotional credits, refunds, or account credits that reduce your total cost. They are automatically applied to your bill.
              </div>
            </div>
          </div>
          {providerId === 'aws' && (
            <a
              href="https://console.aws.amazon.com/billing/home#/credits"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-accent-500 hover:text-accent-700 hover:underline"
            >
              View in AWS Console
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {credits.length === 0 ? (
          <div className="p-8 text-center">
            <Gift className="h-12 w-12 text-gray-500 mx-auto mb-3 opacity-50" />
            <p className="text-sm text-gray-500">No active credits found</p>
            <p className="text-xs text-gray-500 mt-1">
              Credits will appear here when available from your cloud provider
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle sm:rounded-lg">
              <div className="overflow-hidden sm:rounded-lg border border-gray-200">
                <table className="w-full divide-y divide-gray-200">
              <thead className="bg-surface-50 border-b border-surface-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Credit Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Issued Credit Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Expiration Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Amount Used
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Amount Remaining
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Applicable Products
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {credits.map((credit, index) => (
                  <tr key={index} className="hover:bg-surface-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Gift className="h-4 w-4 text-[#16A34A]" />
                        <span className="text-sm font-medium text-gray-900">
                          {credit.creditName || credit.creditType || 'Credit'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-900">
                        {credit.issuedAmount 
                          ? formatCurrency(credit.issuedAmount)
                          : 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-gray-500" />
                        <span className="text-sm text-gray-500">
                          {formatDate(credit.expirationDate)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5 text-[#F59E0B]" />
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(credit.amountUsed || 0)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-[#16A34A]">
                        {credit.amountRemaining 
                          ? formatCurrency(credit.amountRemaining)
                          : 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {credit.applicableProducts && credit.applicableProducts.length > 0 ? (
                          credit.applicableProducts.map((product, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-[#EFF6FF] text-accent-700 border border-[#DBEAFE]"
                            >
                              {product}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-500">All services</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Information Note */}
      <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-xl p-4">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-[#F59E0B] mt-0.5 flex-shrink-0" />
          <div className="text-xs text-[#92400E]">
            <p className="font-medium mb-1">About Credits</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Credits are automatically applied to reduce your bill</li>
              <li>Expired credits cannot be used</li>
              <li>Credit information is fetched from your cloud provider's billing API</li>
              <li>For detailed credit information, visit your cloud provider's billing console</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
