import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  LayoutDashboard, 
  LogOut, 
  ChevronDown,
  Settings,
  Bug,
  User,
  CreditCard,
  ChevronRight
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { cloudProvidersAPI } from '../services/api'
import { ProviderIcon, getProviderColor } from './CloudProviderIcons'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

interface CloudAccount {
  id: number
  accountId: number
  providerId: string
  providerName: string
  accountAlias: string
  isActive: boolean
  lastSyncAt: string | null
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout, user, isDemoMode } = useAuth()
  const [cloudAccounts, setCloudAccounts] = useState<CloudAccount[]>([])
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set())
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isDemoMode) {
      loadCloudAccounts()
    }
  }, [isDemoMode])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadCloudAccounts = async () => {
    try {
      const response = await cloudProvidersAPI.getCloudProviders()
      setCloudAccounts(response.providers || [])
      // Auto-expand if there are accounts
      if (response.providers && response.providers.length > 0) {
        const providerIds = new Set<string>(response.providers.map((p: CloudAccount) => p.providerId))
        setExpandedProviders(providerIds)
      }
    } catch (error) {
      console.error('Failed to load cloud accounts:', error)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const isActive = (path: string) => {
    return location.pathname === path
  }

  const isProviderActive = (providerId: string) => {
    return location.pathname === `/provider/${providerId}`
  }

  const toggleProviderExpand = (providerId: string) => {
    setExpandedProviders(prev => {
      const next = new Set(prev)
      if (next.has(providerId)) {
        next.delete(providerId)
      } else {
        next.add(providerId)
      }
      return next
    })
  }

  // Group accounts by provider type
  const groupedAccounts = cloudAccounts
    .filter(a => a.isActive)
    .reduce((acc, account) => {
      if (!acc[account.providerId]) {
        acc[account.providerId] = []
      }
      acc[account.providerId].push(account)
      return acc
    }, {} as Record<string, CloudAccount[]>)

  const userMenuItems = [
    { label: 'Settings', icon: Settings, path: '/settings' },
    { label: 'API Debug', icon: Bug, path: '/debug' },
    { label: 'Profile', icon: User, path: '/settings#profile' },
    { label: 'Billing', icon: CreditCard, path: '/settings#billing' },
  ]

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full bg-white border-r border-gray-200 z-50
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-auto
          w-64
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <Link to="/dashboard" className="text-xl font-bold text-primary-600">Costra</Link>
            <button
              onClick={onClose}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {/* Dashboard */}
            <Link
              to="/dashboard"
              onClick={onClose}
              className={`
                flex items-center space-x-3 px-3 py-2.5 rounded-lg
                transition-colors duration-200
                ${
                  isActive('/dashboard')
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }
              `}
            >
              <LayoutDashboard className="h-5 w-5" />
              <span>Dashboard</span>
            </Link>

            {/* Cloud Accounts Section */}
            {!isDemoMode && Object.keys(groupedAccounts).length > 0 && (
              <div className="pt-4">
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Cloud Accounts
                </div>
                
                {Object.entries(groupedAccounts).map(([providerId, accounts]) => (
                  <div key={providerId} className="mt-1">
                    {accounts.length === 1 ? (
                      // Single account - direct link
                      <Link
                        to={`/provider/${providerId}`}
                        onClick={onClose}
                        className={`
                          flex items-center space-x-3 px-3 py-2 rounded-lg
                          transition-colors duration-200
                          ${
                            isProviderActive(providerId)
                              ? 'bg-primary-50 text-primary-700 font-medium'
                              : 'text-gray-700 hover:bg-gray-50'
                          }
                        `}
                      >
                        <div 
                          className="w-6 h-6 flex items-center justify-center rounded"
                          style={{ backgroundColor: `${getProviderColor(providerId)}15` }}
                        >
                          <ProviderIcon providerId={providerId} size={16} />
                        </div>
                        <span className="flex-1 truncate text-sm">
                          {accounts[0].accountAlias || accounts[0].providerName}
                        </span>
                      </Link>
                    ) : (
                      // Multiple accounts - expandable
                      <>
                        <button
                          onClick={() => toggleProviderExpand(providerId)}
                          className="flex items-center space-x-3 px-3 py-2 w-full rounded-lg text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                        >
                          <div 
                            className="w-6 h-6 flex items-center justify-center rounded"
                            style={{ backgroundColor: `${getProviderColor(providerId)}15` }}
                          >
                            <ProviderIcon providerId={providerId} size={16} />
                          </div>
                          <span className="flex-1 text-left text-sm font-medium">
                            {accounts[0].providerName}
                          </span>
                          <span className="text-xs text-gray-500">{accounts.length}</span>
                          <ChevronRight 
                            className={`h-4 w-4 text-gray-400 transition-transform ${
                              expandedProviders.has(providerId) ? 'rotate-90' : ''
                            }`}
                          />
                        </button>
                        
                        {expandedProviders.has(providerId) && (
                          <div className="ml-6 mt-1 space-y-1">
                            {accounts.map((account) => (
                              <Link
                                key={account.accountId}
                                to={`/provider/${providerId}?account=${account.accountId}`}
                                onClick={onClose}
                                className={`
                                  flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm
                                  transition-colors duration-200
                                  ${
                                    location.search.includes(`account=${account.accountId}`)
                                      ? 'bg-primary-50 text-primary-700 font-medium'
                                      : 'text-gray-600 hover:bg-gray-50'
                                  }
                                `}
                              >
                                <div 
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: getProviderColor(providerId) }}
                                />
                                <span className="truncate">
                                  {account.accountAlias || `Account ${account.accountId}`}
                                </span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Demo Mode Placeholder */}
            {isDemoMode && (
              <div className="pt-4">
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Cloud Accounts
                </div>
                <div className="px-3 py-4 text-center">
                  <p className="text-xs text-gray-500 mb-2">
                    Connect your cloud providers to see accounts here
                  </p>
                  <Link
                    to="/signup"
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Sign up to get started →
                  </Link>
                </div>
              </div>
            )}
          </nav>

          {/* User Menu */}
          {user && (
            <div className="border-t border-gray-200" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="w-full px-4 py-3 flex items-center space-x-3 hover:bg-gray-50 transition-colors"
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-600 font-semibold text-sm">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
                <ChevronDown 
                  className={`h-4 w-4 text-gray-400 transition-transform ${
                    isUserMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Dropdown Menu */}
              {isUserMenuOpen && (
                <div className="border-t border-gray-100 bg-gray-50">
                  {userMenuItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => {
                          setIsUserMenuOpen(false)
                          onClose()
                        }}
                        className={`
                          flex items-center space-x-3 px-4 py-2.5
                          text-sm text-gray-700 hover:bg-gray-100 transition-colors
                          ${isActive(item.path.split('#')[0]) ? 'bg-gray-100 font-medium' : ''}
                        `}
                      >
                        <Icon className="h-4 w-4 text-gray-500" />
                        <span>{item.label}</span>
                      </Link>
                    )
                  })}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
