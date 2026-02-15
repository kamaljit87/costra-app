import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authAPI } from '../services/api'

interface User {
  id: number
  name: string
  email: string
  avatarUrl?: string
}

interface AuthContextType {
  /** False until we have read token/user from localStorage on initial load; prevents redirect-to-login before hydration */
  authReady: boolean
  isAuthenticated: boolean
  isDemoMode: boolean
  user: User | null
  /** Set when login returned requires2fa; cleared after verify or cancel */
  pending2FA: { tempToken: string; email: string } | null
  login: (email: string, password: string) => Promise<boolean>
  complete2FALogin: (code: string) => Promise<boolean>
  clearPending2FA: () => void
  signup: (name: string, email: string, password: string, consentAccepted?: boolean) => Promise<boolean>
  googleLogin: (credential: string) => Promise<boolean>
  logout: () => void
  updateUser: (userData: Partial<User>) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authReady, setAuthReady] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [pending2FA, setPending2FA] = useState<{ tempToken: string; email: string } | null>(null)

  const logout = () => {
    setIsAuthenticated(false)
    setIsDemoMode(false)
    setUser(null)
    authAPI.logout()
    localStorage.removeItem('authToken')
    localStorage.removeItem('user')
  }

  // Verify token and refresh if needed
  const verifyAndRefreshToken = async () => {
    try {
      const response = await authAPI.getCurrentUser()
      if (response.user) {
        // Token is valid, update user data if needed
        setUser(response.user)
        localStorage.setItem('user', JSON.stringify(response.user))
      }
    } catch (error: any) {
      // Token invalid or expired, try to refresh
      if (error.message?.includes('expired') || error.message?.includes('Invalid')) {
        try {
          const refreshed = await authAPI.refreshToken()
          if (refreshed.token && refreshed.user) {
            setUser(refreshed.user)
            setIsAuthenticated(true)
            setIsDemoMode(false)
            localStorage.setItem('authToken', refreshed.token)
            localStorage.setItem('user', JSON.stringify(refreshed.user))
          } else {
            logout()
          }
        } catch (refreshError) {
          // Refresh failed, logout
          logout()
        }
      } else {
        // Other error, logout
        logout()
      }
    }
  }

  useEffect(() => {
    // Check if user is already logged in (restore session from localStorage before first paint)
    const token = localStorage.getItem('authToken')
    const savedUser = localStorage.getItem('user')

    // Remove any existing demo mode
    localStorage.removeItem('demoMode')

    if (token && savedUser) {
      try {
        const userData = JSON.parse(savedUser)
        setUser(userData)
        setIsAuthenticated(true)
        setIsDemoMode(false)
        // Verify token is still valid and refresh if needed (async; may call logout on failure)
        verifyAndRefreshToken()
      } catch (error) {
        console.error('Error parsing user data:', error)
        logout()
      }
    }
    setAuthReady(true)
  }, [])

  // Set up automatic token refresh before expiration
  useEffect(() => {
    if (!isAuthenticated || isDemoMode) return

    const token = localStorage.getItem('authToken')
    if (!token) return

    // Decode token to check expiration (without verification)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const expirationTime = payload.exp * 1000 // Convert to milliseconds
      const currentTime = Date.now()
      const timeUntilExpiry = expirationTime - currentTime
      
      // Refresh token if it expires in less than 1 hour
      const oneHour = 60 * 60 * 1000
      if (timeUntilExpiry < oneHour && timeUntilExpiry > 0) {
        // Schedule refresh 5 minutes before expiration
        const refreshTime = timeUntilExpiry - (5 * 60 * 1000) // 5 minutes before expiry
        if (refreshTime > 0) {
          const timeoutId = setTimeout(() => {
            verifyAndRefreshToken()
          }, refreshTime)
          
          return () => clearTimeout(timeoutId)
        }
      }
    } catch (error) {
      // Invalid token format, logout
      console.error('Invalid token format:', error)
      logout()
    }
  }, [isAuthenticated, isDemoMode])

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await authAPI.login(email, password)
      if (response.requires2fa && response.tempToken) {
        setPending2FA({ tempToken: response.tempToken, email })
        return false
      }
      if (response.token && response.user) {
        setUser(response.user)
        setIsAuthenticated(true)
        setIsDemoMode(false)
        localStorage.setItem('authToken', response.token)
        localStorage.setItem('user', JSON.stringify(response.user))
        return true
      }
      return false
    } catch (error: any) {
      console.error('Login error:', error)
      throw new Error(error.message || 'Login failed. Please try again.')
    }
  }

  const complete2FALogin = async (code: string): Promise<boolean> => {
    if (!pending2FA) return false
    try {
      const data = await authAPI.verify2FALogin(pending2FA.tempToken, code)
      setPending2FA(null)
      if (data.token && data.user) {
        setUser(data.user as User)
        setIsAuthenticated(true)
        setIsDemoMode(false)
        return true
      }
      return false
    } catch (error: any) {
      throw new Error(error.message || 'Invalid code')
    }
  }

  const clearPending2FA = () => setPending2FA(null)

  const googleLogin = async (credential: string): Promise<boolean> => {
    try {
      const response = await authAPI.googleLogin(credential)
      if (response.token && response.user) {
        setUser(response.user)
        setIsAuthenticated(true)
        setIsDemoMode(false)
        return true
      }
      return false
    } catch (error: any) {
      console.error('Google login error:', error)
      throw new Error(error.message || 'Google sign-in failed. Please try again.')
    }
  }

  const signup = async (name: string, email: string, password: string, consentAccepted: boolean = true): Promise<boolean> => {
    try {
      const response = await authAPI.signup(name, email, password, consentAccepted)
      if (response.token && response.user) {
        setUser(response.user)
        setIsAuthenticated(true)
        setIsDemoMode(false)
        return true
      }
      return false
    } catch (error: any) {
      console.error('Signup error:', error)
      // Re-throw with the error message so it can be displayed to the user
      throw new Error(error.message || 'Signup failed. Please try again.')
    }
  }

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData }
      setUser(updatedUser)
      localStorage.setItem('user', JSON.stringify(updatedUser))
    }
  }

  return (
    <AuthContext.Provider
      value={{
        authReady,
        isAuthenticated,
        isDemoMode,
        user,
        pending2FA,
        login,
        complete2FALogin,
        clearPending2FA,
        signup,
        googleLogin,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

