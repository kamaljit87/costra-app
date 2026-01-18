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
    <div className="flex flex-wrap items-center gap-3 mb-8 animate-fade-in">
      <div className="flex items-center space-x-2 text-gray-500">
        <Filter className="h-4 w-4" />
        <span className="text-sm font-medium">Filters</span>
      </div>

      {/* Service Filter Dropdown */}
      <div className="relative">
        <button
          onClick={() => setIsServiceDropdownOpen(!isServiceDropdownOpen)}
          className={`
            flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200
            ${selectedService 
              ? 'bg-frozenWater-50 border-2 border-frozenWater-200 text-frozenWater-700' 
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
            }
          `}
        >
          <Layers className="h-4 w-4" />
          <span>{selectedService || 'All Services'}</span>
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isServiceDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {isServiceDropdownOpen && (
          <>
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setIsServiceDropdownOpen(false)}
            />
            <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-gray-200 rounded-2xl shadow-xl z-20 max-h-80 overflow-hidden animate-fade-in">
              <div className="p-2 max-h-72 overflow-y-auto">
                <button
                  onClick={() => {
                    setSelectedService(null)
                    setIsServiceDropdownOpen(false)
                  }}
                  className={`
                    w-full px-4 py-2.5 text-left text-sm rounded-xl transition-colors
                    ${selectedService === null 
                      ? 'bg-frozenWater-50 text-frozenWater-700 font-medium' 
                      : 'text-gray-700 hover:bg-gray-50'
                    }
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
                      w-full px-4 py-2.5 text-left text-sm rounded-xl truncate transition-colors
                      ${selectedService === service 
                        ? 'bg-frozenWater-50 text-frozenWater-700 font-medium' 
                        : 'text-gray-700 hover:bg-gray-50'
                      }
                    `}
                  >
                    {service}
                  </button>
                ))}
                {uniqueServices.length === 0 && (
                  <div className="px-4 py-6 text-sm text-gray-500 text-center">
                    No services available
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Credits Filter Toggle */}
      {hasCredits && (
        <button
          onClick={() => setShowCreditsOnly(!showCreditsOnly)}
          className={`
            flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200
            ${showCreditsOnly 
              ? 'bg-emerald-50 border-2 border-emerald-200 text-emerald-700' 
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
            }
          `}
        >
          <CreditCard className="h-4 w-4" />
          <span>Credits</span>
          {showCreditsOnly && (
            <span className="ml-1 w-2 h-2 rounded-full bg-emerald-500" />
          )}
        </button>
      )}

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <X className="h-4 w-4" />
          <span>Clear all</span>
        </button>
      )}

      {/* Active Filter Tags */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 ml-2 pl-3 border-l border-gray-200">
          {selectedService && (
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-frozenWater-100 text-frozenWater-700">
              {selectedService}
              <button 
                onClick={() => setSelectedService(null)}
                className="ml-2 hover:text-frozenWater-900"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {showCreditsOnly && (
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
              With Credits
              <button 
                onClick={() => setShowCreditsOnly(false)}
                className="ml-2 hover:text-emerald-900"
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
