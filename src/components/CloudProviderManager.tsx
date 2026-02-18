import { useState, useEffect, useRef, useCallback } from 'react'
import { cloudProvidersAPI, syncAPI } from '../services/api'
import { Plus, Trash2, CheckCircle, XCircle, Cloud, Edit2, X, Check, HelpCircle, AlertTriangle } from 'lucide-react'
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
  statusMessage?: string | null
  billingPeriods?: { period: string; totalCost: number; ingestedAt: string }[]
  bucketEmpty?: boolean
  bucketEmptyMessage?: string | null
  exportStatusCode?: string | null
  exportStatusReason?: string | null
  exportStatusMessage?: string | null
}

interface CloudProviderManagerProps {
  onProviderChange?: () => void
  modalMode?: boolean // If true, only show the add provider form in a modal
  onClose?: () => void // Callback when modal should close
}

import { SUPPORTED_PROVIDERS } from '../constants/providers'

const AVAILABLE_PROVIDERS = SUPPORTED_PROVIDERS

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
    hasCallback?: boolean
  } | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [pollAttempts, setPollAttempts] = useState(0)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [curStatuses, setCurStatuses] = useState<Record<number, CurStatusInfo>>({})
  const [curFixPolicyAccountId, setCurFixPolicyAccountId] = useState<number | null>(null)
  const [curSetupAccountId, setCurSetupAccountId] = useState<number | null>(null)
  const [deleteModal, setDeleteModal] = useState<{
    accountId: number
    accountAlias: string
    isAutomated: boolean
    cleanupAWS: boolean
  } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    loadProviders()
  }, [])

  // Auto-open add modal in modal mode
  useEffect(() => {
    if (modalMode && !showAddModal) {
      setShowAddModal(true)
    }
  }, [modalMode, showAddModal])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [])

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
    setIsPolling(false)
    setPollAttempts(0)
  }, [])

  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) return // Already polling
    setIsPolling(true)
    setPollAttempts(0)
    setError('')

    const MAX_ATTEMPTS = 36 // 6 minutes at 10s intervals
    let attempts = 0

    pollIntervalRef.current = setInterval(async () => {
      attempts++
      setPollAttempts(attempts)

      if (attempts > MAX_ATTEMPTS) {
        stopPolling()
        setError('Auto-detection timed out. If your stack is still creating, click "Verify Connection" below.')
        return
      }

      if (!automatedConnectionData?.externalId) return

      try {
        // Use lightweight status check first (no STS call — just checks Redis)
        const status = await cloudProvidersAPI.checkAutomatedConnectionStatus(automatedConnectionData.externalId)

        if (status.status === 'connected') {
          // Callback has created the connection — done!
          stopPolling()
          setShowAddModal(false)
          setSelectedProvider('')
          setAccountAlias('')
          setCredentials({})
          setAutomatedConnectionData(null)
          await loadProviders()
          onProviderChange?.()
          window.dispatchEvent(new CustomEvent('cloud-providers-changed'))
          syncAPI.syncAll().catch(() => {})
          return
        }

        if (status.status === 'error') {
          stopPolling()
          setError(status.error || 'Connection verification failed.')
          return
        }

        // Still pending — if no callback support, fall back to full STS verify every 30s
        if (!automatedConnectionData.hasCallback && attempts % 3 === 0 && automatedConnectionData.roleArn) {
          try {
            await cloudProvidersAPI.verifyAndCreateAWSConnection({
              connectionName: automatedConnectionData.connectionName!,
              awsAccountId: automatedConnectionData.awsAccountId!,
              roleArn: automatedConnectionData.roleArn,
              externalId: automatedConnectionData.externalId,
              connectionType: automatedConnectionData.connectionType || 'automated-billing',
            })
            // Success via fallback
            stopPolling()
            setShowAddModal(false)
            setSelectedProvider('')
            setAccountAlias('')
            setCredentials({})
            setAutomatedConnectionData(null)
            await loadProviders()
            onProviderChange?.()
            window.dispatchEvent(new CustomEvent('cloud-providers-changed'))
            syncAPI.syncAll().catch(() => {})
          } catch {
            // Expected to fail until stack is ready
          }
        }
      } catch {
        // Status check failed — keep polling silently
      }
    }, 10000) // Poll every 10 seconds
  }, [automatedConnectionData, stopPolling, onProviderChange])

  const loadProviders = async () => {
    try {
      setIsLoading(true)
      const response = await cloudProvidersAPI.getCloudProviders()
      const loadedProviders = response.providers || []
      setProviders(loadedProviders)
      setIsLoading(false)
      // Fetch CUR status in background (parallel, non-blocking)
      const automatedAws = loadedProviders.filter(
        (p: CloudProvider) => p.providerId === 'aws' && p.connectionType?.startsWith('automated')
      )
      if (automatedAws.length > 0) {
        const results = await Promise.allSettled(
          automatedAws.map((p: CloudProvider) =>
            cloudProvidersAPI.getCurStatus(p.accountId).then((result) => ({ accountId: p.accountId, result }))
          )
        )
        setCurStatuses(prev => {
          const next = { ...prev }
          results.forEach((r) => {
            if (r.status === 'fulfilled' && r.value) {
              const { accountId, result } = r.value
              next[accountId] = {
                curEnabled: result.curEnabled,
                curStatus: result.curStatus,
                lastIngestion: result.lastIngestion,
                statusMessage: result.statusMessage ?? null,
                billingPeriods: result.billingPeriods,
                bucketEmpty: result.bucketEmpty,
                bucketEmptyMessage: result.bucketEmptyMessage ?? null,
                exportStatusCode: result.exportStatusCode ?? null,
                exportStatusReason: result.exportStatusReason ?? null,
                exportStatusMessage: result.exportStatusMessage ?? null,
              }
            }
          })
          return next
        })
      }
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

        // Pre-flight: attempt to clean up orphaned AWS resources from a previous connection
        // This prevents "AlreadyExists" errors in CloudFormation
        try {
          await cloudProvidersAPI.cleanupOrphanedResources(awsAccountId, sanitizedAlias)
        } catch {
          // Non-blocking — cleanup may fail if no old connection exists
        }

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
          hasCallback: result.hasCallback || false,
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
      window.dispatchEvent(new CustomEvent('cloud-providers-changed'))
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
      stopPolling()
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
      window.dispatchEvent(new CustomEvent('cloud-providers-changed'))
      syncAPI.syncAll().catch(() => {})
    } catch {
      setError('Connection is still pending. Please ensure the CloudFormation stack has completed successfully in AWS Console, then try again.')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleDeleteProvider = (accountId: number, accountAlias: string) => {
    const provider = providers.find(p => p.accountId === accountId)
    const isAutomated = !!provider?.connectionType?.startsWith('automated')
    setDeleteModal({ accountId, accountAlias, isAutomated, cleanupAWS: isAutomated })
  }

  const confirmDelete = async () => {
    if (!deleteModal) return
    setIsDeleting(true)
    try {
      await cloudProvidersAPI.deleteCloudProviderAccount(deleteModal.accountId, deleteModal.cleanupAWS)
      setProviders(prev => prev.filter(p => p.accountId !== deleteModal.accountId))
      setDeleteModal(null)
      await loadProviders()
      onProviderChange?.()
      window.dispatchEvent(new CustomEvent('cloud-providers-changed'))
    } catch (error: any) {
      setError(error.message || 'Failed to delete cloud provider account')
      setDeleteModal(null)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleToggleStatus = async (accountId: number, currentStatus: boolean) => {
    try {
      await cloudProvidersAPI.updateAccountStatus(accountId, !currentStatus)
      await loadProviders()
      onProviderChange?.()
      window.dispatchEvent(new CustomEvent('cloud-providers-changed'))
    } catch (error: any) {
      setError(error.message || 'Failed to update account status')
    }
  }

  const handleFixCurPolicy = async (accountId: number) => {
    setCurFixPolicyAccountId(accountId)
    try {
      await cloudProvidersAPI.fixCurPolicy(accountId)
      const result = await cloudProvidersAPI.getCurStatus(accountId)
      setCurStatuses(prev => ({
        ...prev,
        [accountId]: {
          curEnabled: result.curEnabled,
          curStatus: result.curStatus,
          lastIngestion: result.lastIngestion,
          statusMessage: result.statusMessage ?? null,
          billingPeriods: result.billingPeriods,
          bucketEmpty: result.bucketEmpty,
          bucketEmptyMessage: result.bucketEmptyMessage ?? null,
          exportStatusCode: result.exportStatusCode ?? null,
          exportStatusReason: result.exportStatusReason ?? null,
          exportStatusMessage: result.exportStatusMessage ?? null,
        },
      }))
    } catch (err: any) {
      setError(err?.message || 'Failed to fix CUR policy')
    } finally {
      setCurFixPolicyAccountId(null)
    }
  }

  const handleSetupCur = async (accountId: number) => {
    setCurSetupAccountId(accountId)
    try {
      await cloudProvidersAPI.setupCur(accountId)
      const result = await cloudProvidersAPI.getCurStatus(accountId)
      setCurStatuses(prev => ({
        ...prev,
        [accountId]: {
          curEnabled: result.curEnabled,
          curStatus: result.curStatus,
          lastIngestion: result.lastIngestion,
          statusMessage: result.statusMessage ?? null,
          billingPeriods: result.billingPeriods,
          bucketEmpty: result.bucketEmpty,
          bucketEmptyMessage: result.bucketEmptyMessage ?? null,
          exportStatusCode: result.exportStatusCode ?? null,
          exportStatusReason: result.exportStatusReason ?? null,
          exportStatusMessage: result.exportStatusMessage ?? null,
        },
      }))
    } catch (err: any) {
      setError(err?.message || 'Failed to set up CUR')
    } finally {
      setCurSetupAccountId(null)
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

    const requiredFields = getRequiredFields(editingAccount.providerId, editingAccount)
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
      window.dispatchEvent(new CustomEvent('cloud-providers-changed'))
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

  const getRequiredFields = (providerId: string, account?: CloudProvider): string[] => {
    switch (providerId) {
      case 'aws':
        // Return different fields based on connection type (use account's type when editing)
        const isAutomated = account?.connectionType?.startsWith('automated') ?? (awsConnectionType === 'automated')
        if (isAutomated) {
          // automated — credentials handled via CloudFormation, not editable
          return []
        }
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
                                  <>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                      curStatuses[provider.accountId].curStatus === 'active'
                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                        : curStatuses[provider.accountId].exportStatusCode === 'UNHEALTHY'
                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                        : curStatuses[provider.accountId].curStatus === 'error'
                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                        : curStatuses[provider.accountId].curStatus === 'disabled'
                                        ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
                                    }`} title={
                                      curStatuses[provider.accountId].curStatus === 'active'
                                        ? `CUR active${curStatuses[provider.accountId].lastIngestion ? ` - Last ingestion: ${new Date(curStatuses[provider.accountId].lastIngestion!).toLocaleDateString()}` : ''}${curStatuses[provider.accountId].billingPeriods?.length ? ` • ${curStatuses[provider.accountId].billingPeriods!.length} period(s) ingested` : ''}`
                                        : curStatuses[provider.accountId].exportStatusCode === 'UNHEALTHY'
                                        ? (curStatuses[provider.accountId].exportStatusMessage || 'CUR export is unhealthy')
                                        : curStatuses[provider.accountId].curStatus === 'provisioning'
                                        ? (curStatuses[provider.accountId].bucketEmptyMessage || 'CUR export is being set up (data available within 24h)')
                                        : curStatuses[provider.accountId].curStatus === 'error'
                                        ? (curStatuses[provider.accountId].statusMessage ? `CUR error: ${curStatuses[provider.accountId].statusMessage}` : 'CUR setup encountered an error')
                                        : 'CUR is pending setup'
                                    }>
                                      {curStatuses[provider.accountId].curStatus === 'active' ? 'CUR Active' :
                                       curStatuses[provider.accountId].exportStatusCode === 'UNHEALTHY' ? 'CUR Unhealthy' :
                                       curStatuses[provider.accountId].curStatus === 'provisioning' ? 'CUR Pending' :
                                       curStatuses[provider.accountId].curStatus === 'error' ? 'CUR Error' :
                                       null}
                                    </span>
                                    {curStatuses[provider.accountId].curStatus === 'active' && (
                                      <p className="text-xs text-green-600 dark:text-green-400 mt-1" role="status">
                                        CUR integration successful. Cost data will appear on the Dashboard.
                                      </p>
                                    )}
                                    {(curStatuses[provider.accountId].curStatus === 'provisioning' && curStatuses[provider.accountId].bucketEmptyMessage) && (
                                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1" role="status">
                                        {curStatuses[provider.accountId].bucketEmptyMessage}
                                      </p>
                                    )}
                                    {curStatuses[provider.accountId].exportStatusCode === 'UNHEALTHY' && curStatuses[provider.accountId].exportStatusMessage && (
                                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1" role="status">
                                        {curStatuses[provider.accountId].exportStatusMessage}
                                      </p>
                                    )}
                                    {curStatuses[provider.accountId].exportStatusReason === 'INSUFFICIENT_PERMISSION' && (
                                      <div className="mt-1 flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleFixCurPolicy(provider.accountId)}
                                          disabled={curFixPolicyAccountId === provider.accountId}
                                          className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-800/40 disabled:opacity-50"
                                        >
                                          {curFixPolicyAccountId === provider.accountId ? 'Applying…' : 'Fix CUR (re-apply bucket policy)'}
                                        </button>
                                      </div>
                                    )}
                                    {(curStatuses[provider.accountId].curStatus === 'error' || !curStatuses[provider.accountId].curEnabled) && curStatuses[provider.accountId].exportStatusReason !== 'INSUFFICIENT_PERMISSION' && (
                                      <div className="mt-1 flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleSetupCur(provider.accountId)}
                                          disabled={curSetupAccountId === provider.accountId}
                                          className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:hover:bg-blue-800/40 disabled:opacity-50"
                                        >
                                          {curSetupAccountId === provider.accountId ? 'Setting up…' : 'Set up CUR'}
                                        </button>
                                      </div>
                                    )}
                                  </>
                                )}
                                {!curStatuses[provider.accountId] && provider.providerId === 'aws' && (
                                  <button
                                    type="button"
                                    onClick={() => handleSetupCur(provider.accountId)}
                                    disabled={curSetupAccountId === provider.accountId}
                                    className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:hover:bg-blue-800/40 disabled:opacity-50"
                                  >
                                    {curSetupAccountId === provider.accountId ? 'Setting up…' : 'Set up CUR'}
                                  </button>
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
              stopPolling()
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
                    stopPolling()
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
                          {!isPolling ? (
                            <>
                              <h4 className="font-semibold text-[#92400E] mb-2">Step 1: Create Stack in AWS</h4>
                              <p className="text-sm text-[#92400E] mb-3">
                                Click below to open AWS CloudFormation. Review the pre-filled parameters, check the capability boxes at the bottom, then click "Create stack".
                              </p>
                              <a
                                href={automatedConnectionData.quickCreateUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => {
                                  // Start auto-polling after user opens the CloudFormation console
                                  setTimeout(() => startPolling(), 2000)
                                }}
                                className="block w-full px-4 py-2 bg-[#F59E0B] text-white rounded-lg hover:bg-[#D97706] transition-colors text-center font-medium"
                              >
                                Open AWS CloudFormation Console →
                              </a>
                            </>
                          ) : (
                            <>
                              <h4 className="font-semibold text-[#92400E] mb-2">Step 2: Waiting for Stack...</h4>
                              <div className="flex items-center gap-3 mb-3">
                                <div className="h-5 w-5 border-2 border-[#F59E0B] border-t-transparent rounded-full animate-spin" />
                                <p className="text-sm text-[#92400E]">
                                  Auto-detecting your CloudFormation stack... ({Math.floor(pollAttempts * 10 / 60)}:{String(pollAttempts * 10 % 60).padStart(2, '0')})
                                </p>
                              </div>
                              <p className="text-xs text-[#92400E]/70 mb-3">
                                Stack creation typically takes 2-5 minutes. This will automatically connect once the stack is ready.
                              </p>
                            </>
                          )}
                          {/* Manual verify fallback — always available */}
                          <button
                            onClick={handleVerifyConnection}
                            disabled={isVerifying}
                            className={`w-full px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                              isPolling
                                ? 'bg-white/80 text-[#92400E] border border-[#FDE68A] hover:bg-white'
                                : 'bg-accent-500 text-white hover:bg-[#1F9A8A] mt-2'
                            }`}
                          >
                            {isVerifying ? 'Checking connection...' : isPolling ? 'Verify Manually' : 'Verify Connection'}
                          </button>
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
                      stopPolling()
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
                    {getRequiredFields(editingAccount.providerId, editingAccount).map((field) => (
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

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) setDeleteModal(null)
          }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full animate-fade-in ring-1 ring-black/5">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Remove "{deleteModal.accountAlias}"?</h3>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                This will permanently delete all cost data, credentials, and historical records from Costra.
              </p>

              {deleteModal.isAutomated && (
                <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer mb-4">
                  <input
                    type="checkbox"
                    checked={deleteModal.cleanupAWS}
                    onChange={(e) => setDeleteModal({ ...deleteModal, cleanupAWS: e.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Also delete AWS resources</span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Removes the CloudFormation stack, IAM role, and CUR export from your AWS account. The S3 bucket with billing data is preserved.
                    </p>
                  </div>
                </label>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteModal(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
