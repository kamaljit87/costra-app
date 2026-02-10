import { useState, useEffect } from 'react'
import { cloudProvidersAPI, syncAPI } from '../services/api'
import { Plus, Trash2, CheckCircle, XCircle, Cloud, Edit2, X, Check, HelpCircle } from 'lucide-react'
import { ProviderIcon } from './CloudProviderIcons'
import IAMPolicyDialog from './IAMPolicyDialog'

interface CloudProvider {
  id: number
  accountId: number
  providerId: string
  providerName: string
  accountAlias: string
  isActive: boolean
  lastSyncAt: string | null
  connectionType?: string
  connectionStatus?: 'pending' | 'healthy' | 'error'
  awsAccountId?: string
  lastHealthCheck?: string | null
  createdAt: string
  curEnabled?: boolean
}

interface CurStatusInfo {
  curEnabled: boolean
  curStatus: string
  lastIngestion: string | null
}

interface CloudProviderManagerProps {
  onProviderChange?: () => void
  modalMode?: boolean // If true, only show the add provider form in a modal
  onClose?: () => void // Callback when modal should close
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

export default function CloudProviderManager({ onProviderChange, modalMode = false, onClose }: CloudProviderManagerProps) {
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
  const [awsConnectionType, setAwsConnectionType] = useState<'simple' | 'automated'>('simple')
  const [automatedConnectionData, setAutomatedConnectionData] = useState<{
    quickCreateUrl?: string
    externalId?: string
    roleArn?: string
    connectionName?: string
    awsAccountId?: string
    connectionType?: string
  } | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [curStatuses, setCurStatuses] = useState<Record<number, CurStatusInfo>>({})

  useEffect(() => {
    loadProviders()
  }, [])

  // Auto-open add modal in modal mode
  useEffect(() => {
    if (modalMode && !showAddModal) {
      setShowAddModal(true)
    }
  }, [modalMode, showAddModal])

  const loadProviders = async () => {
    try {
      setIsLoading(true)
      const response = await cloudProvidersAPI.getCloudProviders()
      const loadedProviders = response.providers || []
      setProviders(loadedProviders)
      // Fetch CUR status for automated AWS connections
      loadCurStatuses(loadedProviders)
    } catch (error: any) {
      console.error('Failed to load providers:', error)
      setError(error.message || 'Failed to load cloud providers')
    } finally {
      setIsLoading(false)
    }
  }

  const loadCurStatuses = async (providersList: CloudProvider[]) => {
    const automatedAws = providersList.filter(
      p => p.providerId === 'aws' && p.connectionType?.startsWith('automated')
    )
    for (const provider of automatedAws) {
      try {
        const result = await cloudProvidersAPI.getCurStatus(provider.accountId)
        setCurStatuses(prev => ({
          ...prev,
          [provider.accountId]: {
            curEnabled: result.curEnabled,
            curStatus: result.curStatus,
            lastIngestion: result.lastIngestion,
          },
        }))
      } catch {
        // CUR status fetch is non-critical
      }
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

    // Handle automated AWS connection differently
    if (selectedProvider === 'aws' && awsConnectionType === 'automated') {
      if (!accountAlias) {
        setError('Connection name is required')
        return
      }
      
      // AWS Account ID is required for automated connection
      const awsAccountId = credentials['awsAccountId']
      if (!awsAccountId || !/^\d{12}$/.test(awsAccountId)) {
        setError('Valid AWS Account ID (12 digits) is required')
        return
      }

      // Sanitize connection name for CloudFormation
      // CloudFormation stack names must:
      //   - Start with a letter (a-z, A-Z)
      //   - Contain only alphanumeric characters and hyphens
      //   - Not start or end with a hyphen
      //   - Be 1-128 characters long
      const sanitizeForCloudFormation = (name: string) => {
        let sanitized = name
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '-') // Replace invalid chars with hyphens
          .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
          .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
        
        // Ensure it starts with a letter (CloudFormation requirement)
        if (sanitized && /^[0-9]/.test(sanitized)) {
          sanitized = `costra-${sanitized}`
        }
        
        sanitized = sanitized.substring(0, 50) || 'costra-connection' // Limit length
        
        // Final check: ensure it starts with a letter
        if (!/^[a-z]/.test(sanitized)) {
          sanitized = `costra-${sanitized}`
        }
        
        return sanitized
      }
      
      const sanitizedAlias = sanitizeForCloudFormation(accountAlias)
      
      // Warn user if name was changed
      if (sanitizedAlias !== accountAlias.toLowerCase().replace(/\s+/g, '-')) {
        console.log(`[CloudProviderManager] Connection name sanitized: "${accountAlias}" -> "${sanitizedAlias}"`)
      }

      try {
        setIsSubmitting(true)
        setError('')
        const result = await cloudProvidersAPI.initiateAutomatedAWSConnection(
          sanitizedAlias,
          awsAccountId,
          'billing'
        )
        // No database record is created yet — store params for verification
        setAutomatedConnectionData({
          quickCreateUrl: result.quickCreateUrl,
          externalId: result.externalId,
          roleArn: result.roleArn,
          connectionName: result.connectionName,
          awsAccountId: result.awsAccountId || awsAccountId,
          connectionType: result.connectionType || 'automated-billing',
        })
        // Don't close modal yet - user needs to complete CloudFormation
      } catch (error: any) {
        // Handle template URL configuration error
        if (error.message?.includes('CloudFormation template URL not configured') || error.error === 'CloudFormation template URL not configured') {
          setError(
            'CloudFormation template URL not configured. ' +
            'Please contact your administrator to set up the template URL. ' +
            'The template must be hosted at a publicly accessible HTTPS URL (S3 bucket or GitHub).'
          )
        } else {
          setError(error.message || error.error || 'Failed to initiate automated connection')
        }
      } finally {
        setIsSubmitting(false)
      }
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
      if (modalMode && onClose) {
        onClose()
      }
      // Auto-sync data for the newly added provider
      syncAPI.syncAll().catch(() => {})
    } catch (error: any) {
      setError(error.message || 'Failed to add cloud provider')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVerifyConnection = async () => {
    if (!automatedConnectionData?.roleArn || !automatedConnectionData?.externalId) {
      setError('Connection data not found. Please start over.')
      return
    }

    try {
      setIsVerifying(true)
      setError('')
      await cloudProvidersAPI.verifyAndCreateAWSConnection({
        connectionName: automatedConnectionData.connectionName!,
        awsAccountId: automatedConnectionData.awsAccountId!,
        roleArn: automatedConnectionData.roleArn,
        externalId: automatedConnectionData.externalId,
        connectionType: automatedConnectionData.connectionType || 'automated-billing',
      })
      setShowAddModal(false)
      setSelectedProvider('')
      setAccountAlias('')
      setCredentials({})
      setAutomatedConnectionData(null)
      await loadProviders()
      onProviderChange?.()
      // Auto-sync data for the newly verified provider
      syncAPI.syncAll().catch(() => {})
    } catch {
      setError('Connection is still pending. Please ensure the CloudFormation stack has completed successfully in AWS Console, then try again.')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleDeleteProvider = async (accountId: number, accountAlias: string) => {
    if (!confirm(`Are you sure you want to remove "${accountAlias}"? This will permanently delete all associated credentials, cost data, and historical records.`)) {
      return
    }

    try {
      await cloudProvidersAPI.deleteCloudProviderAccount(accountId)
      // Clear local state immediately
      setProviders(prev => prev.filter(p => p.accountId !== accountId))
      await loadProviders()
      // Trigger full data refresh in parent components (dashboard, etc.)
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
        // Return different fields based on connection type
        if (awsConnectionType === 'simple') {
          return ['accessKeyId', 'secretAccessKey', 'region']
        } else {
          // automated — credentials handled via CloudFormation
          return []
        }
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
                      <div className="w-10 h-10 flex items-center justify-center rounded-lg shrink-0">
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
                            {provider.connectionType?.startsWith('automated') && (
                              <>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  provider.connectionStatus === 'healthy'
                                    ? 'bg-green-100 text-green-700'
                                    : provider.connectionStatus === 'error'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {provider.connectionStatus === 'healthy' ? '✓ Connected' :
                                   provider.connectionStatus === 'error' ? '✗ Error' :
                                   '⏳ Pending'}
                                </span>
                                {curStatuses[provider.accountId] && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                    curStatuses[provider.accountId].curStatus === 'active'
                                      ? 'bg-blue-100 text-blue-700'
                                      : curStatuses[provider.accountId].curStatus === 'error'
                                      ? 'bg-red-100 text-red-700'
                                      : curStatuses[provider.accountId].curStatus === 'disabled'
                                      ? 'bg-gray-100 text-gray-500'
                                      : 'bg-yellow-100 text-yellow-700'
                                  }`} title={
                                    curStatuses[provider.accountId].curStatus === 'active'
                                      ? `CUR active${curStatuses[provider.accountId].lastIngestion ? ` - Last ingestion: ${new Date(curStatuses[provider.accountId].lastIngestion!).toLocaleDateString()}` : ''}`
                                      : curStatuses[provider.accountId].curStatus === 'provisioning'
                                      ? 'CUR export is being set up (data available within 24h)'
                                      : curStatuses[provider.accountId].curStatus === 'error'
                                      ? 'CUR setup encountered an error'
                                      : 'CUR is pending setup'
                                  }>
                                    {curStatuses[provider.accountId].curStatus === 'active' ? 'CUR Active' :
                                     curStatuses[provider.accountId].curStatus === 'provisioning' ? 'CUR Pending' :
                                     curStatuses[provider.accountId].curStatus === 'error' ? 'CUR Error' :
                                     null}
                                  </span>
                                )}
                              </>
                            )}
                            <button
                              onClick={() => handleStartEditAlias(provider.accountId, provider.accountAlias)}
                              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                              title="Edit account name"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        {provider.awsAccountId && (
                          <p className="text-xs text-gray-500">
                            AWS Account: {provider.awsAccountId}
                          </p>
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
                        className="p-2 text-accent-600 hover:bg-accent-50 rounded-lg transition-colors"
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddModal(false)
              setSelectedProvider('')
              setAccountAlias('')
              setCredentials({})
              setAwsConnectionType('simple')
              setAutomatedConnectionData(null)
              setError('')
              if (modalMode) onClose?.()
            }
          }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-fade-in ring-1 ring-black/5">
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Add Cloud Provider Account</h3>
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setSelectedProvider('')
                    setAccountAlias('')
                    setCredentials({})
                    setAwsConnectionType('simple')
                    setAutomatedConnectionData(null)
                    setError('')
                    if (modalMode) onClose?.()
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-4">
                    Select Provider
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {AVAILABLE_PROVIDERS.map((provider) => {
                      const count = getAccountCount(provider.id)
                      const isSelected = selectedProvider === provider.id
                      return (
                        <button
                          key={provider.id}
                          onClick={() => {
                            setSelectedProvider(provider.id)
                            setCredentials({})
                            setError('')
                            setAccountAlias(count > 0 ? `${provider.name} Account ${count + 1}` : '')
                          }}
                          className={`
                            relative flex flex-col items-center justify-center p-5 rounded-xl text-center
                            border-2 transition-all duration-200 ease-in-out
                            ${isSelected
                              ? 'border-accent-500 bg-accent-50 shadow-lg shadow-accent-500/20 scale-[1.02]'
                              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md hover:scale-[1.01]'
                            }
                            focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2
                          `}
                          aria-label={`Select ${provider.name}`}
                        >
                          {/* Provider Icon */}
                          <div className={`flex items-center justify-center mb-3 transition-transform duration-200 ${isSelected ? 'scale-110' : ''}`}>
                            <ProviderIcon providerId={provider.id} size={48} />
                          </div>

                          {/* Provider Name */}
                          <div className={`font-semibold text-sm leading-tight transition-colors ${
                            isSelected ? 'text-accent-600' : 'text-gray-900'
                          }`}>
                            {provider.name}
                          </div>

                          {/* Account Count Badge */}
                          {count > 0 && (
                            <span className={`mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              isSelected
                                ? 'bg-accent-500 text-white'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {count} account{count > 1 ? 's' : ''}
                            </span>
                          )}

                          {/* Selection Indicator */}
                          {isSelected && (
                            <div className="absolute top-2.5 right-2.5 w-5 h-5 bg-accent-500 rounded-full flex items-center justify-center">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          )}
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
                        Account Name {selectedProvider === 'aws' && awsConnectionType === 'automated' && <span className="text-red-500">*</span>}
                        {selectedProvider !== 'aws' || awsConnectionType !== 'automated' ? ' (optional)' : ''}
                      </label>
                      <input
                        type="text"
                        value={accountAlias}
                        onChange={(e) => setAccountAlias(e.target.value)}
                        className="input-field"
                        placeholder={`e.g., Production, Development, ${AVAILABLE_PROVIDERS.find(p => p.id === selectedProvider)?.name} Main`}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {selectedProvider === 'aws' && awsConnectionType === 'automated' ? (
                          <>
                            <strong>Required for automated connections.</strong> The name will be automatically converted to lowercase with hyphens for CloudFormation compatibility (e.g., "My Account" → "my-account").
                          </>
                        ) : (
                          'Give this account a recognizable name to differentiate it from other accounts'
                        )}
                      </p>
                    </div>

                    {/* AWS Connection Type Selector */}
                    {selectedProvider === 'aws' && (
                      <div className="pt-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Connection Type
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setAwsConnectionType('simple')
                              setCredentials({})
                              setAutomatedConnectionData(null)
                            }}
                            className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                              awsConnectionType === 'simple'
                                ? 'bg-accent-50 border-accent-500 text-accent-500'
                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            Simple (API Keys)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAwsConnectionType('automated')
                              setCredentials({})
                              setAutomatedConnectionData(null)
                            }}
                            className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors relative ${
                              awsConnectionType === 'automated'
                                ? 'bg-[#FEF3C7] border-[#F59E0B] text-[#F59E0B]'
                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                              Recommended
                            </span>
                            Automated + CUR ⚡
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {awsConnectionType === 'simple'
                            ? 'Use Cost Explorer API - quick setup, no S3 bucket needed'
                            : 'One-click CloudFormation setup with CUR - penny-perfect billing accuracy'}
                        </p>
                      </div>
                    )}

                    {/* Automated Connection Flow */}
                    {selectedProvider === 'aws' && awsConnectionType === 'automated' && automatedConnectionData ? (
                      <div className="space-y-4 pt-4 border-t border-gray-200">
                        <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-xl p-4">
                          <h4 className="font-semibold text-[#92400E] mb-2">✅ Connection Initiated</h4>
                          <p className="text-sm text-[#92400E] mb-4">
                            Your CloudFormation stack is ready to be created. Follow these steps:
                          </p>
                          <ol className="text-sm text-[#92400E] space-y-2 list-decimal list-inside mb-4">
                            <li>Click the button below to open AWS CloudFormation Console</li>
                            <li>Review the stack parameters (they are pre-filled)</li>
                            <li>Scroll to the bottom, check the two capability checkboxes</li>
                            <li>Click "Create stack"</li>
                            <li>Wait for stack creation to complete (~2-5 minutes)</li>
                            <li>Return here and click "Verify Connection"</li>
                          </ol>
                          <div className="space-y-2">
                            <a
                              href={automatedConnectionData.quickCreateUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block w-full px-4 py-2 bg-[#F59E0B] text-white rounded-lg hover:bg-[#D97706] transition-colors text-center font-medium"
                            >
                              Open AWS CloudFormation Console →
                            </a>
                            <button
                              onClick={handleVerifyConnection}
                              disabled={isVerifying}
                              className="w-full px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-[#1F9A8A] transition-colors font-medium disabled:opacity-50"
                            >
                              {isVerifying ? 'Checking connection...' : 'Verify Connection'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between pt-2">
                          <h4 className="font-medium text-gray-900">Credentials</h4>
                          <button
                            type="button"
                            onClick={() => setShowIAMDialog(true)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm text-accent-500 hover:text-accent-700 hover:bg-accent-50 rounded-lg transition-colors"
                          >
                            <HelpCircle className="h-4 w-4" />
                            How to set up IAM permissions
                          </button>
                        </div>
                        {selectedProvider === 'aws' && awsConnectionType === 'automated' ? (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              AWS Account ID <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={credentials['awsAccountId'] || ''}
                              onChange={(e) => setCredentials({ ...credentials, awsAccountId: e.target.value })}
                              className="input-field"
                              placeholder="123456789012"
                              pattern="[0-9]{12}"
                              maxLength={12}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Your 12-digit AWS Account ID (found in AWS Console top-right corner)
                            </p>
                          </div>
                        ) : (
                          <>
                            {getRequiredFields(selectedProvider).map((field) => {
                            const getFieldLabel = (f: string) => {
                        const labels: Record<string, string> = {
                          accessKeyId: 'Access Key ID',
                          secretAccessKey: 'Secret Access Key',
                          roleArn: 'Cross-Account Role ARN',
                          s3BucketName: 'S3 Billing Bucket Name',
                          curReportName: 'Cost & Usage Report Name',
                          region: 'AWS Region',
                        }
                        return labels[f] || f.charAt(0).toUpperCase() + f.slice(1).replace(/([A-Z])/g, ' $1')
                      }
                      const getFieldPlaceholder = (f: string) => {
                        const placeholders: Record<string, string> = {
                          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
                          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
                          roleArn: 'arn:aws:iam::123456789012:role/CostraReadOnlyRole',
                          s3BucketName: 'your-company-billing',
                          curReportName: 'cloud-billing',
                          region: 'us-east-1',
                        }
                        return placeholders[f] || `Enter ${getFieldLabel(f)}`
                      }
                      return (
                        <div key={field}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {getFieldLabel(field)}
                            {field === 'roleArn' && (
                              <span className="text-xs text-gray-500 ml-1">(from Step 2)</span>
                            )}
                            {field === 's3BucketName' && (
                              <span className="text-xs text-gray-500 ml-1">(from Step 1)</span>
                            )}
                            {field === 'curReportName' && (
                              <span className="text-xs text-gray-500 ml-1">(from Step 1)</span>
                            )}
                          </label>
                          <input
                            type={field.toLowerCase().includes('secret') || field.toLowerCase().includes('key') && !field.toLowerCase().includes('arn') ? 'password' : 'text'}
                            value={credentials[field] || ''}
                            onChange={(e) =>
                              setCredentials({ ...credentials, [field]: e.target.value })
                            }
                            className="input-field"
                            placeholder={getFieldPlaceholder(field)}
                          />
                        </div>
                      )
                    })}
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}

                {error && (
                  <div className={`px-4 py-3 rounded-lg text-sm ${
                    error.includes('pending')
                      ? 'bg-amber-50 border border-amber-200 text-amber-700'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}>
                    {error}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200 mt-6">
                  <button
                    onClick={() => {
                      setShowAddModal(false)
                      setSelectedProvider('')
                      setAccountAlias('')
                      setCredentials({})
                      setAwsConnectionType('simple')
                      setAutomatedConnectionData(null)
                      setError('')
                      if (modalMode) {
                        onClose?.()
                      }
                    }}
                    className="btn-secondary w-full sm:w-auto order-2 sm:order-1"
                  >
                    Cancel
                  </button>
                  {!automatedConnectionData && (
                    <button
                      onClick={handleAddProvider}
                      disabled={isSubmitting || !selectedProvider}
                      className="btn-primary w-full sm:w-auto order-1 sm:order-2"
                    >
                      {isSubmitting ? 'Adding...' : 'Add Account'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Account Modal */}
      {showEditModal && editingAccount && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) handleCancelEdit() }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-fade-in ring-1 ring-black/5">
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Edit Account Credentials</h3>
                <button
                  onClick={handleCancelEdit}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
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
