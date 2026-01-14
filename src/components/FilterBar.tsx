import { useState } from 'react'
import { Filter, X, CreditCard, Layers, ChevronDown } from 'lucide-react'
import { useFilters } from '../contexts/FilterContext'

interface FilterBarProps {
  services: string[]
  hasCredits: boolean
}

export default function FilterBar({ services, hasCredits }: FilterBarProps) {
  const { 
    selectedService, 
    setSelectedService, 
    showCreditsOnly, 
    setShowCreditsOnly,
    clearFilters 
  } = useFilters()
  
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false)

  const hasActiveFilters = selectedService !== null || showCreditsOnly

  const uniqueServices = [...new Set(services)].sort()

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <div className="flex items-center text-sm text-gray-600">
        <Filter className="h-4 w-4 mr-2" />
        <span>Filters:</span>
      </div>

      {/* Service Filter Dropdown */}
      <div className="relative">
        <button
          onClick={() => setIsServiceDropdownOpen(!isServiceDropdownOpen)}
          className={`
            flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm border transition-colors
            ${selectedService 
              ? 'bg-primary-50 border-primary-200 text-primary-700' 
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }
          `}
        >
          <Layers className="h-4 w-4" />
          <span>{selectedService || 'All Services'}</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${isServiceDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {isServiceDropdownOpen && (
          <>
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setIsServiceDropdownOpen(false)}
            />
            <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
              <button
                onClick={() => {
                  setSelectedService(null)
                  setIsServiceDropdownOpen(false)
                }}
                className={`
                  w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors
                  ${selectedService === null ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700'}
                `}
              >
                All Services
              </button>
              {uniqueServices.map((service) => (
                <button
                  key={service}
                  onClick={() => {
                    setSelectedService(service)
                    setIsServiceDropdownOpen(false)
                  }}
                  className={`
                    w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors truncate
                    ${selectedService === service ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700'}
                  `}
                >
                  {service}
                </button>
              ))}
              {uniqueServices.length === 0 && (
                <div className="px-4 py-3 text-sm text-gray-500 text-center">
                  No services available
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Credits Filter Toggle */}
      {hasCredits && (
        <button
          onClick={() => setShowCreditsOnly(!showCreditsOnly)}
          className={`
            flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm border transition-colors
            ${showCreditsOnly 
              ? 'bg-green-50 border-green-200 text-green-700' 
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }
          `}
        >
          <CreditCard className="h-4 w-4" />
          <span>Credits</span>
          {showCreditsOnly && (
            <span className="ml-1 bg-green-200 text-green-800 text-xs px-1.5 py-0.5 rounded">ON</span>
          )}
        </button>
      )}

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="flex items-center space-x-1 px-2 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <X className="h-4 w-4" />
          <span>Clear</span>
        </button>
      )}

      {/* Active Filter Badges */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200">
          {selectedService && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary-100 text-primary-700">
              Service: {selectedService}
              <button 
                onClick={() => setSelectedService(null)}
                className="ml-1 hover:text-primary-900"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {showCreditsOnly && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
              Credits Only
              <button 
                onClick={() => setShowCreditsOnly(false)}
                className="ml-1 hover:text-green-900"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
