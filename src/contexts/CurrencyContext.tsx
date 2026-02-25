import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react'
import { getExchangeRates, Currency, ExchangeRates } from '../services/currencyService'
import { costDataAPI } from '../services/api'
import { useAuth } from './AuthContext'

interface CurrencyContextType {
  selectedCurrency: Currency
  exchangeRates: ExchangeRates | null
  setSelectedCurrency: (currency: Currency) => void
  convertAmount: (amount: number, fromCurrency?: Currency) => number
  formatCurrency: (amount: number) => string
  getCurrencySymbol: () => string
  isLoading: boolean
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined)

export const CurrencyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth()
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('USD')
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadUserPreferences = async () => {
      try {
        const token = localStorage.getItem('authToken')
        if (token && !localStorage.getItem('demoMode')) {
          // Use cached preference immediately, then refresh in background
          const cachedCurrency = localStorage.getItem('costra_currency')
          if (cachedCurrency) {
            setSelectedCurrency(cachedCurrency as Currency)
          }
          const prefs = await costDataAPI.getPreferences()
          if (prefs.preferences?.currency) {
            setSelectedCurrency(prefs.preferences.currency as Currency)
            localStorage.setItem('costra_currency', prefs.preferences.currency)
          }
        }
      } catch (error) {
        console.error('Failed to load user preferences:', error)
      }
    }

    loadUserPreferences()
  }, [isAuthenticated])

  useEffect(() => {
    const loadExchangeRates = async () => {
      try {
        setIsLoading(true)
        const rates = await getExchangeRates()
        setExchangeRates(rates)
      } catch (error) {
        console.error('Failed to load exchange rates:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadExchangeRates()
    // Refresh rates every hour
    const interval = setInterval(loadExchangeRates, 3600000)
    return () => clearInterval(interval)
  }, [])

  const handleCurrencyChange = useCallback(async (currency: Currency) => {
    setSelectedCurrency(currency)
    localStorage.setItem('costra_currency', currency)
    // Save to database if user is authenticated (not demo mode)
    const token = localStorage.getItem('authToken')
    if (token && !localStorage.getItem('demoMode')) {
      try {
        await costDataAPI.updateCurrency(currency)
      } catch (error) {
        console.error('Failed to save currency preference:', error)
      }
    }
  }, [])

  const convertAmount = useCallback((amount: number, fromCurrency: Currency = 'USD'): number => {
    if (!exchangeRates || fromCurrency === selectedCurrency) {
      return amount
    }

    // Convert from source currency to USD first, then to target currency
    const usdAmount = fromCurrency === 'USD' ? amount : amount / exchangeRates[fromCurrency]
    return selectedCurrency === 'USD' ? usdAmount : usdAmount * exchangeRates[selectedCurrency]
  }, [exchangeRates, selectedCurrency])

  const formatCurrency = useCallback((amount: number): string => {
    const convertedAmount = convertAmount(amount)
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: selectedCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(convertedAmount)
  }, [convertAmount, selectedCurrency])

  const getCurrencySymbol = useCallback((): string => {
    const symbols: Record<Currency, string> = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      INR: '₹',
      JPY: '¥',
      AUD: 'A$',
      CAD: 'C$',
      CNY: '¥',
      CHF: 'CHF',
      SGD: 'S$',
    }
    return symbols[selectedCurrency] || '$'
  }, [selectedCurrency])

  const value = useMemo(() => ({
    selectedCurrency,
    exchangeRates,
    setSelectedCurrency: handleCurrencyChange,
    convertAmount,
    formatCurrency,
    getCurrencySymbol,
    isLoading,
  }), [selectedCurrency, exchangeRates, handleCurrencyChange, convertAmount, formatCurrency, getCurrencySymbol, isLoading])

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  )
}

export const useCurrency = () => {
  const context = useContext(CurrencyContext)
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider')
  }
  return context
}

