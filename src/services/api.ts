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
