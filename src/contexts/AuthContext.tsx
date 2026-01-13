import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authAPI } from '../services/api'

interface User {
  id: number
  name: string
  email: string
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [user, setUser] = useState<User | null>(null)

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
        // Verify token is still valid
        authAPI.getCurrentUser().catch(() => {
          // Token invalid, logout
          logout()
        })
      } catch (error) {
        console.error('Error parsing user data:', error)
        logout()
      }
    }
  }, [])

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

  const logout = () => {
    setIsAuthenticated(false)
    setIsDemoMode(false)
    setUser(null)
    authAPI.logout()
    localStorage.removeItem('demoMode')
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

