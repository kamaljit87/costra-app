import { useState, useEffect } from 'react'
import { cloudProvidersAPI } from '../services/api'
import { Plus, Trash2, CheckCircle, XCircle, Cloud, Edit2, X, Check, HelpCircle } from 'lucide-react'
import { ProviderIcon, getProviderColor } from './CloudProviderIcons'
import IAMPolicyDialog from './IAMPolicyDialog'

interface CloudProvider {
  id: number
  accountId: number
  providerId: string
  providerName: string
  accountAlias: string
  isActive: boolean
  lastSyncAt: string | null
  createdAt: string
}

interface CloudProviderManagerProps {
  onProviderChange?: () => void
}

const AVAILABLE_PROVIDERS = [
  { id: 'aws', name: 'Amazon Web Services' },
  { id: 'azure', name: 'Microsoft Azure' },
  { id: 'gcp', name: 'Google Cloud Platform' },
  { id: 'digitalocean', name: 'DigitalOcean' },
  { id: 'linode', name: 'Linode (Akamai)' },
  { id: 'vultr', name: 'Vultr' },
  { id: 'ibm', name: 'IBM Cloud' },
]

export default function CloudProviderManager({ onProviderChange }: CloudProviderManagerProps) {
  const [providers, setProviders] = useState<CloudProvider[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [accountAlias, setAccountAlias] = useState('')
  const [credentials, setCredentials] = useState<{ [key: string]: string }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [editingAliasId, setEditingAliasId] = useState<number | null>(null)
  const [editingAliasValue, setEditingAliasValue] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState<CloudProvider | null>(null)
  const [editCredentials, setEditCredentials] = useState<{ [key: string]: string }>({})
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(false)
  const [showIAMDialog, setShowIAMDialog] = useState(false)

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
        credentials,
        accountAlias || undefined
      )
      setShowAddModal(false)
      setSelectedProvider('')
      setAccountAlias('')
      setCredentials({})
      await loadProviders()
      onProviderChange?.()
    } catch (error: any) {
      setError(error.message || 'Failed to add cloud provider')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteProvider = async (accountId: number, accountAlias: string) => {
    if (!confirm(`Are you sure you want to remove "${accountAlias}"? This will delete all associated credentials and data.`)) {
      return
    }

    try {
      await cloudProvidersAPI.deleteCloudProviderAccount(accountId)
      await loadProviders()
      onProviderChange?.()
    } catch (error: any) {
      setError(error.message || 'Failed to delete cloud provider account')
    }
  }

  const handleToggleStatus = async (accountId: number, currentStatus: boolean) => {
    try {
      await cloudProvidersAPI.updateAccountStatus(accountId, !currentStatus)
      await loadProviders()
      onProviderChange?.()
    } catch (error: any) {
      setError(error.message || 'Failed to update account status')
    }
  }

  const handleStartEditAlias = (accountId: number, currentAlias: string) => {
    setEditingAliasId(accountId)
    setEditingAliasValue(currentAlias)
  }

  const handleSaveAlias = async (accountId: number) => {
    if (!editingAliasValue.trim()) {
      return
    }

    try {
      await cloudProvidersAPI.updateAccountAlias(accountId, editingAliasValue.trim())
      setEditingAliasId(null)
      setEditingAliasValue('')
      await loadProviders()
    } catch (error: any) {
      setError(error.message || 'Failed to update account alias')
    }
  }

  const handleCancelEditAlias = () => {
    setEditingAliasId(null)
    setEditingAliasValue('')
  }

  const handleStartEdit = async (account: CloudProvider) => {
    try {
      setIsLoadingCredentials(true)
      setError('')
      const response = await cloudProvidersAPI.getAccountCredentials(account.accountId)
      setEditCredentials(response.credentials || {})
      setEditingAccount(account)
      setShowEditModal(true)
    } catch (error: any) {
      setError(error.message || 'Failed to load account credentials')
    } finally {
      setIsLoadingCredentials(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!editingAccount) return

    const requiredFields = getRequiredFields(editingAccount.providerId)
    const missingFields = requiredFields.filter(field => !editCredentials[field])
    
    if (missingFields.length > 0) {
      setError(`Missing required fields: ${missingFields.join(', ')}`)
      return
    }

    try {
      setIsSubmitting(true)
      setError('')
      await cloudProvidersAPI.updateAccountCredentials(editingAccount.accountId, editCredentials)
      setShowEditModal(false)
      setEditingAccount(null)
      setEditCredentials({})
      await loadProviders()
      onProviderChange?.()
    } catch (error: any) {
      setError(error.message || 'Failed to update account credentials')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancelEdit = () => {
    setShowEditModal(false)
    setEditingAccount(null)
    setEditCredentials({})
    setError('')
  }

  const getRequiredFields = (providerId: string): string[] => {
    switch (providerId) {
      case 'aws':
        return ['accessKeyId', 'secretAccessKey', 'region']
      case 'azure':
        return ['subscriptionId', 'clientId', 'clientSecret', 'tenantId']
      case 'gcp':
        return ['projectId', 'serviceAccountKey']
      case 'digitalocean':
        return ['apiToken']
      case 'linode':
        return ['apiToken']
      case 'ibm':
        return ['apiKey', 'accountId']
      case 'vultr':
        return ['apiKey']
      default:
        return ['apiKey']
    }
  }

  // Count accounts per provider type
  const getAccountCount = (providerId: string) => {
    return providers.filter(p => p.providerId === providerId).length
  }

  // Group providers by type for display
  const groupedProviders = providers.reduce((acc, provider) => {
    if (!acc[provider.providerId]) {
      acc[provider.providerId] = []
    }
    acc[provider.providerId].push(provider)
    return acc
  }, {} as Record<string, CloudProvider[]>)

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
            Manage your cloud provider accounts (multiple accounts per provider supported)
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Account
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
          <button 
            onClick={() => setError('')}
            className="float-right text-red-500 hover:text-red-700"
          >
            ✕
          </button>
        </div>
      )}

      {providers.length === 0 ? (
        <div className="text-center py-12">
          <Cloud className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No cloud provider accounts connected</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary"
          >
            Add Your First Account
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedProviders).map(([providerId, accounts]) => (
            <div key={providerId} className="space-y-3">
              {/* Provider Header */}
              <div className="flex items-center space-x-2">
                <ProviderIcon providerId={providerId} size={20} />
                <span className="font-medium text-gray-700">
                  {AVAILABLE_PROVIDERS.find(p => p.id === providerId)?.name || providerId}
                </span>
                <span className="text-sm text-gray-500">
                  ({accounts.length} account{accounts.length > 1 ? 's' : ''})
                </span>
              </div>

              {/* Account Cards */}
              <div className="space-y-2 pl-7">
                {accounts.map((provider) => (
                  <div
                    key={provider.accountId}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      provider.isActive 
                        ? 'bg-gray-50 border-gray-200' 
                        : 'bg-gray-100 border-gray-300 opacity-75'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <div 
                        className="w-10 h-10 flex items-center justify-center rounded-lg" 
                        style={{ backgroundColor: `${getProviderColor(provider.providerId)}15` }}
                      >
                        <ProviderIcon providerId={provider.providerId} size={24} />
                      </div>
                      <div>
                        {editingAliasId === provider.accountId ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={editingAliasValue}
                              onChange={(e) => setEditingAliasValue(e.target.value)}
                              className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveAlias(provider.accountId)
                                if (e.key === 'Escape') handleCancelEditAlias()
                              }}
                            />
                            <button
                              onClick={() => handleSaveAlias(provider.accountId)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={handleCancelEditAlias}
                              className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900">
                              {provider.accountAlias}
                            </span>
                            <button
                              onClick={() => handleStartEditAlias(provider.accountId, provider.accountAlias)}
                              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                              title="Edit account name"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
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
                        onClick={() => handleStartEdit(provider)}
                        className="p-2 text-frozenWater-600 hover:bg-frozenWater-50 rounded-lg transition-colors"
                        title="Edit account credentials"
                      >
                        <Edit2 className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(provider.accountId, provider.isActive)}
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
                        onClick={() => handleDeleteProvider(provider.accountId, provider.accountAlias)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete account"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Provider Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Add Cloud Provider Account</h3>
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setSelectedProvider('')
                    setAccountAlias('')
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
                    {AVAILABLE_PROVIDERS.map((provider) => {
                      const count = getAccountCount(provider.id)
                      return (
                        <button
                          key={provider.id}
                          onClick={() => {
                            setSelectedProvider(provider.id)
                            setCredentials({})
                            setError('')
                            // Suggest a default alias
                            setAccountAlias(count > 0 ? `${provider.name} Account ${count + 1}` : '')
                          }}
                          className={`p-4 border-2 rounded-lg text-left transition-colors ${
                            selectedProvider === provider.id
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <ProviderIcon providerId={provider.id} size={32} />
                            {count > 0 && (
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                {count} account{count > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <div className="font-medium text-gray-900">{provider.name}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {selectedProvider && (
                  <div className="space-y-4 pt-4 border-t border-gray-200">
                    {/* Account Alias */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Account Name (optional)
                      </label>
                      <input
                        type="text"
                        value={accountAlias}
                        onChange={(e) => setAccountAlias(e.target.value)}
                        className="input-field"
                        placeholder={`e.g., Production, Development, ${AVAILABLE_PROVIDERS.find(p => p.id === selectedProvider)?.name} Main`}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Give this account a recognizable name to differentiate it from other accounts
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <h4 className="font-medium text-gray-900">Credentials</h4>
                      <button
                        type="button"
                        onClick={() => setShowIAMDialog(true)}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm text-[#22B8A0] hover:text-[#1F3A5F] hover:bg-[#F0FDFA] rounded-lg transition-colors"
                      >
                        <HelpCircle className="h-4 w-4" />
                        How to set up IAM permissions
                      </button>
                    </div>
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
                      setAccountAlias('')
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
                    {isSubmitting ? 'Adding...' : 'Add Account'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Account Modal */}
      {showEditModal && editingAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Edit Account Credentials</h3>
                <button
                  onClick={handleCancelEdit}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Account Info */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="flex items-center space-x-3">
                    <ProviderIcon providerId={editingAccount.providerId} size={32} />
                    <div>
                      <div className="font-medium text-gray-900">{editingAccount.accountAlias}</div>
                      <div className="text-sm text-gray-600">{editingAccount.providerName}</div>
                    </div>
                  </div>
                </div>

                {isLoadingCredentials ? (
                  <div className="text-center py-8">
                    <div className="text-gray-600">Loading credentials...</div>
                  </div>
                ) : (
                  <>
                    <h4 className="font-medium text-gray-900 pt-2">Credentials</h4>
                    {getRequiredFields(editingAccount.providerId).map((field) => (
                      <div key={field}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1')}
                        </label>
                        <input
                          type={field.toLowerCase().includes('secret') || field.toLowerCase().includes('key') ? 'password' : 'text'}
                          value={editCredentials[field] || ''}
                          onChange={(e) =>
                            setEditCredentials({ ...editCredentials, [field]: e.target.value })
                          }
                          className="input-field"
                          placeholder={`Enter ${field}`}
                        />
                      </div>
                    ))}
                  </>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={handleCancelEdit}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSubmitting || isLoadingCredentials}
                    className="btn-primary"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IAM Policy Dialog */}
      {selectedProvider && (
        <IAMPolicyDialog
          isOpen={showIAMDialog}
          onClose={() => setShowIAMDialog(false)}
          providerId={selectedProvider}
          providerName={AVAILABLE_PROVIDERS.find(p => p.id === selectedProvider)?.name || selectedProvider}
        />
      )}
    </div>
  )
}
