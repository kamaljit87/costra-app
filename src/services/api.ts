// Use relative URL to leverage Vite proxy in development, or absolute URL in production
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:3002/api')

/** Public auth config (no token). Signup disabled when DISABLE_SIGNUP env is set. On 502/5xx or network error, returns safe default so app still loads. */
export const getAuthConfig = async (): Promise<{ signupDisabled: boolean }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/config`)
    if (!res.ok) return { signupDisabled: false }
    const data = await res.json().catch(() => ({}))
    return { signupDisabled: !!data.signupDisabled }
  } catch {
    return { signupDisabled: false }
  }
}

// Get auth token from localStorage
const getToken = (): string | null => {
  return localStorage.getItem('authToken')
}

// API request helper
const apiRequest = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    })

    if (!response.ok) {
      // For 404s, include status in error message so callers can handle it
      if (response.status === 404) {
        throw new Error(`404: ${response.statusText || 'Not Found'}`)
      }
      
      let error: string
      try {
        const errorData = await response.json()
        const validationMessages = errorData.errors?.map((e: { message?: string }) => e.message || '').filter(Boolean)
        error = validationMessages?.length
          ? validationMessages.join('. ')
          : (errorData.error || errorData.message || `HTTP error! status: ${response.status}`)
      } catch (e) {
        const text = await response.text().catch(() => 'Request failed')
        error = text || `HTTP error! status: ${response.status}`
      }
      throw new Error(error)
    }

    return response
  } catch (error: any) {
    // Handle network errors (server not running, CORS, etc.)
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Unable to connect to server. Please make sure the backend server is running on http://localhost:3001')
    }
    // Re-throw other errors
    throw error
  }
}

// Auth API
export const authAPI = {
  signup: async (name: string, email: string, password: string, consentAccepted: boolean = true) => {
    const response = await apiRequest('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, consentAccepted }),
    })
    const data = await response.json()
    if (data.token) {
      localStorage.setItem('authToken', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
    }
    return data
  },

  login: async (email: string, password: string) => {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    const data = await response.json()
    if (data.twoFactorRequired && data.temporaryToken) {
      return data
    }
    if (data.token) {
      localStorage.setItem('authToken', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
    }
    return data
  },

  verify2FA: async (temporaryToken: string, code: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/2fa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temporaryToken, code }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || 'Verification failed')
    if (data.token && data.user) {
      localStorage.setItem('authToken', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
    }
    return data
  },

  get2FAStatus: async () => {
    const response = await apiRequest('/auth/2fa/status')
    return response.json()
  },

  setup2FA: async () => {
    const response = await apiRequest('/auth/2fa/setup', { method: 'POST' })
    return response.json()
  },

  confirm2FA: async (code: string) => {
    const response = await apiRequest('/auth/2fa/confirm', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
    return response.json()
  },

  disable2FA: async (code: string) => {
    const response = await apiRequest('/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
    return response.json()
  },

  getCurrentUser: async () => {
    const response = await apiRequest('/auth/me')
    return response.json()
  },

  refreshToken: async () => {
    const response = await apiRequest('/auth/refresh', {
      method: 'POST',
    })
    const data = await response.json()
    if (data.token) {
      localStorage.setItem('authToken', data.token)
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user))
      }
    }
    return data
  },

  logout: () => {
    localStorage.removeItem('authToken')
    localStorage.removeItem('user')
  },

  googleLogin: async (credential: string): Promise<{ token?: string; user?: unknown; error?: string; twoFactorRequired?: boolean; temporaryToken?: string }> => {
    const response = await fetch(`${API_BASE_URL}/auth/google/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return { error: data.error || 'Google sign-in failed' }
    if (data.twoFactorRequired && data.temporaryToken && data.user) {
      return data
    }
    if (data.token) {
      localStorage.setItem('authToken', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      return data
    }
    return { error: data.error || 'Google sign-in failed' }
  },

  exchangeGoogleCode: async (code: string): Promise<{ token?: string; user?: unknown; error?: string; twoFactorRequired?: boolean; temporaryToken?: string }> => {
    const response = await fetch(`${API_BASE_URL}/auth/google/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return { error: data.error || 'Google sign-in failed' }
    if (data.twoFactorRequired && data.temporaryToken) {
      return data
    }
    if (data.token) {
      localStorage.setItem('authToken', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      return data
    }
    return { error: data.error || 'Google sign-in failed' }
  },
}

// Cost Data API
export const costDataAPI = {
  exportCostData: async (month: number, year: number, format: 'csv' | 'pdf') => {
    const token = getToken()
    const params = new URLSearchParams({ month: String(month), year: String(year), format })
    const res = await fetch(`${API_BASE_URL}/cost-data/export?${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || data.message || 'Export failed')
    }
    const blob = await res.blob()
    const disposition = res.headers.get('Content-Disposition')
    const match = disposition?.match(/filename="?([^";]+)"?/)
    const name = match ? match[1] : `cost-${year}-${String(month).padStart(2, '0')}.${format}`
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  },
  getCostData: async (month?: number, year?: number) => {
    const params = new URLSearchParams()
    if (month) params.set('month', String(month))
    if (year) params.set('year', String(year))
    const qs = params.toString()
    const response = await apiRequest(`/cost-data${qs ? `?${qs}` : ''}`)
    return response.json()
  },

  saveCostData: async (providerId: string, costData: any) => {
    const response = await apiRequest('/cost-data', {
      method: 'POST',
      body: JSON.stringify({ providerId, costData }),
    })
    return response.json()
  },

  getPreferences: async () => {
    const response = await apiRequest('/cost-data/preferences')
    return response.json()
  },

  updateCurrency: async (currency: string) => {
    const response = await apiRequest('/cost-data/preferences/currency', {
      method: 'PUT',
      body: JSON.stringify({ currency }),
    })
    return response.json()
  },

  getDailyCostData: async (providerId: string, startDate: string, endDate: string) => {
    const response = await apiRequest(`/cost-data/${providerId}/daily?startDate=${startDate}&endDate=${endDate}`)
    return response.json()
  },

  getBatchDailyCostData: async (startDate: string, endDate: string) => {
    const response = await apiRequest(`/cost-data/daily/batch?startDate=${startDate}&endDate=${endDate}`)
    return response.json()
  },

  getServicesForDateRange: async (providerId: string, startDate: string, endDate: string) => {
    // Add cache-busting timestamp to ensure fresh data
    const timestamp = Date.now()
    const response = await apiRequest(`/cost-data/services/${providerId}?startDate=${startDate}&endDate=${endDate}&_t=${timestamp}`)
    return response.json()
  },

  getServiceDetails: async (providerId: string, serviceName: string, startDate: string, endDate: string) => {
    const timestamp = Date.now()
    const encodedServiceName = encodeURIComponent(serviceName)
    const response = await apiRequest(`/cost-data/services/${providerId}/${encodedServiceName}/details?startDate=${startDate}&endDate=${endDate}&_t=${timestamp}`)
    return response.json()
  },

  getMonthlyTotal: async (providerId: string, year: number, month: number) => {
    const response = await apiRequest(`/cost-data/${providerId}/monthly-total/${year}/${month}`)
    return response.json()
  },

  getCreditsDetail: async (providerId: string, startDate: string, endDate: string, accountId?: number) => {
    const params = new URLSearchParams()
    params.append('startDate', startDate)
    params.append('endDate', endDate)
    if (accountId) params.append('accountId', accountId.toString())
    const response = await apiRequest(`/cost-data/${providerId}/credits?${params.toString()}`)
    return response.json()
  },
}

