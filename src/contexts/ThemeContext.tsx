import { createContext, useContext, useEffect, useState, useCallback } from 'react'

const STORAGE_KEY = 'costra-theme'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  effectiveTheme: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function getStoredTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch (_) { /* ignore */ }
  return 'system'
}

function getEffectiveTheme(theme: ThemeMode): 'light' | 'dark' {
  if (theme === 'light') return 'light'
  if (theme === 'dark') return 'dark'
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  return 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(getStoredTheme)
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>(() => getEffectiveTheme(getStoredTheme()))

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch (_) { /* ignore */ }
  }, [])

  useEffect(() => {
    const effective = getEffectiveTheme(theme)
    setEffectiveTheme(effective)
    const root = document.documentElement
    if (effective === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      const effective = getEffectiveTheme('system')
      setEffectiveTheme(effective)
      if (effective === 'dark') document.documentElement.classList.add('dark')
      else document.documentElement.classList.remove('dark')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, effectiveTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
