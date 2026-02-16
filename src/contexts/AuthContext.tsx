import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authAPI } from '../services/api'

interface User {
  id: number
  name: string
  email: string
  avatarUrl?: string
}

interface AuthContextType {
  authReady: boolean
  isAuthenticated: boolean
  isDemoMode: boolean
  user: User | null
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; twoFactorRequired?: boolean; temporaryToken?: string; user?: User }>
  signup: (name: string, email: string, password: string, consentAccepted?: boolean) => Promise<boolean>
  googleLogin: (credential: string) => Promise<boolean>
  /** Call after Google OAuth redirect when token/user are already in localStorage. */
  setSessionFromStorage: () => void
  logout: () => void
  updateUser: (userData: Partial<User>) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authReady, setAuthReady] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [user, setUser] = useState<User | null>(null)

  const logout = () => {
    setIsAuthenticated(false)
    setIsDemoMode(false)
    setUser(null)
    authAPI.logout()
    localStorage.removeItem('authToken')
    localStorage.removeItem('user')
  }

  const verifyAndRefreshToken = async () => {
    try {
      const response = await authAPI.getCurrentUser()
      if (response.user) {
        setUser(response.user)
        localStorage.setItem('user', JSON.stringify(response.user))
      }
    } catch (error: any) {
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
        } catch {
          logout()
        }
      } else {
        logout()
      }
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('authToken')
    const savedUser = localStorage.getItem('user')
    localStorage.removeItem('demoMode')

    if (token && savedUser) {
      try {
        const userData = JSON.parse(savedUser)
        setUser(userData)
        setIsAuthenticated(true)
        setIsDemoMode(false)
        verifyAndRefreshToken()
      } catch (error) {
        console.error('Error parsing user data:', error)
        logout()
      }
    }
    setAuthReady(true)
  }, [])

  useEffect(() => {
    if (!isAuthenticated || isDemoMode) return
    const token = localStorage.getItem('authToken')
    if (!token) return
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const expirationTime = payload.exp * 1000
      const timeUntilExpiry = expirationTime - Date.now()
      const oneHour = 60 * 60 * 1000
      if (timeUntilExpiry < oneHour && timeUntilExpiry > 0) {
        const refreshTime = timeUntilExpiry - (5 * 60 * 1000)
        if (refreshTime > 0) {
          const timeoutId = setTimeout(() => verifyAndRefreshToken(), refreshTime)
          return () => clearTimeout(timeoutId)
        }
      }
    } catch (error) {
      console.error('Invalid token format:', error)
      logout()
    }
  }, [isAuthenticated, isDemoMode])

  const login = async (email: string, password: string): Promise<{ ok: true } | { ok: false; twoFactorRequired?: boolean; temporaryToken?: string; user?: User }> => {
    try {
      const response = await authAPI.login(email, password)
      if (response.twoFactorRequired && response.temporaryToken && response.user) {
        return { ok: false, twoFactorRequired: true, temporaryToken: response.temporaryToken, user: response.user as User }
      }
      if (response.token && response.user) {
        setUser(response.user as User)
        setIsAuthenticated(true)
        setIsDemoMode(false)
        localStorage.setItem('authToken', response.token)
        localStorage.setItem('user', JSON.stringify(response.user))
        return { ok: true }
      }
      return { ok: false }
    } catch (error: any) {
      console.error('Login error:', error)
      throw new Error(error.message || 'Login failed. Please try again.')
    }
  }

  const googleLogin = async (credential: string): Promise<boolean> => {
    try {
      const response = await authAPI.googleLogin(credential)
      if (response.error) throw new Error(response.error)
      if (response.twoFactorRequired && response.temporaryToken && response.user) {
        return false
      }
      if (response.token && response.user) {
        setUser(response.user as User)
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

  /** Updates React state from localStorage (e.g. after Google redirect code exchange). */
  const setSessionFromStorage = () => {
    const token = localStorage.getItem('authToken')
    const savedUser = localStorage.getItem('user')
    if (token && savedUser) {
      try {
        const userData = JSON.parse(savedUser) as User
        setUser(userData)
        setIsAuthenticated(true)
        setIsDemoMode(false)
      } catch {
        // ignore invalid stored user
      }
    }
  }

  const signup = async (name: string, email: string, password: string, consentAccepted: boolean = true): Promise<boolean> => {
    try {
      const response = await authAPI.signup(name, email, password, consentAccepted)
      if (response.token && response.user) {
        setUser(response.user as User)
        setIsAuthenticated(true)
        setIsDemoMode(false)
        return true
      }
      return false
    } catch (error: any) {
      console.error('Signup error:', error)
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
        login,
        signup,
        googleLogin,
        setSessionFromStorage,
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
