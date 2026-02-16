import { useState, useEffect } from 'react'
import { Filter, X, CreditCard, Layers, ChevronDown, Bookmark, Trash2 } from 'lucide-react'
import { useFilters } from '../contexts/FilterContext'
import { useAuth } from '../contexts/AuthContext'
import { savedViewsAPI } from '../services/api'

interface SavedView {
  id: number
  name: string
  filters: { selectedService?: string | null; showCreditsOnly?: boolean; selectedAccountId?: number | null }
  created_at: string
}

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
    selectedAccountId,
    setSelectedAccountId,
    clearFilters,
  } = useFilters()
  const { isAuthenticated } = useAuth()
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false)
  const [isSavedViewsOpen, setIsSavedViewsOpen] = useState(false)
  const [savedViews, setSavedViews] = useState<SavedView[]>([])
  const [savedViewsLoading, setSavedViewsLoading] = useState(false)
  const [saveViewLoading, setSaveViewLoading] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) return
    setSavedViewsLoading(true)
    savedViewsAPI.getList().then(setSavedViews).catch(() => setSavedViews([])).finally(() => setSavedViewsLoading(false))
  }, [isAuthenticated])

  const currentFilters = () => ({
    selectedService: selectedService ?? null,
    showCreditsOnly,
    selectedAccountId: selectedAccountId ?? null,
  })

  const handleLoadView = (view: SavedView) => {
    const f = view.filters || {}
    setSelectedService(f.selectedService ?? null)
    setShowCreditsOnly(!!f.showCreditsOnly)
    setSelectedAccountId(f.selectedAccountId ?? null)
    setIsSavedViewsOpen(false)
  }

  const handleSaveView = async () => {
    const name = window.prompt('Name this view')
    if (!name?.trim()) return
    setSaveViewLoading(true)
    try {
      const created = await savedViewsAPI.create(name.trim(), currentFilters())
      setSavedViews((prev) => [{ ...created, created_at: created.created_at || new Date().toISOString() }, ...prev])
      setIsSavedViewsOpen(false)
    } catch (_) {
      // ignore
    } finally {
      setSaveViewLoading(false)
    }
  }

  const handleDeleteView = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    try {
      await savedViewsAPI.delete(id)
      setSavedViews((prev) => prev.filter((v) => v.id !== id))
    } catch (_) { /* ignore */ }
  }

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
              ? 'bg-accent-50 border-2 border-accent-200 text-accent-700' 
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
                      ? 'bg-accent-50 text-accent-700 font-medium' 
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
                        ? 'bg-accent-50 text-accent-700 font-medium' 
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

      {/* Saved views (authenticated users only) */}
      {isAuthenticated && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsSavedViewsOpen(!isSavedViewsOpen)}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
          >
            <Bookmark className="h-4 w-4" />
            <span>Saved views</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${isSavedViewsOpen ? 'rotate-180' : ''}`} />
          </button>
          {isSavedViewsOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsSavedViewsOpen(false)} />
              <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl z-20 py-2 animate-fade-in">
                {savedViewsLoading ? (
                  <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-300">Loading…</div>
                ) : savedViews.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-300">No saved views</div>
                ) : (
                  <div className="max-h-56 overflow-y-auto">
                    {savedViews.map((view) => (
                      <div
                        key={view.id}
                        className="flex items-center group px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer"
                        onClick={() => handleLoadView(view)}
                      >
                        <span className="flex-1 truncate text-sm text-gray-700 dark:text-gray-200">{view.name}</span>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteView(e, view.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                          aria-label="Delete view"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2 px-2">
                  <button
                    type="button"
                    disabled={saveViewLoading}
                    onClick={handleSaveView}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-accent-700 dark:text-accent-300 hover:bg-accent-50 dark:hover:bg-accent-900/30"
                  >
                    <Bookmark className="h-4 w-4" />
                    {saveViewLoading ? 'Saving…' : 'Save current view'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
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
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-accent-100 text-accent-700">
              {selectedService}
              <button 
                onClick={() => setSelectedService(null)}
                className="ml-2 hover:text-accent-900"
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