// Savings Plans API
export const savingsPlansAPI = {
  getSavingsPlans: async () => {
    const response = await apiRequest('/savings-plans')
    return response.json()
  },

  saveSavingsPlan: async (plan: any) => {
    const response = await apiRequest('/savings-plans', {
      method: 'POST',
      body: JSON.stringify(plan),
    })
    return response.json()
  },
}

// Saved views API (filter presets)
export const savedViewsAPI = {
  getList: async () => {
    const response = await apiRequest('/saved-views')
    const data = await response.json()
    return data.views ?? []
  },
  create: async (name: string, filters: { selectedService?: string | null; showCreditsOnly?: boolean; selectedAccountId?: number | null }) => {
    const response = await apiRequest('/saved-views', {
      method: 'POST',
      body: JSON.stringify({ name, filters }),
    })
    return response.json()
  },
  delete: async (id: number) => {
    await apiRequest(`/saved-views/${id}`, { method: 'DELETE' })
  },
}

// Goals API (spend targets)
export const goalsAPI = {
  getList: async () => {
    const response = await apiRequest('/goals')
    const data = await response.json()
    return data.goals ?? []
  },
  create: async (params: { name?: string; target_value: number; baseline?: string; period?: string }) => {
    const response = await apiRequest('/goals', {
      method: 'POST',
      body: JSON.stringify(params),
    })
    return response.json()
  },
  getProgress: async (goalId: number) => {
    const response = await apiRequest(`/goals/${goalId}/progress`)
    return response.json()
  },
  getAllProgress: async () => {
    const response = await apiRequest('/goals/progress')
    const data = await response.json()
    return data.progress ?? []
  },
  delete: async (id: number) => {
    await apiRequest(`/goals/${id}`, { method: 'DELETE' })
  },
}

// API keys (read-only access; manage with JWT only)
export const apiKeysAPI = {
  getList: async () => {
    const response = await apiRequest('/api-keys')
    const data = await response.json()
    return data.keys ?? []
  },
  create: async (name?: string) => {
    const response = await apiRequest('/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name: name || null }),
    })
    return response.json()
  },
  delete: async (id: number) => {
    await apiRequest(`/api-keys/${id}`, { method: 'DELETE' })
  },
}

