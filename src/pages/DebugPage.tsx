import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import { costDataAPI, cloudProvidersAPI, syncAPI } from '../services/api'
import { Bug, RefreshCw, Database, Calendar, Cloud, ArrowRight, AlertTriangle, CheckCircle } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

interface DebugResponse {
  endpoint: string
  timestamp: string
  status: 'success' | 'error'
  statusCode?: number
  data: any
  error?: string
  duration: number
}

export default function DebugPage() {
  const { isDemoMode } = useAuth()
  const [providers, setProviders] = useState<any[]>([])
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [responses, setResponses] = useState<DebugResponse[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'daily' | 'cost' | 'providers' | 'sync'>('daily')

  // Set default dates (last 30 days)
  useEffect(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)
    setEndDate(end.toISOString().split('T')[0])
    setStartDate(start.toISOString().split('T')[0])
  }, [])

  // Load providers on mount
  useEffect(() => {
    loadProviders()
  }, [])

  const addResponse = (response: DebugResponse) => {
    setResponses(prev => [response, ...prev].slice(0, 20)) // Keep last 20 responses
  }

  const loadProviders = async () => {
    const startTime = Date.now()
    try {
      const result = await cloudProvidersAPI.getCloudProviders()
      addResponse({
        endpoint: 'GET /api/cloud-providers',
        timestamp: new Date().toISOString(),
        status: 'success',
        data: result,
        duration: Date.now() - startTime
      })
      setProviders(result.providers || [])
      if (result.providers?.length > 0 && !selectedProvider) {
        setSelectedProvider(result.providers[0].providerId)
      }
    } catch (error: any) {
      addResponse({
        endpoint: 'GET /api/cloud-providers',
        timestamp: new Date().toISOString(),
        status: 'error',
        error: error.message,
        data: null,
        duration: Date.now() - startTime
      })
    }
  }

  const fetchDailyCostData = async () => {
    if (!selectedProvider || !startDate || !endDate) {
      alert('Please select a provider and date range')
      return
    }

    setIsLoading(true)
    const startTime = Date.now()
    const endpoint = `GET /api/cost-data/${selectedProvider}/daily?startDate=${startDate}&endDate=${endDate}`
    
    try {
      const result = await costDataAPI.getDailyCostData(selectedProvider, startDate, endDate)
      addResponse({
        endpoint,
        timestamp: new Date().toISOString(),
        status: 'success',
        data: result,
        duration: Date.now() - startTime
      })
    } catch (error: any) {
      addResponse({
        endpoint,
        timestamp: new Date().toISOString(),
        status: 'error',
        error: error.message,
        data: null,
        duration: Date.now() - startTime
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCostData = async () => {
    setIsLoading(true)
    const startTime = Date.now()
    const endpoint = 'GET /api/cost-data'
    
    try {
      const result = await costDataAPI.getCostData()
      addResponse({
        endpoint,
        timestamp: new Date().toISOString(),
        status: 'success',
        data: result,
        duration: Date.now() - startTime
      })
    } catch (error: any) {
      addResponse({
        endpoint,
        timestamp: new Date().toISOString(),
        status: 'error',
        error: error.message,
        data: null,
        duration: Date.now() - startTime
      })
    } finally {
      setIsLoading(false)
    }
  }

  const triggerSync = async (providerId?: string) => {
    setIsLoading(true)
    const startTime = Date.now()
    const endpoint = providerId ? `POST /api/sync/${providerId}` : 'POST /api/sync'
    
    try {
      const result = providerId 
        ? await syncAPI.syncProvider(providerId)
        : await syncAPI.syncAll()
      addResponse({
        endpoint,
        timestamp: new Date().toISOString(),
        status: 'success',
        data: result,
        duration: Date.now() - startTime
      })
    } catch (error: any) {
      addResponse({
        endpoint,
        timestamp: new Date().toISOString(),
        status: 'error',
        error: error.message,
        data: null,
        duration: Date.now() - startTime
      })
    } finally {
      setIsLoading(false)
    }
  }

  const setDateRange = (days: number) => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    setEndDate(end.toISOString().split('T')[0])
    setStartDate(start.toISOString().split('T')[0])
  }

  const clearResponses = () => {
    setResponses([])
  }

  if (isDemoMode) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <Bug className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Debug Page</h2>
            <p className="text-gray-600">Debug page is not available in demo mode.</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <Bug className="h-8 w-8 text-orange-500" />
            <h1 className="text-3xl font-bold text-gray-900">API Debug Console</h1>
          </div>
          <p className="text-gray-600">
            View raw API responses to troubleshoot data fetching issues
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex space-x-2 border-b border-gray-200">
            {[
              { id: 'daily', label: 'Daily Cost Data', icon: Calendar },
              { id: 'cost', label: 'Cost Summary', icon: Database },
              { id: 'providers', label: 'Providers', icon: Cloud },
              { id: 'sync', label: 'Sync', icon: RefreshCw },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Controls Panel */}
          <div className="lg:col-span-1">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Parameters</h3>

              {/* Provider Selection */}
              {(activeTab === 'daily' || activeTab === 'sync') && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Provider
                  </label>
                  <select
                    value={selectedProvider}
                    onChange={(e) => setSelectedProvider(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select a provider</option>
                    {providers.map(p => (
                      <option key={p.providerId} value={p.providerId}>
                        {p.providerName} ({p.providerId})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date Range */}
              {activeTab === 'daily' && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  {/* Quick Date Range Buttons */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quick Range
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { days: 30, label: '30 Days' },
                        { days: 60, label: '60 Days' },
                        { days: 120, label: '4 Months' },
                        { days: 180, label: '6 Months' },
                      ].map(range => (
                        <button
                          key={range.days}
                          onClick={() => setDateRange(range.days)}
                          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
                        >
                          {range.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 mt-6">
                {activeTab === 'daily' && (
                  <button
                    onClick={fetchDailyCostData}
                    disabled={isLoading || !selectedProvider}
                    className="w-full btn-primary flex items-center justify-center space-x-2"
                  >
                    {isLoading ? (
                      <Spinner variant="bars" size={16} />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                    <span>Fetch Daily Cost Data</span>
                  </button>
                )}

                {activeTab === 'cost' && (
                  <button
                    onClick={fetchCostData}
                    disabled={isLoading}
                    className="w-full btn-primary flex items-center justify-center space-x-2"
                  >
                    {isLoading ? (
                      <Spinner variant="bars" size={16} />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                    <span>Fetch Cost Summary</span>
                  </button>
                )}

                {activeTab === 'providers' && (
                  <button
                    onClick={loadProviders}
                    disabled={isLoading}
                    className="w-full btn-primary flex items-center justify-center space-x-2"
                  >
                    {isLoading ? (
                      <Spinner variant="bars" size={16} />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                    <span>Fetch Providers</span>
                  </button>
                )}

                {activeTab === 'sync' && (
                  <>
                    <button
                      onClick={() => triggerSync(selectedProvider)}
                      disabled={isLoading || !selectedProvider}
                      className="w-full btn-primary flex items-center justify-center space-x-2"
                    >
                      {isLoading ? (
                        <Spinner variant="bars" size={16} />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      <span>Sync Selected Provider</span>
                    </button>
                    <button
                      onClick={() => triggerSync()}
                      disabled={isLoading}
                      className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center justify-center space-x-2"
                    >
                      {isLoading ? (
                        <Spinner variant="bars" size={16} />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      <span>Sync All Providers</span>
                    </button>
                  </>
                )}

                <button
                  onClick={clearResponses}
                  className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Clear Responses
                </button>
              </div>
            </div>

            {/* Request Info */}
            {activeTab === 'daily' && selectedProvider && startDate && endDate && (
              <div className="card mt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Request Preview</h4>
                <code className="block text-xs bg-gray-100 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all">
                  GET /api/cost-data/{selectedProvider}/daily?startDate={startDate}&endDate={endDate}
                </code>
              </div>
            )}
          </div>

          {/* Response Panel */}
          <div className="lg:col-span-2">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">API Responses</h3>
                <span className="text-sm text-gray-500">
                  {responses.length} response(s)
                </span>
              </div>

              {responses.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No API calls yet. Use the controls to fetch data.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {responses.map((response, index) => (
                    <div
                      key={index}
                      className={`border rounded-lg overflow-hidden ${
                        response.status === 'success' ? 'border-green-200' : 'border-red-200'
                      }`}
                    >
                      {/* Response Header */}
                      <div
                        className={`px-4 py-2 flex items-center justify-between ${
                          response.status === 'success' ? 'bg-green-50' : 'bg-red-50'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          {response.status === 'success' ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                          )}
                          <span className="font-mono text-sm font-medium">
                            {response.endpoint}
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>{response.duration}ms</span>
                          <span>{new Date(response.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>

                      {/* Response Body */}
                      <div className="p-4 bg-gray-50">
                        {response.error ? (
                          <div className="text-red-600 text-sm mb-2">
                            <strong>Error:</strong> {response.error}
                          </div>
                        ) : null}
                        
                        {/* Data Summary */}
                        {response.data && (
                          <div className="mb-2 text-sm text-gray-600">
                            {response.data.dailyData && (
                              <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded mr-2">
                                {response.data.dailyData.length} data points
                              </span>
                            )}
                            {response.data.costData && (
                              <span className="inline-block bg-purple-100 text-purple-800 px-2 py-1 rounded mr-2">
                                {response.data.costData.length} providers
                              </span>
                            )}
                            {response.data.providers && (
                              <span className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded mr-2">
                                {response.data.providers.length} providers configured
                              </span>
                            )}
                          </div>
                        )}

                        {/* Raw JSON */}
                        <details>
                          <summary className="cursor-pointer text-sm text-primary-600 hover:text-primary-700 font-medium">
                            View Raw JSON
                          </summary>
                          <pre className="mt-2 text-xs bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto max-h-96">
                            {JSON.stringify(response.data, null, 2)}
                          </pre>
                        </details>

                        {/* Daily Data Table */}
                        {response.data?.dailyData && response.data.dailyData.length > 0 && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-sm text-primary-600 hover:text-primary-700 font-medium">
                              View Data Table ({response.data.dailyData.length} rows)
                            </summary>
                            <div className="mt-2 max-h-64 overflow-y-auto">
                              <table className="w-full text-xs">
                                <thead className="bg-gray-200 sticky top-0">
                                  <tr>
                                    <th className="px-2 py-1 text-left">#</th>
                                    <th className="px-2 py-1 text-left">Date</th>
                                    <th className="px-2 py-1 text-right">Cost</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {response.data.dailyData.map((row: any, i: number) => (
                                    <tr key={i} className="border-b border-gray-100">
                                      <td className="px-2 py-1 text-gray-500">{i + 1}</td>
                                      <td className="px-2 py-1 font-mono">{row.date}</td>
                                      <td className="px-2 py-1 text-right font-mono">
                                        ${typeof row.cost === 'number' ? row.cost.toFixed(2) : row.cost}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
