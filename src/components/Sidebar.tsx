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
  ChevronRight,
  Sparkles
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

  const isActive = (path: string) => location.pathname === path
  const isProviderActive = (providerId: string) => location.pathname === `/provider/${providerId}`

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
    { label: 'Profile', icon: User, path: '/profile', tooltip: 'Manage your account profile' },
    { label: 'Billing', icon: CreditCard, path: '/settings#billing', tooltip: 'View billing and invoices' },
    { label: 'API Debug', icon: Bug, path: '/debug', tooltip: 'Test API endpoints' },
    { label: 'Settings', icon: Settings, path: '/settings', tooltip: 'Configure app preferences' },
  ]

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar - Hidden on desktop when TopNav is shown, only for mobile */}
      <aside
        className={`
          fixed top-0 left-0 h-full bg-sidebar-bg z-50
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:hidden
          w-72 flex flex-col
          border-r border-sidebar-border/50
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-sidebar-border/50">
          <Link to="/dashboard" className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Costra</span>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden text-sidebar-text hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto dark-scrollbar">
          {/* Dashboard */}
          <Link
            to="/dashboard"
            onClick={onClose}
            className={`
              flex items-center space-x-3 px-4 py-3 rounded-xl
              transition-all duration-200 group
              ${isActive('/dashboard')
                ? 'bg-primary-500/10 text-primary-400'
                : 'text-sidebar-text hover:text-white hover:bg-sidebar-hover'
              }
            `}
          >
            <LayoutDashboard className={`h-5 w-5 ${isActive('/dashboard') ? 'text-primary-400' : 'text-sidebar-text group-hover:text-white'}`} />
            <span className="font-medium">Dashboard</span>
            {isActive('/dashboard') && (
              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-400" />
            )}
          </Link>

          {/* Cloud Accounts Section */}
          {!isDemoMode && Object.keys(groupedAccounts).length > 0 && (
            <div className="pt-6">
              <div className="px-4 pb-2 text-xs font-semibold text-sidebar-text/60 uppercase tracking-wider">
                Cloud Accounts
              </div>
              
              {Object.entries(groupedAccounts).map(([providerId, accounts]) => (
                <div key={providerId} className="mt-1">
                  {accounts.length === 1 ? (
                    <Link
                      to={`/provider/${providerId}`}
                      onClick={onClose}
                      className={`
                        flex items-center space-x-3 px-4 py-2.5 rounded-xl
                        transition-all duration-200 group
                        ${isProviderActive(providerId)
                          ? 'bg-primary-500/10 text-primary-400'
                          : 'text-sidebar-text hover:text-white hover:bg-sidebar-hover'
                        }
                      `}
                    >
                      <div 
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition-transform group-hover:scale-105"
                        style={{ backgroundColor: `${getProviderColor(providerId)}20` }}
                      >
                        <ProviderIcon providerId={providerId} size={18} />
                      </div>
                      <span className="flex-1 truncate text-sm font-medium">
                        {accounts[0].accountAlias || accounts[0].providerName}
                      </span>
                      {isProviderActive(providerId) && (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary-400" />
                      )}
                    </Link>
                  ) : (
                    <>
                      <button
                        onClick={() => toggleProviderExpand(providerId)}
                        className="flex items-center space-x-3 px-4 py-2.5 w-full rounded-xl text-sidebar-text hover:text-white hover:bg-sidebar-hover transition-all duration-200 group"
                      >
                        <div 
                          className="w-8 h-8 flex items-center justify-center rounded-lg transition-transform group-hover:scale-105"
                          style={{ backgroundColor: `${getProviderColor(providerId)}20` }}
                        >
                          <ProviderIcon providerId={providerId} size={18} />
                        </div>
                        <span className="flex-1 text-left text-sm font-medium">
                          {accounts[0].providerName}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-sidebar-hover text-sidebar-text">
                          {accounts.length}
                        </span>
                        <ChevronRight 
                          className={`h-4 w-4 text-sidebar-text transition-transform duration-200 ${
                            expandedProviders.has(providerId) ? 'rotate-90' : ''
                          }`}
                        />
                      </button>
                      
                      {expandedProviders.has(providerId) && (
                        <div className="ml-6 mt-1 space-y-0.5 animate-fade-in">
                          {accounts.map((account) => (
                            <Link
                              key={account.accountId}
                              to={`/provider/${providerId}?account=${account.accountId}`}
                              onClick={onClose}
                              className={`
                                flex items-center space-x-2 px-4 py-2 rounded-lg text-sm
                                transition-all duration-200
                                ${location.search.includes(`account=${account.accountId}`)
                                  ? 'bg-primary-500/10 text-primary-400'
                                  : 'text-sidebar-text hover:text-white hover:bg-sidebar-hover'
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
            <div className="pt-6">
              <div className="px-4 pb-2 text-xs font-semibold text-sidebar-text/60 uppercase tracking-wider">
                Cloud Accounts
              </div>
              <div className="px-4 py-6 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-sidebar-hover flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-sidebar-text" />
                </div>
                <p className="text-xs text-sidebar-text mb-3">
                  Connect cloud providers to track costs
                </p>
                <Link
                  to="/signup"
                  className="inline-flex items-center text-xs text-primary-400 hover:text-primary-300 font-medium transition-colors"
                >
                  Get started →
                </Link>
              </div>
            </div>
          )}
        </nav>

        {/* User Menu */}
        {user && (
          <div className="border-t border-sidebar-border/50" ref={userMenuRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="w-full px-4 py-3 flex items-center space-x-3 hover:bg-sidebar-hover transition-colors"
              title="Click to access account settings"
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-9 h-9 rounded-xl object-cover ring-2 ring-sidebar-border"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-white truncate">
                  {user.name}
                </p>
                <p className="text-xs text-sidebar-text truncate">{user.email}</p>
              </div>
              <ChevronDown 
                className={`h-4 w-4 text-sidebar-text transition-transform duration-200 ${
                  isUserMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <div className="border-t border-sidebar-border/50 bg-sidebar-hover/50 animate-fade-in">
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
                      title={item.tooltip}
                      className={`
                        flex items-center space-x-3 px-4 py-3
                        text-sm text-sidebar-text hover:text-white hover:bg-sidebar-hover transition-colors
                        ${isActive(item.path.split('#')[0]) ? 'text-white bg-sidebar-hover' : ''}
                      `}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Logout Button - Always visible at the very bottom */}
        <div className="px-3 py-3 border-t border-sidebar-border/50">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 text-sm text-red-400 hover:text-white hover:bg-red-500/20 rounded-xl transition-all duration-200 border border-red-500/20 hover:border-red-500/40"
            title="Sign out of your account"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  )
}