// Cloud Providers API
export const cloudProvidersAPI = {
  getCloudProviders: async () => {
    const response = await apiRequest('/cloud-providers')
    return response.json()
  },

  // Add new cloud provider account (supports multiple accounts per provider)
  addCloudProvider: async (providerId: string, providerName: string, credentials: any, accountAlias?: string) => {
    const response = await apiRequest('/cloud-providers', {
      method: 'POST',
      body: JSON.stringify({ providerId, providerName, credentials, accountAlias }),
    })
    return response.json()
  },

  // Initiate automated AWS connection (CloudFormation)
  initiateAutomatedAWSConnection: async (connectionName: string, awsAccountId: string, connectionType: 'billing' | 'resource' = 'billing') => {
    const response = await apiRequest('/cloud-providers/aws/automated', {
      method: 'POST',
      body: JSON.stringify({ connectionName, awsAccountId, connectionType }),
    })
    return response.json()
  },

  // Clean up orphaned AWS resources (S3 bucket, stack, role) before re-creating a connection
  cleanupOrphanedResources: async (awsAccountId: string, connectionName: string) => {
    const response = await apiRequest('/cloud-providers/aws/cleanup-orphaned', {
      method: 'POST',
      body: JSON.stringify({ awsAccountId, connectionName }),
    })
    return response.json()
  },

  // Verify AWS connection after CloudFormation stack is created (legacy / re-verification)
  verifyAWSConnection: async (accountId: number) => {
    const response = await apiRequest(`/cloud-providers/aws/${accountId}/verify`, {
      method: 'POST',
    })
    return response.json()
  },

  // Verify and create automated AWS connection (no DB record until verification succeeds)
  verifyAndCreateAWSConnection: async (params: {
    connectionName: string
    awsAccountId: string
    roleArn: string
    externalId: string
    connectionType: string
  }) => {
    const response = await apiRequest('/cloud-providers/aws/automated/verify', {
      method: 'POST',
      body: JSON.stringify(params),
    })
    return response.json()
  },

  // Check if CloudFormation callback has activated a pending connection (lightweight, no STS)
  checkAutomatedConnectionStatus: async (externalId: string) => {
    const response = await apiRequest(`/cloud-providers/aws/automated/status/${externalId}`)
    return response.json()
  },

  // Health check for AWS connection
  checkAWSConnectionHealth: async (accountId: number) => {
    const response = await apiRequest(`/cloud-providers/aws/${accountId}/health`)
    return response.json()
  },

  // Delete specific account by account ID
  deleteCloudProviderAccount: async (accountId: number, cleanupAWS = false) => {
    const query = cleanupAWS ? '?cleanupAWS=true' : ''
    const response = await apiRequest(`/cloud-providers/account/${accountId}${query}`, {
      method: 'DELETE',
    })
    return response.json()
  },

  // Legacy: Delete all accounts of a provider type
  deleteCloudProvider: async (providerId: string) => {
    const response = await apiRequest(`/cloud-providers/${providerId}`, {
      method: 'DELETE',
    })
    return response.json()
  },

  // Update account status by account ID
  updateAccountStatus: async (accountId: number, isActive: boolean) => {
    const response = await apiRequest(`/cloud-providers/account/${accountId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    })
    return response.json()
  },

  // Update account alias
  updateAccountAlias: async (accountId: number, accountAlias: string) => {
    const response = await apiRequest(`/cloud-providers/account/${accountId}/alias`, {
      method: 'PATCH',
      body: JSON.stringify({ accountAlias }),
    })
    return response.json()
  },

  // Get account credentials (for editing)
  getAccountCredentials: async (accountId: number) => {
    const response = await apiRequest(`/cloud-providers/account/${accountId}/credentials`)
    return response.json()
  },

  // Update account credentials
  updateAccountCredentials: async (accountId: number, credentials: any) => {
    const response = await apiRequest(`/cloud-providers/account/${accountId}/credentials`, {
      method: 'PATCH',
      body: JSON.stringify({ credentials }),
    })
    return response.json()
  },

  // Legacy: Update provider status by provider ID
  updateProviderStatus: async (providerId: string, isActive: boolean) => {
    const response = await apiRequest(`/cloud-providers/${providerId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    })
    return response.json()
  },

  // Get CUR status for an AWS account
  getCurStatus: async (accountId: number) => {
    const response = await apiRequest(`/cloud-providers/aws/${accountId}/cur-status`)
    return response.json()
  },

  // Manually trigger CUR setup for an AWS account
  setupCur: async (accountId: number) => {
    const response = await apiRequest(`/cloud-providers/aws/${accountId}/cur-setup`, {
      method: 'POST',
    })
    return response.json()
  },

  // Re-apply S3 bucket policy for CUR (fix UNHEALTHY / INSUFFICIENT_PERMISSION)
  fixCurPolicy: async (accountId: number) => {
    const response = await apiRequest(`/cloud-providers/aws/${accountId}/cur-fix-policy`, {
      method: 'POST',
    })
    return response.json()
  },
}

// Sync API
export const syncAPI = {
  syncAll: async () => {
    const response = await apiRequest('/sync', {
      method: 'POST',
    })
    return response.json()
  },

  syncProvider: async (providerId: string) => {
    const response = await apiRequest(`/sync/${providerId}`, {
      method: 'POST',
    })
    return response.json()
  },

  /** Fetch and save cost data for a specific month (e.g. when compare has no data for that month). */
  fetchMonth: async (providerId: string, month: number, year: number) => {
    const response = await apiRequest('/sync/fetch-month', {
      method: 'POST',
      body: JSON.stringify({ providerId, month, year }),
    })
    return response.json()
  },
}

// Profile API
export const profileAPI = {
  getProfile: async () => {
    const response = await apiRequest('/profile')
    return response.json()
  },

  updateProfile: async (data: { name?: string; email?: string }) => {
    const response = await apiRequest('/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    return response.json()
  },

  uploadAvatar: async (file: File) => {
    const token = localStorage.getItem('authToken')
    const formData = new FormData()
    formData.append('avatar', file)

    const response = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:3001/api')}/profile/avatar`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to upload avatar')
    }

    return response.json()
  },

  removeAvatar: async () => {
    const response = await apiRequest('/profile/avatar', {
      method: 'DELETE',
    })
    return response.json()
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await apiRequest('/profile/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    return response.json()
  },
}

// AI API
export const aiAPI = {
  chat: async (message: string, conversationHistory: { role: string; content: string }[] = []) => {
    const response = await apiRequest('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, conversationHistory }),
    })
    return response.json()
  },

  getInsights: async () => {
    const response = await apiRequest('/ai/insights')
    return response.json()
  },

  getAnomalies: async () => {
    const response = await apiRequest('/ai/anomalies')
    return response.json()
  },
}

