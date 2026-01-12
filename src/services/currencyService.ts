export type Currency = 'USD' | 'EUR' | 'GBP' | 'INR' | 'JPY' | 'CNY' | 'AUD' | 'CAD' | 'CHF' | 'SGD'

export interface ExchangeRates {
  EUR: number
  GBP: number
  INR: number
  JPY: number
  CNY: number
  AUD: number
  CAD: number
  CHF: number
  SGD: number
}

// In production, this would call a real API like exchangerate-api.com or fixer.io
export const getExchangeRates = async (): Promise<ExchangeRates> => {
  try {
    // Using exchangerate-api.com free tier (no API key needed for USD base)
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD')
    const data = await response.json()
    
    return {
      EUR: data.rates.EUR || 0.92,
      GBP: data.rates.GBP || 0.79,
      INR: data.rates.INR || 83.0,
      JPY: data.rates.JPY || 149.0,
      CNY: data.rates.CNY || 7.2,
      AUD: data.rates.AUD || 1.52,
      CAD: data.rates.CAD || 1.36,
      CHF: data.rates.CHF || 0.88,
      SGD: data.rates.SGD || 1.34,
    }
  } catch (error) {
    console.error('Failed to fetch exchange rates, using fallback values:', error)
    // Fallback rates (approximate)
    return {
      EUR: 0.92,
      GBP: 0.79,
      INR: 83.0,
      JPY: 149.0,
      CNY: 7.2,
      AUD: 1.52,
      CAD: 1.36,
      CHF: 0.88,
      SGD: 1.34,
    }
  }
}

export const CURRENCY_INFO: Record<Currency, { symbol: string; name: string }> = {
  USD: { symbol: '$', name: 'US Dollar' },
  EUR: { symbol: '€', name: 'Euro' },
  GBP: { symbol: '£', name: 'British Pound' },
  INR: { symbol: '₹', name: 'Indian Rupee' },
  JPY: { symbol: '¥', name: 'Japanese Yen' },
  CNY: { symbol: '¥', name: 'Chinese Yuan' },
  AUD: { symbol: 'A$', name: 'Australian Dollar' },
  CAD: { symbol: 'C$', name: 'Canadian Dollar' },
  CHF: { symbol: 'CHF', name: 'Swiss Franc' },
  SGD: { symbol: 'S$', name: 'Singapore Dollar' },
}

