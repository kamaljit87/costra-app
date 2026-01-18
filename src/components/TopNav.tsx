import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { cloudProvidersAPI } from '../services/api'
import { ProviderIcon, getProviderColor } from './CloudProviderIcons'
import { 
  LayoutDashboard,
  Cloud,
  Settings,
  User,
  LogOut,
  ChevronDown
} from 'lucide-react'

interface CloudAccount {
  id: number
  accountId: number
  providerId: string
  providerName: string
  accountAlias: string
  isActive: boolean
  lastSyncAt: string | null
}

export default function TopNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout, user, isDemoMode } = useAuth()
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isProviderMenuOpen, setIsProviderMenuOpen] = useState(false)
  const [cloudAccounts, setCloudAccounts] = useState<CloudAccount[]>([])
  const userMenuRef = useRef<HTMLDivElement>(null)
  const providerMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isDemoMode) {
      loadCloudAccounts()
    }
  }, [isDemoMode])

  const loadCloudAccounts = async () => {
    try {
      const response = await cloudProvidersAPI.getCloudProviders()
      setCloudAccounts(response.providers || [])
    } catch (error) {
      console.error('Failed to load cloud accounts:', error)
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
      if (providerMenuRef.current && !providerMenuRef.current.contains(event.target as Node)) {
        setIsProviderMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard'
    }
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/dashboard', label: 'Providers', icon: Cloud, isProvider: true },
  ]

  // Check if we're on a provider detail page to show "Analytics" as active
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
    <header className="sticky top-0 z-50 bg-gray-800 border-b border-gray-700">
      <div className="w-full max-w-[1920px] mx-auto px-6 lg:px-12 xl:px-16">
        <div className="flex items-center justify-between h-16">
          {/* Logo and App Name */}
          <div className="flex items-center space-x-4">
            <Link 
              to="/dashboard" 
              className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                <Cloud className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Costra</span>
            </Link>
          </div>

          {/* Navigation Items */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon
              
              // Special handling for Providers - dropdown menu with all providers
              if (item.isProvider) {
                const active = isProviderPage
                return (
                  <div key={item.label} className="relative" ref={providerMenuRef}>
                    <button
                      onClick={() => setIsProviderMenuOpen(!isProviderMenuOpen)}
                      className={`
                        flex items-center space-x-2 px-4 py-2 rounded-lg
                        transition-colors relative
                        ${active 
                          ? 'text-white bg-gray-700' 
                          : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                        }
                      `}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="font-medium">{item.label}</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${isProviderMenuOpen ? 'rotate-180' : ''}`} />
                      {active && (
                        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-12 h-0.5 bg-primary-400 rounded-full" />
                      )}
                    </button>

                    {isProviderMenuOpen && (
                      <div className="absolute left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50 max-h-[500px] overflow-y-auto">
                        {sortedProviders.length === 0 ? (
                          <div className="px-4 py-8 text-center">
                            <Cloud className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">No providers configured</p>
                            <Link
                              to="/settings"
                              onClick={() => setIsProviderMenuOpen(false)}
                              className="text-sm text-primary-600 hover:text-primary-700 mt-2 inline-block"
                            >
                              Add Provider →
                            </Link>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {sortedProviders.map(([providerId, accounts]) => {
                              // Always show provider name as parent, then accounts underneath
                              return (
                                <div key={providerId} className="px-4 py-2">
                                  {/* Provider Name Header */}
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
                                  
                                  {/* Accounts List */}
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
                                              ? 'bg-primary-50 text-primary-700'
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
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              }

              const active = isActive(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    flex items-center space-x-2 px-4 py-2 rounded-lg
                    transition-colors relative
                    ${active 
                      ? 'text-white bg-gray-700' 
                      : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  <span className="font-medium">{item.label}</span>
                  {active && (
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-12 h-0.5 bg-primary-400 rounded-full" />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-3">
            {/* User Menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700/50 transition-colors"
              >
                {user?.avatarUrl ? (
                  <img 
                    src={user.avatarUrl} 
                    alt={user.name || 'User'} 
                    className="w-7 h-7 rounded-full"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-primary-500 flex items-center justify-center">
                    <User className="h-4 w-4 text-white" />
                  </div>
                )}
                <ChevronDown className={`h-4 w-4 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <p className="text-sm font-semibold text-gray-900">{user?.name || 'User'}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
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