// Insights API
export const insightsAPI = {
  getCostVsUsage: async (providerId?: string, startDate?: string, endDate?: string, accountId?: number) => {
    const params = new URLSearchParams()
    if (providerId) params.append('providerId', providerId)
    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)
    if (accountId) params.append('accountId', accountId.toString())
    
    const response = await apiRequest(`/insights/cost-vs-usage?${params.toString()}`)
    return response.json()
  },

  getUntaggedResources: async (providerId?: string, limit: number = 50, accountId?: number) => {
    const params = new URLSearchParams()
    if (providerId) params.append('providerId', providerId)
    if (accountId) params.append('accountId', accountId.toString())
    params.append('limit', limit.toString())
    
    const response = await apiRequest(`/insights/untagged-resources?${params.toString()}`)
    return response.json()
  },

  getAnomalies: async (providerId?: string, thresholdPercent: number = 20, accountId?: number) => {
    const params = new URLSearchParams()
    if (providerId) params.append('providerId', providerId)
    params.append('thresholdPercent', thresholdPercent.toString())
    if (accountId) params.append('accountId', accountId.toString())
    
    const response = await apiRequest(`/insights/anomalies?${params.toString()}`)
    return response.json()
  },

  calculateAnomalyBaseline: async (providerId: string, serviceName: string, baselineDate: string, accountId?: number) => {
    const response = await apiRequest('/insights/anomalies/calculate', {
      method: 'POST',
      body: JSON.stringify({ providerId, serviceName, baselineDate, accountId }),
    })
    return response.json()
  },

  getCostSummary: async (providerId: string, month: number, year: number, accountId?: number) => {
    const params = new URLSearchParams()
    if (accountId) params.append('accountId', accountId.toString())
    
    try {
      const response = await apiRequest(`/insights/cost-summary/${providerId}/${month}/${year}?${params.toString()}`)
      const data = await response.json()
      // API returns { explanation, costChange, contributingFactors } or { explanation: null }
      return data
    } catch (error: any) {
      // 404 is expected when no cost data exists - return null instead of throwing
      if (error.message && (error.message.includes('404') || error.message.includes('Not Found'))) {
        return { explanation: null }
      }
      // Handle 401 (Unauthorized) - token might be expired or missing
      if (error.message && (error.message.includes('401') || error.message.includes('Access token required') || error.message.includes('Unauthorized') || error.message.includes('Invalid or expired token'))) {
        // Check if we have a token to refresh
        const token = getToken()
        if (token) {
          // Try to refresh token and retry once
          try {
            await authAPI.refreshToken()
            const retryResponse = await apiRequest(`/insights/cost-summary/${providerId}/${month}/${year}?${params.toString()}`)
            const retryData = await retryResponse.json()
            return retryData
          } catch (retryError: any) {
            // If retry also fails with 404, that's expected
            if (retryError.message && (retryError.message.includes('404') || retryError.message.includes('Not Found'))) {
              return { explanation: null }
            }
            // Refresh failed, return null
            return { explanation: null }
          }
        } else {
          // No token available, return null (user might be in demo mode)
          return { explanation: null }
        }
      }
      // Only log unexpected errors
      if (!error.message?.includes('404')) {
        console.error('Failed to fetch cost summary:', error)
      }
      return { explanation: null }
    }
  },

  regenerateCostSummary: async (providerId: string, month: number, year: number, accountId?: number) => {
    const response = await apiRequest(`/insights/cost-summary/${providerId}/${month}/${year}/regenerate`, {
      method: 'POST',
      body: JSON.stringify({ accountId }),
    })
    return response.json()
  },

  getCustomDateRangeSummary: async (providerId: string, startDate: string, endDate: string, accountId?: number, forceRegenerate?: boolean) => {
    try {
      const response = await apiRequest(`/insights/cost-summary-range/${providerId}`, {
        method: 'POST',
        body: JSON.stringify({ startDate, endDate, accountId, forceRegenerate: forceRegenerate || false }),
      })
      
      if (response.status === 404) {
        return { explanation: null }
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }
      
      return response.json()
    } catch (error: any) {
      if (error.message && (error.message.includes('404') || error.message.includes('No cost data'))) {
        return { explanation: null }
      }
      console.error('Failed to fetch custom date range summary:', error)
      throw error
    }
  },

  getAvailableDimensions: async (providerId?: string, accountId?: number) => {
    const params = new URLSearchParams()
    if (providerId) params.append('providerId', providerId)
    if (accountId) params.append('accountId', accountId.toString())
    
    const response = await apiRequest(`/insights/dimensions?${params.toString()}`)
    return response.json()
  },

  getCostByDimension: async (dimensionKey: string, dimensionValue?: string, providerId?: string, accountId?: number) => {
    const params = new URLSearchParams()
    params.append('dimensionKey', dimensionKey)
    if (dimensionValue) params.append('dimensionValue', dimensionValue)
    if (providerId) params.append('providerId', providerId)
    if (accountId) params.append('accountId', accountId.toString())
    
    const response = await apiRequest(`/insights/cost-by-dimension?${params.toString()}`)
    return response.json()
  },

  saveBusinessMetric: async (metric: {
    metricType: string
    metricName: string
    date: string
    metricValue: number
    unit?: string
    notes?: string
    providerId?: string
    accountId?: number
  }) => {
    const response = await apiRequest('/insights/business-metrics', {
      method: 'POST',
      body: JSON.stringify(metric),
    })
    return response.json()
  },

  deleteBusinessMetric: async (id: number) => {
    const response = await apiRequest(`/insights/business-metrics/${id}`, {
      method: 'DELETE',
    })
    return response.json()
  },

  getBusinessMetrics: async (startDate: string, endDate: string, metricType?: string, metricName?: string, providerId?: string) => {
    const params = new URLSearchParams()
    params.append('startDate', startDate)
    params.append('endDate', endDate)
    if (metricType) params.append('metricType', metricType)
    if (metricName) params.append('metricName', metricName)
    if (providerId) params.append('providerId', providerId)
    
    const response = await apiRequest(`/insights/business-metrics?${params.toString()}`)
    return response.json()
  },

  getUnitEconomics: async (startDate: string, endDate: string, providerId?: string, accountId?: number) => {
    const params = new URLSearchParams()
    params.append('startDate', startDate)
    params.append('endDate', endDate)
    if (providerId) params.append('providerId', providerId)
    if (accountId) params.append('accountId', accountId.toString())
    
    const response = await apiRequest(`/insights/unit-economics?${params.toString()}`)
    return response.json()
  },

  getCostEfficiency: async (startDate: string, endDate: string, providerId?: string, accountId?: number) => {
    const params = new URLSearchParams()
    params.append('startDate', startDate)
    params.append('endDate', endDate)
    if (providerId) params.append('providerId', providerId)
    if (accountId) params.append('accountId', accountId.toString())
    
    const response = await apiRequest(`/insights/cost-efficiency?${params.toString()}`)
    return response.json()
  },

  getRightsizingRecommendations: async (providerId?: string, accountId?: number) => {
    const params = new URLSearchParams()
    if (providerId) params.append('providerId', providerId)
    if (accountId) params.append('accountId', accountId.toString())

    const response = await apiRequest(`/insights/rightsizing-recommendations?${params.toString()}`)
    return response.json()
  },

  getOptimizationRecommendations: async (filters?: {
    category?: string; provider_id?: string; account_id?: string; priority?: string;
    status?: string; limit?: number; offset?: number; sort_by?: string;
  }) => {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) params.append(key, String(value))
      })
    }
    const response = await apiRequest(`/insights/recommendations?${params.toString()}`)
    return response.json()
  },

  getOptimizationSummary: async () => {
    const response = await apiRequest('/insights/optimization-summary')
    return response.json()
  },

  dismissRecommendation: async (id: number, reason?: string) => {
    const response = await apiRequest(`/insights/recommendations/${id}/dismiss`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
    return response.json()
  },

  markRecommendationImplemented: async (id: number) => {
    const response = await apiRequest(`/insights/recommendations/${id}/implemented`, {
      method: 'POST',
    })
    return response.json()
  },

  refreshRecommendations: async () => {
    const response = await apiRequest('/insights/recommendations/refresh', {
      method: 'POST',
    })
    return response.json()
  },
}

