import { useState, useEffect } from 'react'
import { cloudProvidersAPI } from '../services/api'
import { Plus, Trash2, CheckCircle, XCircle, Cloud, Settings } from 'lucide-react'

interface CloudProvider {
  id: number
  providerId: string
  providerName: string
  isActive: boolean
  lastSyncAt: string | null
  createdAt: string
}

interface CloudProviderManagerProps {
  onProviderChange?: () => void
}

const AVAILABLE_PROVIDERS = [
  { id: 'aws', name: 'Amazon Web Services', icon: '☁️', color: 'orange' },
  { id: 'azure', name: 'Microsoft Azure', icon: '🔷', color: 'blue' },
  { id: 'gcp', name: 'Google Cloud Platform', icon: '🔵', color: 'blue' },
  { id: 'digitalocean', name: 'DigitalOcean', icon: '🌊', color: 'blue' },
  { id: 'linode', name: 'Linode', icon: '🟢', color: 'green' },
  { id: 'vultr', name: 'Vultr', icon: '⚡', color: 'purple' },
]

export default function CloudProviderManager({ onProviderChange }: CloudProviderManagerProps) {
  const [providers, setProviders] = useState<CloudProvider[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [credentials, setCredentials] = useState<{ [key: string]: string }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadProviders()
  }, [])

  const loadProviders = async () => {
    try {
      setIsLoading(true)
      const response = await cloudProvidersAPI.getCloudProviders()
      setProviders(response.providers || [])
    } catch (error: any) {
      console.error('Failed to load providers:', error)
      setError(error.message || 'Failed to load cloud providers')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddProvider = async () => {
    if (!selectedProvider) {
      setError('Please select a cloud provider')
      return
    }

    const provider = AVAILABLE_PROVIDERS.find(p => p.id === selectedProvider)
    if (!provider) {
      setError('Invalid provider selected')
      return
    }

    // Validate credentials based on provider
    const requiredFields = getRequiredFields(selectedProvider)
    const missingFields = requiredFields.filter(field => !credentials[field])
    
    if (missingFields.length > 0) {
      setError(`Missing required fields: ${missingFields.join(', ')}`)
      return
    }

    try {
      setIsSubmitting(true)
      setError('')
      await cloudProvidersAPI.addCloudProvider(
        selectedProvider,
        provider.name,
        credentials
      )
      setShowAddModal(false)
      setSelectedProvider('')
      setCredentials({})
      await loadProviders()
      onProviderChange?.()
    } catch (error: any) {
      setError(error.message || 'Failed to add cloud provider')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteProvider = async (providerId: string) => {
    if (!confirm(`Are you sure you want to remove ${providerId}? This will delete all associated credentials.`)) {
      return
    }

    try {
      await cloudProvidersAPI.deleteCloudProvider(providerId)
      await loadProviders()
      onProviderChange?.()
    } catch (error: any) {
      setError(error.message || 'Failed to delete cloud provider')
    }
  }

  const handleToggleStatus = async (providerId: string, currentStatus: boolean) => {
    try {
      await cloudProvidersAPI.updateProviderStatus(providerId, !currentStatus)
      await loadProviders()
      onProviderChange?.()
    } catch (error: any) {
      setError(error.message || 'Failed to update provider status')
    }
  }

  const getRequiredFields = (providerId: string): string[] => {
    switch (providerId) {
      case 'aws':
        return ['accessKeyId', 'secretAccessKey', 'region']
      case 'azure':
        return ['subscriptionId', 'clientId', 'clientSecret', 'tenantId']
      case 'gcp':
        return ['projectId', 'serviceAccountKey']
      default:
        return ['apiKey']
    }
  }

  const getProviderInfo = (providerId: string) => {
    return AVAILABLE_PROVIDERS.find(p => p.id === providerId) || { name: providerId, icon: '☁️' }
  }

  const getAvailableProviders = () => {
    const connectedIds = providers.map(p => p.providerId)
    return AVAILABLE_PROVIDERS.filter(p => !connectedIds.includes(p.id))
  }

  if (isLoading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-600">Loading cloud providers...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Cloud className="h-5 w-5 mr-2 text-primary-600" />
            Cloud Providers
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Manage your cloud provider integrations
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Provider
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {providers.length === 0 ? (
        <div className="text-center py-12">
          <Cloud className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No cloud providers connected</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary"
          >
            Add Your First Provider
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {providers.map((provider) => {
            const providerInfo = getProviderInfo(provider.providerId)
            return (
              <div
                key={provider.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex items-center space-x-4">
                  <div className="text-2xl">{providerInfo.icon}</div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {provider.providerName}
                    </div>
                    <div className="text-sm text-gray-600">
                      {provider.providerId.toUpperCase()}
                      {provider.lastSyncAt && (
                        <span className="ml-2">
                          • Last sync: {new Date(provider.lastSyncAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleToggleStatus(provider.providerId, provider.isActive)}
                    className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium ${
                      provider.isActive
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {provider.isActive ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Active
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 mr-1" />
                        Inactive
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleDeleteProvider(provider.providerId)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete provider"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Provider Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Add Cloud Provider</h3>
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setSelectedProvider('')
                    setCredentials({})
                    setError('')
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Provider
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {getAvailableProviders().map((provider) => (
                      <button
                        key={provider.id}
                        onClick={() => {
                          setSelectedProvider(provider.id)
                          setCredentials({})
                          setError('')
                        }}
                        className={`p-4 border-2 rounded-lg text-left transition-colors ${
                          selectedProvider === provider.id
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-2xl mb-2">{provider.icon}</div>
                        <div className="font-medium text-gray-900">{provider.name}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedProvider && (
                  <div className="space-y-4 pt-4 border-t border-gray-200">
                    <h4 className="font-medium text-gray-900">Credentials</h4>
                    {getRequiredFields(selectedProvider).map((field) => (
                      <div key={field}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1')}
                        </label>
                        <input
                          type={field.toLowerCase().includes('secret') || field.toLowerCase().includes('key') ? 'password' : 'text'}
                          value={credentials[field] || ''}
                          onChange={(e) =>
                            setCredentials({ ...credentials, [field]: e.target.value })
                          }
                          className="input-field"
                          placeholder={`Enter ${field}`}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => {
                      setShowAddModal(false)
                      setSelectedProvider('')
                      setCredentials({})
                      setError('')
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddProvider}
                    disabled={isSubmitting || !selectedProvider}
                    className="btn-primary"
                  >
                    {isSubmitting ? 'Adding...' : 'Add Provider'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
