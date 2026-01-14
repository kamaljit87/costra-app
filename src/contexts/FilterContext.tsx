import { createContext, useContext, useState, ReactNode } from 'react'

interface FilterContextType {
  // Service filter
  selectedService: string | null
  setSelectedService: (service: string | null) => void
  
  // Credits filter
  showCreditsOnly: boolean
  setShowCreditsOnly: (show: boolean) => void
  
  // Provider/Account filter
  selectedAccountId: number | null
  setSelectedAccountId: (accountId: number | null) => void
  
  // Clear all filters
  clearFilters: () => void
}

const FilterContext = createContext<FilterContextType | undefined>(undefined)

export function FilterProvider({ children }: { children: ReactNode }) {
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [showCreditsOnly, setShowCreditsOnly] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null)

  const clearFilters = () => {
    setSelectedService(null)
    setShowCreditsOnly(false)
    setSelectedAccountId(null)
  }

  return (
    <FilterContext.Provider
      value={{
        selectedService,
        setSelectedService,
        showCreditsOnly,
        setShowCreditsOnly,
        selectedAccountId,
        setSelectedAccountId,
        clearFilters,
      }}
    >
      {children}
    </FilterContext.Provider>
  )
}

export function useFilters() {
  const context = useContext(FilterContext)
  if (context === undefined) {
    throw new Error('useFilters must be used within a FilterProvider')
  }
  return context
}
