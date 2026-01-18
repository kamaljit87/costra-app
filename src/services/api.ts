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

  getUntaggedResources: async (providerId?: string, limit: number = 50) => {
    const params = new URLSearchParams()
    if (providerId) params.append('providerId', providerId)
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
    
    const response = await apiRequest(`/insights/cost-summary/${providerId}/${month}/${year}?${params.toString()}`)
    return response.json()
  },

  regenerateCostSummary: async (providerId: string, month: number, year: number, accountId?: number) => {
    const response = await apiRequest(`/insights/cost-summary/${providerId}/${month}/${year}/regenerate`, {
      method: 'POST',
      body: JSON.stringify({ accountId }),
    })
    return response.json()
  },
}
