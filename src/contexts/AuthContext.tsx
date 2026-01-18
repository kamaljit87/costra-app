import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authAPI } from '../services/api'

interface User {
  id: number
  name: string
  email: string
  avatarUrl?: string
}

interface AuthContextType {
  isAuthenticated: boolean
  isDemoMode: boolean
  user: User | null
  login: (email: string, password: string) => Promise<boolean>
  signup: (name: string, email: string, password: string) => Promise<boolean>
  googleLogin: (googleId: string, name: string, email: string, avatarUrl?: string) => Promise<boolean>
  demoLogin: () => void
  logout: () => void
  updateUser: (userData: Partial<User>) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [user, setUser] = useState<User | null>(null)

  const logout = () => {
    setIsAuthenticated(false)
    setIsDemoMode(false)
    setUser(null)
    authAPI.logout()
    localStorage.removeItem('demoMode')
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
    // Check if user is already logged in
    const token = localStorage.getItem('authToken')
    const demoStatus = localStorage.getItem('demoMode')
    const savedUser = localStorage.getItem('user')

    if (demoStatus === 'true') {
      setIsDemoMode(true)
      setIsAuthenticated(true)
    } else if (token && savedUser) {
      try {
        const userData = JSON.parse(savedUser)
        setUser(userData)
        setIsAuthenticated(true)
        setIsDemoMode(false)
        // Verify token is still valid and refresh if needed
        verifyAndRefreshToken()
      } catch (error) {
        console.error('Error parsing user data:', error)
        logout()
      }
    }
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
      if (response.token && response.user) {
        setUser(response.user)
        setIsAuthenticated(true)
        setIsDemoMode(false)
        return true
      }
      return false
    } catch (error: any) {
      console.error('Login error:', error)
      // Re-throw with the error message so it can be displayed to the user
      throw new Error(error.message || 'Login failed. Please try again.')
    }
  }

  const googleLogin = async (googleId: string, name: string, email: string, avatarUrl?: string): Promise<boolean> => {
    try {
      const response = await authAPI.googleLogin(googleId, name, email, avatarUrl)
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

  const signup = async (name: string, email: string, password: string): Promise<boolean> => {
    try {
      const response = await authAPI.signup(name, email, password)
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

  const demoLogin = () => {
    setIsAuthenticated(true)
    setIsDemoMode(true)
    localStorage.setItem('demoMode', 'true')
    // Don't set authToken for demo mode
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
        isAuthenticated,
        isDemoMode,
        user,
        login,
        signup,
        googleLogin,
        demoLogin,
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

