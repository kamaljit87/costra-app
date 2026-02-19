import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
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
        // Try to load user's saved currency preference
        const token = localStorage.getItem('authToken')
        if (token && !localStorage.getItem('demoMode')) {
          const prefs = await costDataAPI.getPreferences()
          if (prefs.preferences?.currency) {
            setSelectedCurrency(prefs.preferences.currency as Currency)
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

  const handleCurrencyChange = async (currency: Currency) => {
    setSelectedCurrency(currency)
    // Save to database if user is authenticated (not demo mode)
    const token = localStorage.getItem('authToken')
    if (token && !localStorage.getItem('demoMode')) {
      try {
        await costDataAPI.updateCurrency(currency)
      } catch (error) {
        console.error('Failed to save currency preference:', error)
      }
    }
  }

  const convertAmount = (amount: number, fromCurrency: Currency = 'USD'): number => {
    if (!exchangeRates || fromCurrency === selectedCurrency) {
      return amount
    }
    
    // Convert from source currency to USD first, then to target currency
    const usdAmount = fromCurrency === 'USD' ? amount : amount / exchangeRates[fromCurrency]
    return selectedCurrency === 'USD' ? usdAmount : usdAmount * exchangeRates[selectedCurrency]
  }

  const formatCurrency = (amount: number): string => {
    const convertedAmount = convertAmount(amount)
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: selectedCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(convertedAmount)
  }

  const getCurrencySymbol = (): string => {
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
  }

  return (
    <CurrencyContext.Provider
      value={{
        selectedCurrency,
        exchangeRates,
        setSelectedCurrency: handleCurrencyChange,
        convertAmount,
        formatCurrency,
        getCurrencySymbol,
        isLoading,
      }}
    >
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

