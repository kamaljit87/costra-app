import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  ChevronDown,
  Sparkles,
  ChevronUp
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { cloudProvidersAPI } from '../services/api'
import { ProviderIcon } from './CloudProviderIcons'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  isPermanent?: boolean
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

export default function Sidebar({ isOpen, onClose, isPermanent = false }: SidebarProps) {
  const location = useLocation()
  const { isDemoMode } = useAuth()
  const [cloudAccounts, setCloudAccounts] = useState<CloudAccount[]>([])
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!isDemoMode) {
      loadCloudAccounts()
    }
  }, [isDemoMode])


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


  const isActive = (path: string) => location.pathname === path

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
    .reduce((acc, account) => {
      if (!acc[account.providerId]) {
        acc[account.providerId] = []
      }
      acc[account.providerId].push(account)
      return acc
    }, {} as Record<string, CloudAccount[]>)


  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar - Permanent on desktop, drawer on mobile */}
      <aside
        className={`
          ${isPermanent ? 'relative' : 'fixed'} top-0 left-0 h-full bg-frozenWater-800 z-50
          ${isPermanent ? '' : `transform transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
          ${isPermanent ? 'lg:block' : 'lg:hidden'}
          w-64 flex flex-col
          border-r border-frozenWater-600/30
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-frozenWater-600/30 bg-white">
          <Link to="/dashboard" className="flex items-center space-x-3">
            <img 
              src="/logo.png" 
              alt="Costra" 
              className="h-16 w-auto"
            />
          </Link>
          {!isPermanent && (
            <button
              onClick={onClose}
              className="lg:hidden text-white/80 hover:text-white transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto dark-scrollbar">
          {/* Dashboard */}
          <Link
            to="/dashboard"
            onClick={onClose}
            className={`
              flex items-center space-x-3 px-4 py-3 rounded-lg
              transition-all duration-200 group
                        ${isActive('/dashboard')
                          ? 'bg-frozenWater-600 text-white'
                          : 'text-frozenWater-100 hover:text-white hover:bg-frozenWater-700/60'
                        }
            `}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span className="font-medium">Dashboard</span>
          </Link>

          {/* Cloud Accounts Section */}
          {!isDemoMode && Object.keys(groupedAccounts).length > 0 && (
            <div className="pt-6">
              <div className="px-4 pb-2 text-xs font-semibold text-frozenWater-300 uppercase tracking-wider">
                Cloud Providers
              </div>
              
              {Object.entries(groupedAccounts).map(([providerId, accounts]) => (
                <div key={providerId} className="mt-1">
                  <button
                    onClick={() => toggleProviderExpand(providerId)}
                    className={`
                      flex items-center space-x-3 px-4 py-2.5 w-full rounded-lg
                      transition-all duration-200 group
                      ${expandedProviders.has(providerId)
                        ? 'bg-frozenWater-600 text-white'
                        : 'text-frozenWater-100 hover:text-white hover:bg-frozenWater-700/60'
                      }
                    `}
                  >
                    <div 
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10"
                    >
                      <ProviderIcon providerId={providerId} size={18} />
                    </div>
                    <span className="flex-1 text-left text-sm font-medium">
                      {accounts[0].providerName}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white">
                      {accounts.length}
                    </span>
                    {expandedProviders.has(providerId) ? (
                      <ChevronUp className="h-4 w-4 text-white transition-transform duration-200" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-white transition-transform duration-200" />
                    )}
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
                              ? 'bg-frozenWater-600 text-white'
                              : account.isActive
                                ? 'text-frozenWater-100 hover:text-white hover:bg-frozenWater-700/60'
                                : 'text-frozenWater-200/60 hover:text-frozenWater-100 hover:bg-frozenWater-700/40'
                            }
                          `}
                        >
                          <div 
                            className={`w-2 h-2 rounded-full ${
                              account.isActive ? 'bg-white' : 'bg-white/40'
                            }`}
                          />
                          <span className="truncate flex-1">
                            {account.accountAlias || `Account ${account.accountId}`}
                          </span>
                          {!account.isActive && (
                            <span className="text-xs text-white/50">(Inactive)</span>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Demo Mode Placeholder */}
          {isDemoMode && (
            <div className="pt-6">
              <div className="px-4 pb-2 text-xs font-semibold text-frozenWater-300 uppercase tracking-wider">
                Cloud Providers
              </div>
              <div className="px-4 py-6 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-white/10 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <p className="text-xs text-frozenWater-100 mb-3">
                  Connect cloud providers to track costs
                </p>
                <Link
                  to="/signup"
                  className="inline-flex items-center text-xs text-white hover:text-white/80 font-medium transition-colors"
                >
                  Get started →
                </Link>
              </div>
            </div>
          )}
          
        </nav>

      </aside>
    </>
  )
}
