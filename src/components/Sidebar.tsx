import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  ChevronDown,
  Sparkles,
  ChevronUp,
  Wallet,
  FileText
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
          ${isPermanent ? 'relative' : 'fixed'} top-0 left-0 h-full bg-[#1F3A5F] z-50
          ${isPermanent ? '' : `transform transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
          ${isPermanent ? 'lg:block' : 'lg:hidden'}
          w-72 flex flex-col
          border-r border-[#1F3A5F]/80
          shadow-xl
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-20 px-6 border-b border-white/10 bg-[#1F3A5F]">
          <Link to="/dashboard" className="flex items-center group">
            <img 
              src="/logo.png" 
              alt="Costra" 
              className="h-16 w-auto transition-all duration-200 group-hover:scale-105"
            />
          </Link>
          {!isPermanent && (
            <button
              onClick={onClose}
              className="lg:hidden text-white/70 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
            >
              ✕
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto dark-scrollbar">
          {/* Dashboard */}
          <Link
            to="/dashboard"
            onClick={onClose}
            className={`
              flex items-center space-x-3 px-4 py-3 rounded-xl
              transition-all duration-200 group relative
              ${isActive('/dashboard')
                ? 'bg-[#22B8A0] text-white shadow-lg shadow-[#22B8A0]/20'
                : 'text-white/80 hover:text-white hover:bg-white/10'
              }
            `}
          >
            <div className={`${isActive('/dashboard') ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <span className="font-semibold text-sm">Dashboard</span>
            {isActive('/dashboard') && (
              <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white"></div>
            )}
          </Link>

          {/* Budgets */}
          <Link
            to="/budgets"
            onClick={onClose}
            className={`
              flex items-center space-x-3 px-4 py-3 rounded-xl
              transition-all duration-200 group relative
              ${isActive('/budgets')
                ? 'bg-[#22B8A0] text-white shadow-lg shadow-[#22B8A0]/20'
                : 'text-white/80 hover:text-white hover:bg-white/10'
              }
            `}
          >
            <div className={`${isActive('/budgets') ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>
              <Wallet className="h-5 w-5" />
            </div>
            <span className="font-semibold text-sm">Budgets</span>
            {isActive('/budgets') && (
              <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white"></div>
            )}
          </Link>

          {/* Reports */}
          <Link
            to="/reports"
            onClick={onClose}
            className={`
              flex items-center space-x-3 px-4 py-3 rounded-xl
              transition-all duration-200 group relative
              ${isActive('/reports')
                ? 'bg-[#22B8A0] text-white shadow-lg shadow-[#22B8A0]/20'
                : 'text-white/80 hover:text-white hover:bg-white/10'
              }
            `}
          >
            <div className={`${isActive('/reports') ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>
              <FileText className="h-5 w-5" />
            </div>
            <span className="font-semibold text-sm">Reports</span>
            {isActive('/reports') && (
              <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white"></div>
            )}
          </Link>

          {/* Cloud Accounts Section */}
          {!isDemoMode && Object.keys(groupedAccounts).length > 0 && (
            <div className="pt-6 mt-6 border-t border-white/10">
              <div className="px-4 pb-3 text-[10px] font-bold text-white/50 uppercase tracking-widest">
                Cloud Providers
              </div>
              
              {Object.entries(groupedAccounts).map(([providerId, accounts]) => (
                <div key={providerId} className="mt-1.5">
                  <button
                    onClick={() => toggleProviderExpand(providerId)}
                    className={`
                      flex items-center space-x-3 px-4 py-3 w-full rounded-xl
                      transition-all duration-200 group
                      ${expandedProviders.has(providerId)
                        ? 'bg-white/15 text-white shadow-md'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                      }
                    `}
                  >
                    <div 
                      className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${
                        expandedProviders.has(providerId)
                          ? 'bg-white/20'
                          : 'bg-white/10 group-hover:bg-white/15'
                      }`}
                    >
                      <ProviderIcon providerId={providerId} size={20} />
                    </div>
                    <span className="flex-1 text-left text-sm font-semibold">
                      {accounts[0].providerName}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-white/15 text-white">
                      {accounts.length}
                    </span>
                    {expandedProviders.has(providerId) ? (
                      <ChevronUp className="h-4 w-4 text-white/70 transition-transform duration-200" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-white/70 transition-transform duration-200" />
                    )}
                  </button>
                  
                  {expandedProviders.has(providerId) && (
                    <div className="ml-4 mt-2 space-y-1 animate-fade-in">
                      {accounts.map((account) => (
                        <Link
                          key={account.accountId}
                          to={`/provider/${providerId}?account=${account.accountId}`}
                          onClick={onClose}
                          className={`
                            flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs
                            transition-all duration-200
                            ${location.search.includes(`account=${account.accountId}`)
                              ? 'bg-[#22B8A0] text-white shadow-md'
                              : account.isActive
                                ? 'text-white/90 hover:text-white hover:bg-white/10'
                                : 'text-white/50 hover:text-white/70 hover:bg-white/5'
                            }
                          `}
                        >
                          <div 
                            className={`w-1.5 h-1.5 rounded-full transition-all ${
                              account.isActive ? 'bg-white' : 'bg-white/40'
                            }`}
                          />
                          <span className="truncate flex-1 font-medium">
                            {account.accountAlias || `Account ${account.accountId}`}
                          </span>
                          {!account.isActive && (
                            <span className="text-[10px] text-white/40">Inactive</span>
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
            <div className="pt-6 mt-6 border-t border-white/10">
              <div className="px-4 pb-3 text-[10px] font-bold text-white/50 uppercase tracking-widest">
                Cloud Providers
              </div>
              <div className="px-4 py-8 text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#22B8A0]/20 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-[#22B8A0]" />
                </div>
                <p className="text-xs text-white/70 mb-4 font-medium">
                  Connect cloud providers to track costs
                </p>
                <Link
                  to="/signup"
                  className="inline-flex items-center px-4 py-2 rounded-xl text-xs text-white bg-[#22B8A0] hover:bg-[#1ea890] font-semibold transition-all duration-200 shadow-lg shadow-[#22B8A0]/20"
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
