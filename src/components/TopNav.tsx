import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { cloudProvidersAPI } from '../services/api'
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
  Bug
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

interface TopNavProps {
  onMenuClick?: () => void
}

export default function TopNav({ onMenuClick }: TopNavProps) {
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
    <header className="sticky top-0 z-40 bg-white border-b border-gray-300 shadow-sm">
      <div className="w-full px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Mobile Menu Button */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Search Bar - Prominent */}
          <div className="flex-1 max-w-2xl mx-4 lg:mx-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-frozenWater-500 focus:border-transparent text-gray-900 placeholder-gray-400"
              />
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
                    ? 'bg-frozenWater-50 text-frozenWater-700' 
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
                              className="text-sm text-frozenWater-600 hover:text-frozenWater-700 mt-2 inline-block"
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
                                      ? 'bg-frozenWater-50 text-frozenWater-700'
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
            <button className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

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
                  <div className="w-8 h-8 rounded-full bg-frozenWater-500 flex items-center justify-center">
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
                    to="/settings#billing"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <CreditCard className="h-4 w-4" />
                    <span>Billing</span>
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
