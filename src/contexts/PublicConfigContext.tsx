import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getAuthConfig } from '../services/api'

interface PublicConfigContextType {
  signupDisabled: boolean
  configReady: boolean
}

const PublicConfigContext = createContext<PublicConfigContextType | undefined>(undefined)

export const PublicConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [signupDisabled, setSignupDisabled] = useState(false)
  const [configReady, setConfigReady] = useState(false)

  useEffect(() => {
    getAuthConfig()
      .then((c) => {
        setSignupDisabled(c.signupDisabled)
      })
      .catch(() => {})
      .finally(() => setConfigReady(true))
  }, [])

  return (
    <PublicConfigContext.Provider value={{ signupDisabled, configReady }}>
      {children}
    </PublicConfigContext.Provider>
  )
}

export const usePublicConfig = () => {
  const ctx = useContext(PublicConfigContext)
  if (ctx === undefined) {
    throw new Error('usePublicConfig must be used within PublicConfigProvider')
  }
  return ctx
}