// Budgets API
export const budgetsAPI = {
  createBudget: async (budgetData: {
    budgetName: string
    providerId?: string
    accountId?: number
    budgetAmount: number
    budgetPeriod: 'monthly' | 'quarterly' | 'yearly'
    alertThreshold?: number
    createInCloudProvider?: boolean
  }) => {
    const response = await apiRequest('/budgets', {
      method: 'POST',
      body: JSON.stringify(budgetData),
    })
    return response.json()
  },

  getBudgets: async (providerId?: string, accountId?: number) => {
    const params = new URLSearchParams()
    if (providerId) params.append('providerId', providerId)
    if (accountId) params.append('accountId', accountId.toString())
    
    const response = await apiRequest(`/budgets?${params.toString()}`)
    return response.json()
  },

  getBudget: async (budgetId: number) => {
    const response = await apiRequest(`/budgets/${budgetId}`)
    return response.json()
  },

  updateBudget: async (budgetId: number, updateData: Partial<{
    budgetName: string
    budgetAmount: number
    budgetPeriod: 'monthly' | 'quarterly' | 'yearly'
    alertThreshold: number
    status: 'active' | 'paused' | 'exceeded'
  }>) => {
    const response = await apiRequest(`/budgets/${budgetId}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    })
    return response.json()
  },

  deleteBudget: async (budgetId: number) => {
    const response = await apiRequest(`/budgets/${budgetId}`, {
      method: 'DELETE',
    })
    return response.json()
  },

  getBudgetAlerts: async () => {
    const response = await apiRequest('/budgets/alerts/all')
    return response.json()
  },

  getBudgetAlertHistory: async (limit?: number) => {
    const params = new URLSearchParams()
    if (limit) params.append('limit', limit.toString())
    
    const response = await apiRequest(`/budgets/alerts/history?${params.toString()}`)
    return response.json()
  },

  checkBudget: async (budgetId: number) => {
    const response = await apiRequest(`/budgets/${budgetId}/check`, {
      method: 'POST',
    })
    return response.json()
  },
}

// Reports API
export const reportsAPI = {
  generateShowbackReport: async (reportData: {
    reportName: string
    startDate: string
    endDate: string
    providerId?: string
    accountId?: number
    teamName?: string
    productName?: string
    format?: 'csv' | 'pdf'
  }) => {
    const response = await apiRequest('/reports/showback', {
      method: 'POST',
      body: JSON.stringify(reportData),
    })
    return response.json()
  },

  generateChargebackReport: async (reportData: {
    reportName: string
    startDate: string
    endDate: string
    providerId?: string
    accountId?: number
    teamName?: string
    productName?: string
    format?: 'csv' | 'pdf'
  }) => {
    const response = await apiRequest('/reports/chargeback', {
      method: 'POST',
      body: JSON.stringify(reportData),
    })
    return response.json()
  },

  getReports: async (reportType?: 'showback' | 'chargeback', limit?: number) => {
    const params = new URLSearchParams()
    if (reportType) params.append('reportType', reportType)
    if (limit) params.append('limit', limit.toString())
    
    const response = await apiRequest(`/reports?${params.toString()}`)
    return response.json()
  },

  getReport: async (reportId: number) => {
    const response = await apiRequest(`/reports/${reportId}`)
    return response.json()
  },

  downloadReport: async (reportId: number) => {
    const response = await apiRequest(`/reports/${reportId}/download`)
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const contentType = response.headers.get('content-type') || ''
    const extension = contentType.includes('pdf') ? 'pdf' : 'csv'
    a.download = `report_${reportId}.${extension}`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  },

  deleteReport: async (reportId: number) => {
    const response = await apiRequest(`/reports/${reportId}`, {
      method: 'DELETE',
    })
    return response.json()
  },
}

// Product/Team Cost API
export const productTeamAPI = {
  getCostByProduct: async (startDate: string, endDate: string, providerId?: string, accountId?: number) => {
    const params = new URLSearchParams()
    params.append('startDate', startDate)
    params.append('endDate', endDate)
    if (providerId) params.append('providerId', providerId)
    if (accountId) params.append('accountId', accountId.toString())
    
    const response = await apiRequest(`/insights/cost-by-product?${params.toString()}`)
    return response.json()
  },

  getCostByTeam: async (startDate: string, endDate: string, providerId?: string, accountId?: number) => {
    const params = new URLSearchParams()
    params.append('startDate', startDate)
    params.append('endDate', endDate)
    if (providerId) params.append('providerId', providerId)
    if (accountId) params.append('accountId', accountId.toString())
    
    const response = await apiRequest(`/insights/cost-by-team?${params.toString()}`)
    return response.json()
  },

  getProductTrends: async (productName: string, startDate: string, endDate: string, providerId?: string, accountId?: number) => {
    const params = new URLSearchParams()
    params.append('startDate', startDate)
    params.append('endDate', endDate)
    if (providerId) params.append('providerId', providerId)
    if (accountId) params.append('accountId', accountId.toString())
    
    const response = await apiRequest(`/insights/product/${encodeURIComponent(productName)}/trends?${params.toString()}`)
    return response.json()
  },

  getTeamTrends: async (teamName: string, startDate: string, endDate: string, providerId?: string, accountId?: number) => {
    const params = new URLSearchParams()
    params.append('startDate', startDate)
    params.append('endDate', endDate)
    if (providerId) params.append('providerId', providerId)
    if (accountId) params.append('accountId', accountId.toString())
    
    const response = await apiRequest(`/insights/team/${encodeURIComponent(teamName)}/trends?${params.toString()}`)
    return response.json()
  },

  getProductServices: async (productName: string, startDate: string, endDate: string, providerId?: string, accountId?: number) => {
    const params = new URLSearchParams()
    params.append('startDate', startDate)
    params.append('endDate', endDate)
    if (providerId) params.append('providerId', providerId)
    if (accountId) params.append('accountId', accountId.toString())
    
    const response = await apiRequest(`/insights/product/${encodeURIComponent(productName)}/services?${params.toString()}`)
    return response.json()
  },

  getTeamServices: async (teamName: string, startDate: string, endDate: string, providerId?: string, accountId?: number) => {
    const params = new URLSearchParams()
    params.append('startDate', startDate)
    params.append('endDate', endDate)
    if (providerId) params.append('providerId', providerId)
    if (accountId) params.append('accountId', accountId.toString())
    
    const response = await apiRequest(`/insights/team/${encodeURIComponent(teamName)}/services?${params.toString()}`)
    return response.json()
  },
}

// Notifications API
export const notificationsAPI = {
  getNotifications: async (options?: { unreadOnly?: boolean; limit?: number; offset?: number; type?: string }) => {
    const params = new URLSearchParams()
    if (options?.unreadOnly) params.append('unreadOnly', 'true')
    if (options?.limit) params.append('limit', options.limit.toString())
    if (options?.offset) params.append('offset', options.offset.toString())
    if (options?.type) params.append('type', options.type)
    
    const response = await apiRequest(`/notifications?${params.toString()}`)
    return response.json()
  },

  getUnreadCount: async () => {
    const response = await apiRequest('/notifications/count')
    return response.json()
  },

  markAsRead: async (notificationId: number) => {
    const response = await apiRequest(`/notifications/${notificationId}/read`, {
      method: 'PUT',
    })
    return response.json()
  },

  markAllAsRead: async () => {
    const response = await apiRequest('/notifications/read-all', {
      method: 'PUT',
    })
    return response.json()
  },

  deleteNotification: async (notificationId: number) => {
    const response = await apiRequest(`/notifications/${notificationId}`, {
      method: 'DELETE',
    })
    return response.json()
  },

  createNotification: async (notification: {
    type: string
    title: string
    message?: string
    link?: string
    linkText?: string
    metadata?: any
  }) => {
    const response = await apiRequest('/notifications', {
      method: 'POST',
      body: JSON.stringify(notification),
    })
    return response.json()
  },
  
  getSyncPreferences: async () => {
    const response = await apiRequest('/sync/preferences')
    return response.json()
  },
  
  updateSyncPreferences: async (accountId: number, autoSyncEnabled: boolean, autoSyncTime?: string) => {
    const response = await apiRequest('/sync/preferences', {
      method: 'PUT',
      body: JSON.stringify({ accountId, autoSyncEnabled, autoSyncTime }),
    })
    return response.json()
  },
}

// Email Preferences API (Pro only)
export const emailPreferencesAPI = {
  getPreferences: async () => {
    const response = await apiRequest('/email-preferences')
    return response.json()
  },
  
  updatePreferences: async (preferences: {
    emailAlertsEnabled?: boolean
    emailAnomalyAlerts?: boolean
    emailBudgetAlerts?: boolean
    emailWeeklySummary?: boolean
  }) => {
    const response = await apiRequest('/email-preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    })
    return response.json()
  },
}

// Billing API
export const billingAPI = {
  getSubscription: async () => {
    const response = await apiRequest('/billing/subscription')
    return response.json()
  },

  createCheckoutSession: async (planType: 'starter' | 'pro', billingPeriod: 'monthly' | 'annual' = 'monthly') => {
    const response = await apiRequest('/billing/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({ planType, billingPeriod }),
    })
    return response.json()
  },

  createPortalSession: async () => {
    const response = await apiRequest('/billing/create-portal-session', {
      method: 'POST',
    })
    return response.json()
  },

  cancelSubscription: async () => {
    const response = await apiRequest('/billing/cancel', {
      method: 'POST',
    })
    return response.json()
  },
}

// Contact API (public, no auth required)
export const contactAPI = {
  submit: async (data: { name: string; email: string; category: string; subject: string; message: string }) => {
    const response = await apiRequest('/contact', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return response.json()
  },
}

// Admin API
export const adminAPI = {
  getTickets: async (params?: { status?: string; category?: string; page?: number }) => {
    const q = new URLSearchParams()
    if (params?.status) q.append('status', params.status)
    if (params?.category) q.append('category', params.category)
    if (params?.page) q.append('page', params.page.toString())
    const response = await apiRequest(`/admin/tickets?${q.toString()}`)
    return response.json()
  },

  getTicket: async (id: number) => {
    const response = await apiRequest(`/admin/tickets/${id}`)
    return response.json()
  },

  updateTicketStatus: async (id: number, status: string) => {
    const response = await apiRequest(`/admin/tickets/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
    return response.json()
  },
}

// Compliance API (GDPR / DPDPA)
export const complianceAPI = {
  // Data Export (GDPR Art. 20 - Right to Data Portability)
  exportData: async () => {
    const response = await apiRequest('/compliance/export')
    return response.json()
  },

  // Account Deletion (GDPR Art. 17 - Right to Erasure)
  requestDeletion: async (reason?: string) => {
    const response = await apiRequest('/compliance/delete-account', {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
    return response.json()
  },

  confirmDeletion: async (requestId: number, keepForMarketing?: boolean) => {
    const response = await apiRequest(`/compliance/delete-account/${requestId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ keepForMarketing }),
    })
    return response.json()
  },

  cancelDeletion: async (requestId: number) => {
    const response = await apiRequest(`/compliance/delete-account/${requestId}/cancel`, {
      method: 'POST',
    })
    return response.json()
  },

  // Consent management
  getConsents: async () => {
    const response = await apiRequest('/compliance/consents')
    return response.json()
  },

  withdrawConsent: async (consentType: string) => {
    const response = await apiRequest('/compliance/consents/withdraw', {
      method: 'POST',
      body: JSON.stringify({ consentType }),
    })
    return response.json()
  },

  // Grievance (DPDPA Sec. 13)
  submitGrievance: async (data: { category: string; subject: string; description: string }) => {
    const response = await apiRequest('/compliance/grievance', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return response.json()
  },

  getGrievances: async () => {
    const response = await apiRequest('/compliance/grievances')
    return response.json()
  },
}

// ============================================================
// Organizations API
// ============================================================
export const organizationsAPI = {
  list: async () => {
    const response = await apiRequest('/organizations')
    return response.json()
  },
  create: async (name: string) => {
    const response = await apiRequest('/organizations', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
    return response.json()
  },
  get: async (id: number) => {
    const response = await apiRequest(`/organizations/${id}`)
    return response.json()
  },
  update: async (id: number, name: string) => {
    const response = await apiRequest(`/organizations/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    })
    return response.json()
  },
  getMembers: async (id: number) => {
    const response = await apiRequest(`/organizations/${id}/members`)
    return response.json()
  },
  updateMemberRole: async (orgId: number, userId: number, role: string) => {
    const response = await apiRequest(`/organizations/${orgId}/members/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    })
    return response.json()
  },
  removeMember: async (orgId: number, userId: number) => {
    const response = await apiRequest(`/organizations/${orgId}/members/${userId}`, {
      method: 'DELETE',
    })
    return response.json()
  },
  createInvite: async (orgId: number, email: string, role: string = 'member') => {
    const response = await apiRequest(`/organizations/${orgId}/invites`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    })
    return response.json()
  },
  getInvites: async (orgId: number) => {
    const response = await apiRequest(`/organizations/${orgId}/invites`)
    return response.json()
  },
  deleteInvite: async (orgId: number, inviteId: number) => {
    const response = await apiRequest(`/organizations/${orgId}/invites/${inviteId}`, {
      method: 'DELETE',
    })
    return response.json()
  },
  acceptInvite: async (token: string) => {
    const response = await apiRequest('/organizations/accept-invite', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
    return response.json()
  },
}

// ============================================================
// Anomaly Events API (ML-powered)
// ============================================================
export const anomalyEventsAPI = {
  getEvents: async (params?: { status?: string; severity?: string; providerId?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams()
    if (params?.status) query.set('status', params.status)
    if (params?.severity) query.set('severity', params.severity)
    if (params?.providerId) query.set('providerId', params.providerId)
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.offset) query.set('offset', String(params.offset))
    const response = await apiRequest(`/insights/anomalies/events?${query.toString()}`)
    return response.json()
  },
  updateStatus: async (eventId: number, status: string) => {
    const response = await apiRequest(`/insights/anomalies/events/${eventId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
    return response.json()
  },
}

// ============================================================
// Cost Policies API
// ============================================================
export const policiesAPI = {
  list: async () => {
    const response = await apiRequest('/policies')
    return response.json()
  },
  create: async (data: { name: string; description?: string; policyType: string; conditions: Record<string, unknown>; actions?: string[]; scopeProviderId?: string; scopeAccountId?: number }) => {
    const response = await apiRequest('/policies', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return response.json()
  },
  get: async (id: number) => {
    const response = await apiRequest(`/policies/${id}`)
    return response.json()
  },
  update: async (id: number, data: Record<string, unknown>) => {
    const response = await apiRequest(`/policies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    return response.json()
  },
  delete: async (id: number) => {
    const response = await apiRequest(`/policies/${id}`, { method: 'DELETE' })
    return response.json()
  },
  getViolations: async (params?: { policyId?: number; resolved?: boolean; limit?: number; offset?: number }) => {
    const query = new URLSearchParams()
    if (params?.policyId) query.set('policyId', String(params.policyId))
    if (params?.resolved !== undefined) query.set('resolved', String(params.resolved))
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.offset) query.set('offset', String(params.offset))
    const response = await apiRequest(`/policies/violations/list?${query.toString()}`)
    return response.json()
  },
  resolveViolation: async (violationId: number) => {
    const response = await apiRequest(`/policies/violations/${violationId}/resolve`, {
      method: 'PUT',
    })
    return response.json()
  },
}

// ============================================================
// Forecasts API
// ============================================================
export const forecastsAPI = {
  getBaseForecast: async (months: number = 6, providerId?: string, accountId?: number) => {
    const query = new URLSearchParams({ months: String(months) })
    if (providerId) query.set('providerId', providerId)
    if (accountId) query.set('accountId', String(accountId))
    const response = await apiRequest(`/forecasts?${query.toString()}`)
    return response.json()
  },
  listScenarios: async () => {
    const response = await apiRequest('/forecasts/scenarios')
    return response.json()
  },
  createScenario: async (data: { name: string; description?: string; adjustments: unknown[]; forecastMonths?: number }) => {
    const response = await apiRequest('/forecasts/scenarios', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return response.json()
  },
  getScenario: async (id: number) => {
    const response = await apiRequest(`/forecasts/scenarios/${id}`)
    return response.json()
  },
  updateScenario: async (id: number, data: Record<string, unknown>) => {
    const response = await apiRequest(`/forecasts/scenarios/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    return response.json()
  },
  computeScenario: async (id: number) => {
    const response = await apiRequest(`/forecasts/scenarios/${id}/compute`, {
      method: 'POST',
    })
    return response.json()
  },
  deleteScenario: async (id: number) => {
    const response = await apiRequest(`/forecasts/scenarios/${id}`, {
      method: 'DELETE',
    })
    return response.json()
  },
  preview: async (adjustments: unknown[], forecastMonths: number = 6) => {
    const response = await apiRequest('/forecasts/preview', {
      method: 'POST',
      body: JSON.stringify({ adjustments, forecastMonths }),
    })
    return response.json()
  },
}

// ============================================================
// Kubernetes API
// ============================================================
export const kubernetesAPI = {
  listClusters: async () => {
    const response = await apiRequest('/kubernetes/clusters')
    return response.json()
  },
  createCluster: async (data: { clusterName: string; clusterId?: string; providerId?: string; accountId?: number; region?: string; nodeCount?: number; totalCost?: number }) => {
    const response = await apiRequest('/kubernetes/clusters', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return response.json()
  },
  getCluster: async (id: number) => {
    const response = await apiRequest(`/kubernetes/clusters/${id}`)
    return response.json()
  },
  deleteCluster: async (id: number) => {
    const response = await apiRequest(`/kubernetes/clusters/${id}`, {
      method: 'DELETE',
    })
    return response.json()
  },
  ingestMetrics: async (clusterId: number, payload: Record<string, unknown>) => {
    const response = await apiRequest(`/kubernetes/clusters/${clusterId}/metrics`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return response.json()
  },
  getNamespaces: async (clusterId: number, startDate?: string, endDate?: string) => {
    const query = new URLSearchParams()
    if (startDate) query.set('startDate', startDate)
    if (endDate) query.set('endDate', endDate)
    const response = await apiRequest(`/kubernetes/clusters/${clusterId}/namespaces?${query.toString()}`)
    return response.json()
  },
  getWorkloads: async (clusterId: number, namespace?: string, startDate?: string, endDate?: string) => {
    const query = new URLSearchParams()
    if (namespace) query.set('namespace', namespace)
    if (startDate) query.set('startDate', startDate)
    if (endDate) query.set('endDate', endDate)
    const response = await apiRequest(`/kubernetes/clusters/${clusterId}/workloads?${query.toString()}`)
    return response.json()
  },
  getIdleResources: async (clusterId: number, startDate?: string, endDate?: string) => {
    const query = new URLSearchParams()
    if (startDate) query.set('startDate', startDate)
    if (endDate) query.set('endDate', endDate)
    const response = await apiRequest(`/kubernetes/clusters/${clusterId}/idle?${query.toString()}`)
    return response.json()
  },
}
