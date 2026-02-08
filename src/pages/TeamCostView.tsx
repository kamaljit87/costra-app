import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Users, Info, RefreshCw } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'
import { productTeamAPI } from '../services/api'
import Layout from '../components/Layout'
import Breadcrumbs from '../components/Breadcrumbs'
import TeamCostCard from '../components/TeamCostCard'

interface TeamCost {
  teamName: string
  totalCost: number
  resourceCount: number
  serviceCount: number
  services: string[]
}

export default function TeamCostView() {
  const { isDemoMode } = useAuth()
  const { showError } = useNotification()
  const [searchParams] = useSearchParams()
  const providerId = searchParams.get('providerId') || undefined
  const accountId = searchParams.get('accountId') ? parseInt(searchParams.get('accountId')!) : undefined
  
  const [teams, setTeams] = useState<TeamCost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Default to last 30 days
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    if (!isDemoMode) {
      loadTeams()
    }
  }, [isDemoMode, startDate, endDate, providerId, accountId])

  const loadTeams = async () => {
    try {
      setIsLoading(true)
      const response = await productTeamAPI.getCostByTeam(
        startDate,
        endDate,
        providerId,
        accountId
      )
      setTeams(response.teams || [])
    } catch (error) {
      console.error('Failed to load teams:', error)
      showError('Failed to load team costs')
    } finally {
      setIsLoading(false)
    }
  }

  if (isDemoMode) {
    return (
      <Layout>
        <div className="p-6">
          <Breadcrumbs />
          <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <Users className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Team Costs Not Available in Demo Mode</h2>
            <p className="text-gray-600">
              Please sign in to view team-level cost allocation.
            </p>
          </div>
        </div>
      </Layout>
    )
  }

  const totalCost = teams.reduce((sum, t) => sum + t.totalCost, 0)

  return (
    <Layout>
      <div className="p-6">
        <Breadcrumbs />

        {/* Header */}
        <div className="mt-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Users className="h-8 w-8 text-accent-600" />
                Team Costs
              </h1>
              <p className="mt-2 text-gray-600">
                View costs aggregated by team tags
              </p>
            </div>
            <button
              onClick={loadTeams}
              className="flex items-center gap-2 px-4 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 transition-colors"
            >
              <RefreshCw className="h-5 w-5" />
              Refresh
            </button>
          </div>

          {/* Date Range Selector */}
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
              />
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="mb-8 bg-accent-50 border border-accent-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-accent-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-700">
              <p className="font-medium mb-1">About Team Costs</p>
              <p>
                Costs are aggregated by resources tagged with "team", "teamname", "team_name", or "owner" tags.
                Resources without these tags are grouped as "Untagged". Use this view for showback/chargeback
                reporting and team accountability.
              </p>
            </div>
          </div>
        </div>

        {/* Summary */}
        {teams.length > 0 && (
          <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Team Costs</span>
              <span className="text-2xl font-bold text-gray-900">
                ${totalCost.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Teams Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 text-accent-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Loading team costs...</p>
            </div>
          </div>
        ) : teams.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Team Costs Found</h3>
            <p className="text-gray-600">
              No resources with team tags found for the selected period. Tag your resources with
              "team", "teamname", "team_name", or "owner" tags to see team-level cost allocation.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team) => (
              <TeamCostCard
                key={team.teamName}
                team={team}
                startDate={startDate}
                endDate={endDate}
                providerId={providerId}
                accountId={accountId}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
