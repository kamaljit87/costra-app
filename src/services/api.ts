// Use relative URL to leverage Vite proxy in development, or absolute URL in production
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:3001/api')

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
      
      let error
      try {
        const errorData = await response.json()
        error = errorData.error || errorData.message || `HTTP error! status: ${response.status}`
      } catch (e) {
        // If response is not JSON, get text
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
  signup: async (name: string, email: string, password: string) => {
    const response = await apiRequest('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
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
    if (data.token) {
      localStorage.setItem('authToken', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
    }
    return data
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

  googleLogin: async (googleId: string, name: string, email: string, avatarUrl?: string) => {
    const response = await apiRequest('/auth/google/callback', {
      method: 'POST',
      body: JSON.stringify({ googleId, name, email, avatarUrl }),
    })
    const data = await response.json()
    if (data.token) {
      localStorage.setItem('authToken', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
    }
    return data
  },
}

// Cost Data API
export const costDataAPI = {
  getCostData: async () => {
    const response = await apiRequest('/cost-data')
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

  // Verify AWS connection after CloudFormation stack is created
  verifyAWSConnection: async (accountId: number) => {
    const response = await apiRequest(`/cloud-providers/aws/${accountId}/verify`, {
      method: 'POST',
    })
    return response.json()
  },

  // Health check for AWS connection
  checkAWSConnectionHealth: async (accountId: number) => {
    const response = await apiRequest(`/cloud-providers/aws/${accountId}/health`)
    return response.json()
  },

  // Delete specific account by account ID
  deleteCloudProviderAccount: async (accountId: number) => {
    const response = await apiRequest(`/cloud-providers/account/${accountId}`, {
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
