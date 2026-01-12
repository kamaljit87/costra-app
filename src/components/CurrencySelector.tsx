import { useCurrency } from '../contexts/CurrencyContext'
import { Currency, CURRENCY_INFO } from '../services/currencyService'
import { Globe, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

export default function CurrencySelector() {
  const { selectedCurrency, setSelectedCurrency, isLoading } = useCurrency()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currencies: Currency[] = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CNY', 'AUD', 'CAD', 'CHF', 'SGD']

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
        disabled={isLoading}
      >
        <Globe className="h-4 w-4 text-gray-600" />
        <span className="font-medium text-gray-900">{selectedCurrency}</span>
        <ChevronDown className={`h-4 w-4 text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          <div className="p-2">
            {currencies.map((currency) => (
              <button
                key={currency}
                onClick={() => {
                  setSelectedCurrency(currency)
                  setIsOpen(false)
                }}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  selectedCurrency === currency
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{currency}</div>
                    <div className="text-sm text-gray-500">{CURRENCY_INFO[currency].name}</div>
                  </div>
                  {selectedCurrency === currency && (
                    <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

