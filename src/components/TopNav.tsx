import { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { cloudProvidersAPI, costDataAPI, notificationsAPI } from '../services/api'
import { ProviderIcon, getProviderColor } from './CloudProviderIcons'
import { 
  Cloud,
  Settings,
  User,
  LogOut,
  ChevronDown,
  Search,
  Bell,
  Menu,
  CreditCard,
  Bug,
  X,
  ArrowRight
} from 'lucide-react'
import NotificationDropdown from './NotificationDropdown'

interface CloudAccount {
  id: number
  accountId: number
  providerId: string
  providerName: string
  accountAlias: string
  isActive: boolean
  lastSyncAt: string | null
}

interface TopNavProps {
  onMenuClick?: () => void
}

interface SearchResult {
  type: 'provider' | 'account' | 'service'
  id: string
  name: string
  providerId?: string
  accountId?: number
  accountAlias?: string
  url: string
}

export default function TopNav({ onMenuClick }: TopNavProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout, user, isDemoMode } = useAuth()
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isProviderMenuOpen, setIsProviderMenuOpen] = useState(false)
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [cloudAccounts, setCloudAccounts] = useState<CloudAccount[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1)
  const [allServices, setAllServices] = useState<Array<{ providerId: string; name: string }>>([])
  const [subscriptionStatus, setSubscriptionStatus] = useState<{ planType: string; daysRemaining: number | null } | null>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const providerMenuRef = useRef<HTMLDivElement>(null)
  const notificationRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadCloudAccounts()
    loadAllServices()
    if (!isDemoMode) {
      loadUnreadNotificationCount()
      loadSubscriptionStatus()
      // Poll for new notifications every 60 seconds
      const interval = setInterval(() => {
        loadUnreadNotificationCount()
      }, 60000)
      return () => clearInterval(interval)
    }
  }, [isDemoMode])
  
  const loadSubscriptionStatus = async () => {
    try {
      const { billingAPI } = await import('../services/api')
      const response = await billingAPI.getSubscription()
      setSubscriptionStatus(response.status)
    } catch (error) {
      console.error('Failed to load subscription status:', error)
    }
  }

  const loadUnreadNotificationCount = async () => {
    try {
      const response = await notificationsAPI.getUnreadCount()
      setUnreadNotificationCount(response.count || 0)
    } catch (error) {
      console.error('Failed to load notification count:', error)
    }
  }

  const loadCloudAccounts = async () => {
    try {
      const response = await cloudProvidersAPI.getCloudProviders()
      setCloudAccounts(response.providers || [])
    } catch (error) {
      console.error('Failed to load cloud accounts:', error)
    }
  }

  const loadAllServices = async () => {
    if (isDemoMode) {
      // Mock services for demo mode
      const mockServices = [
        { providerId: 'aws', name: 'EC2 Instances' },
        { providerId: 'aws', name: 'S3 Storage' },
        { providerId: 'aws', name: 'RDS Databases' },
        { providerId: 'aws', name: 'Lambda Functions' },
        { providerId: 'aws', name: 'CloudFront CDN' },
        { providerId: 'azure', name: 'Virtual Machines' },
        { providerId: 'azure', name: 'Blob Storage' },
        { providerId: 'azure', name: 'SQL Database' },
        { providerId: 'azure', name: 'Functions' },
        { providerId: 'azure', name: 'CDN' },
        { providerId: 'gcp', name: 'Compute Engine' },
        { providerId: 'gcp', name: 'Cloud Storage' },
        { providerId: 'gcp', name: 'Cloud SQL' },
        { providerId: 'gcp', name: 'Cloud Functions' },
        { providerId: 'gcp', name: 'Cloud CDN' },
      ]
      setAllServices(mockServices)
      return
    }

    try {
      const providers = ['aws', 'azure', 'gcp', 'digitalocean', 'ibm', 'linode', 'vultr']
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 30)
      
      const servicesPromises = providers.map(async (providerId) => {
        try {
          const response = await costDataAPI.getServicesForDateRange(
            providerId,
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0]
          )
          const services = response.services || []
          return services.map((s: any) => ({
            providerId,
            name: s.name || s.serviceName
          }))
        } catch (error) {
          return []
        }
      })
      
      const allServicesData = await Promise.all(servicesPromises)
      setAllServices(allServicesData.flat())
    } catch (error) {
      console.error('Failed to load services for search:', error)
    }
  }

  // Search functionality
  const performSearch = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      return []
    }

    const query = searchQuery.toLowerCase().trim()
    const results: SearchResult[] = []

    // Search providers
    const providerNames: Record<string, string> = {
      'aws': 'Amazon Web Services',
      'azure': 'Microsoft Azure',
      'gcp': 'Google Cloud Platform',
      'digitalocean': 'DigitalOcean',
      'ibm': 'IBM Cloud',
      'linode': 'Linode',
      'vultr': 'Vultr'
    }

    Object.entries(providerNames).forEach(([providerId, providerName]) => {
      if (providerName.toLowerCase().includes(query) || providerId.toLowerCase().includes(query)) {
        results.push({
          type: 'provider',
          id: providerId,
          name: providerName,
          providerId,
          url: `/provider/${providerId}`
        })
      }
    })

    // Search accounts
    cloudAccounts.forEach(account => {
      const accountName = account.accountAlias || account.providerName
      if (accountName.toLowerCase().includes(query) || 
          account.providerId.toLowerCase().includes(query)) {
        const url = cloudAccounts.filter(a => a.providerId === account.providerId).length === 1
          ? `/provider/${account.providerId}`
          : `/provider/${account.providerId}?account=${account.accountId}`
        
        results.push({
          type: 'account',
          id: `account-${account.accountId}`,
          name: accountName,
          providerId: account.providerId,
          accountId: account.accountId,
          accountAlias: account.accountAlias,
          url
        })
      }
    })

    // Search services
    allServices.forEach(service => {
      if (service.name.toLowerCase().includes(query)) {
        results.push({
          type: 'service',
          id: `service-${service.providerId}-${service.name}`,
          name: service.name,
          providerId: service.providerId,
          url: `/provider/${service.providerId}?service=${encodeURIComponent(service.name)}`
        })
      }
    })

    // Limit results to 10
    return results.slice(0, 10)
  }, [searchQuery, cloudAccounts, allServices])

  useEffect(() => {
    setSearchResults(performSearch)
    setSelectedResultIndex(-1)
  }, [performSearch])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
      if (providerMenuRef.current && !providerMenuRef.current.contains(event.target as Node)) {
        setIsProviderMenuOpen(false)
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false)
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedResultIndex(prev => 
        prev < searchResults.length - 1 ? prev + 1 : prev
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedResultIndex(prev => prev > 0 ? prev - 1 : -1)
    } else if (e.key === 'Enter' && selectedResultIndex >= 0) {
      e.preventDefault()
      const result = searchResults[selectedResultIndex]
      if (result) {
        navigate(result.url)
        setSearchQuery('')
        setIsSearchFocused(false)
        setSelectedResultIndex(-1)
      }
    } else if (e.key === 'Escape') {
      setIsSearchFocused(false)
      setSearchQuery('')
      setSelectedResultIndex(-1)
    }
  }

  const handleResultClick = (result: SearchResult) => {
    navigate(result.url)
    setSearchQuery('')
    setIsSearchFocused(false)
    setSelectedResultIndex(-1)
  }

  const clearSearch = () => {
    setSearchQuery('')
    setIsSearchFocused(false)
    setSelectedResultIndex(-1)
    searchInputRef.current?.focus()
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  // Check if we're on a provider detail page
  const isProviderPage = location.pathname.startsWith('/provider/')

  // Group accounts by provider
  const groupedAccounts = cloudAccounts
    .filter(a => a.isActive)
    .reduce((acc, account) => {
      if (!acc[account.providerId]) {
        acc[account.providerId] = []
      }
      acc[account.providerId].push(account)
      return acc
    }, {} as Record<string, CloudAccount[]>)

  // Sort providers: AWS first, then others
  const sortedProviders = Object.entries(groupedAccounts).sort(([a], [b]) => {
    if (a === 'aws') return -1
    if (b === 'aws') return 1
    return a.localeCompare(b)
  })

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-surface-200 shadow-xs">
      <div className="w-full px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Mobile Menu Button - Minimum 44x44px touch target */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Search Bar - Responsive */}
          <div className="flex-1 max-w-2xl mx-2 sm:mx-4 lg:mx-8" ref={searchRef}>
            <div className="relative">
              <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search providers, accounts, services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onKeyDown={handleSearchKeyDown}
                className="w-full pl-10 sm:pl-12 pr-9 sm:pr-10 py-2 sm:py-2.5 text-sm sm:text-base bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent text-gray-900 placeholder-gray-400"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 rounded min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              
              {/* Search Results Dropdown */}
              {isSearchFocused && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 max-h-96 overflow-y-auto z-50">
                  <div className="py-2">
                    {searchResults.map((result, index) => (
                      <button
                        key={result.id}
                        onClick={() => handleResultClick(result)}
                        onMouseEnter={() => setSelectedResultIndex(index)}
                        className={`
                          w-full px-4 py-3 text-left flex items-center justify-between
                          transition-colors
                          ${selectedResultIndex === index 
                            ? 'bg-accent-50 text-accent-700' 
                            : 'text-gray-700 hover:bg-gray-50'
                          }
                        `}
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          {result.type === 'provider' && (
                            <div 
                              className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                              style={{ backgroundColor: `${getProviderColor(result.providerId || '')}15` }}
                            >
                              <ProviderIcon providerId={result.providerId || ''} size={16} />
                            </div>
                          )}
                          {result.type === 'account' && (
                            <div 
                              className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                              style={{ backgroundColor: `${getProviderColor(result.providerId || '')}15` }}
                            >
                              <ProviderIcon providerId={result.providerId || ''} size={16} />
                            </div>
                          )}
                          {result.type === 'service' && (
                            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 flex-shrink-0">
                              <Cloud className="h-4 w-4 text-gray-600" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{result.name}</div>
                            <div className="text-xs text-gray-500 capitalize">
                              {result.type}
                              {result.type === 'service' && result.providerId && (
                                <> • {result.providerId.toUpperCase()}</>
                              )}
                              {result.type === 'account' && result.accountAlias && (
                                <> • {result.accountAlias}</>
                              )}
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0 ml-2" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* No Results */}
              {isSearchFocused && searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 py-8 z-50">
                  <div className="text-center">
                    <Search className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No results found</p>
                    <p className="text-xs text-gray-400 mt-1">Try searching for providers, accounts, or services</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-3">
            {/* Providers Dropdown - Desktop only */}
            <div className="hidden lg:block relative" ref={providerMenuRef}>
              <button
                onClick={() => setIsProviderMenuOpen(!isProviderMenuOpen)}
                className={`
                  flex items-center space-x-2 px-4 py-2 rounded-lg
                  transition-colors
                  ${isProviderPage 
                    ? 'bg-accent-50 text-accent-700' 
                    : 'text-gray-700 hover:bg-gray-100'
                  }
                `}
              >
                <Cloud className="h-4 w-4" />
                <span className="font-medium">Providers</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${isProviderMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isProviderMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50 max-h-[500px] overflow-y-auto">
                  {sortedProviders.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <Cloud className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No providers configured</p>
                      <Link
                        to="/settings"
                        onClick={() => setIsProviderMenuOpen(false)}
                              className="text-sm text-accent-600 hover:text-accent-700 mt-2 inline-block"
                      >
                        Add Provider →
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {sortedProviders.map(([providerId, accounts]) => (
                        <div key={providerId} className="px-4 py-2">
                          <div className="flex items-center space-x-2 mb-2">
                            <div 
                              className="w-6 h-6 flex items-center justify-center rounded"
                              style={{ backgroundColor: `${getProviderColor(providerId)}15` }}
                            >
                              <ProviderIcon providerId={providerId} size={14} />
                            </div>
                            <span className="text-xs font-semibold text-gray-500 uppercase">
                              {accounts[0].providerName}
                            </span>
                          </div>
                          <div className="ml-8 space-y-0.5">
                            {accounts.map((account) => {
                              const isAccountActive = location.pathname === `/provider/${providerId}` && 
                                (!location.search || location.search.includes(`account=${account.accountId}`))
                              return (
                                <Link
                                  key={account.accountId}
                                  to={accounts.length === 1 
                                    ? `/provider/${providerId}` 
                                    : `/provider/${providerId}?account=${account.accountId}`}
                                  onClick={() => setIsProviderMenuOpen(false)}
                                  className={`
                                    flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm
                                    transition-colors
                                    ${isAccountActive
                                      ? 'bg-accent-50 text-accent-700'
                                      : 'text-gray-600 hover:bg-gray-50'
                                    }
                                  `}
                                >
                                  <div 
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: getProviderColor(providerId) }}
                                  />
                                  <span className="truncate">
                                    {account.accountAlias || accounts[0].providerName}
                                  </span>
                                </Link>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notifications */}
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => {
                  setIsNotificationOpen(!isNotificationOpen)
                  if (!isNotificationOpen) {
                    loadUnreadNotificationCount()
                  }
                }}
                className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Bell className="h-5 w-5" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute top-0 right-0 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-[#DC2626] rounded-full">
                    {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                  </span>
                )}
              </button>
              <NotificationDropdown
                isOpen={isNotificationOpen}
                onClose={() => {
                  setIsNotificationOpen(false)
                  loadUnreadNotificationCount()
                }}
              />
            </div>

            {/* User Menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center space-x-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {user?.avatarUrl ? (
                  <img 
                    src={user.avatarUrl} 
                    alt={user.name || 'User'} 
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center">
                    <User className="h-4 w-4 text-white" />
                  </div>
                )}
                <span className="hidden md:block text-sm font-medium text-gray-700">{user?.name || 'User'}</span>
                <ChevronDown className={`h-4 w-4 text-gray-600 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <p className="text-sm font-semibold text-gray-900">{user?.name || 'User'}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                    {subscriptionStatus && (
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-700 capitalize">
                          {subscriptionStatus.planType} Plan
                        </span>
                        {subscriptionStatus.daysRemaining !== null && subscriptionStatus.planType === 'trial' && (
                          <span className="text-xs text-amber-600 font-medium">
                            {subscriptionStatus.daysRemaining} {subscriptionStatus.daysRemaining === 1 ? 'day' : 'days'} left
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <Link
                    to="/profile"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <User className="h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                  
                  <Link
                    to="/settings"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                  
                  <Link
                    to="/settings/billing"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <CreditCard className="h-4 w-4" />
                    <span>Billing & Subscription</span>
                  </Link>
                  
                  <Link
                    to="/debug"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Bug className="h-4 w-4" />
                    <span>API Debug</span>
                  </Link>
                  
                  <div className="border-t border-gray-200 mt-2 pt-2">
                    <button
                      onClick={handleLogout}
                      className="flex items-center space-x-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
