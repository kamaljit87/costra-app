import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  ChevronDown,
  Sparkles,
  ChevronUp,
  Wallet,
  FileText,
  ArrowLeftRight,
  MessageCircle,
  X
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { usePublicConfig } from '../contexts/PublicConfigContext'
import { cloudProvidersAPI } from '../services/api'
import { ProviderIcon } from './CloudProviderIcons'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  isPermanent?: boolean
  onContactClick?: () => void
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

export default function Sidebar({ isOpen, onClose, isPermanent = false, onContactClick }: SidebarProps) {
  const location = useLocation()
  const { isDemoMode } = useAuth()
  const { signupDisabled } = usePublicConfig()
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

      {/* Sidebar */}
      <aside
        className={`
          ${isPermanent ? 'relative' : 'fixed'} top-0 left-0 h-screen z-50
          bg-white border-r border-surface-300
          ${isPermanent ? '' : `transform transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
          ${isPermanent ? 'lg:block' : 'lg:hidden'}
          w-72 flex flex-col
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-20 px-6 border-b border-surface-300">
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
              className="lg:hidden text-gray-400 hover:text-gray-900 transition-colors p-2 rounded-lg hover:bg-surface-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 pb-20 space-y-1 overflow-y-auto">
          {/* Dashboard */}
          <Link
            to="/dashboard"
            onClick={onClose}
            className={`
              flex items-center space-x-3 px-4 py-3 rounded-lg
              transition-colors duration-150 group relative
              ${isActive('/dashboard')
                ? 'bg-accent-50 text-accent-600 font-semibold border-l-[3px] border-accent-500'
                : 'text-gray-500 hover:text-gray-900 hover:bg-surface-200'
              }
            `}
          >
            <div className={`${isActive('/dashboard') ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <span className="text-sm">Dashboard</span>
          </Link>

          {/* Budgets */}
          <Link
            to="/budgets"
            onClick={onClose}
            className={`
              flex items-center space-x-3 px-4 py-3 rounded-lg
              transition-colors duration-150 group relative
              ${isActive('/budgets')
                ? 'bg-accent-50 text-accent-600 font-semibold border-l-[3px] border-accent-500'
                : 'text-gray-500 hover:text-gray-900 hover:bg-surface-200'
              }
            `}
          >
            <div className={`${isActive('/budgets') ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>
              <Wallet className="h-5 w-5" />
            </div>
            <span className="text-sm">Budgets</span>
          </Link>

          {/* Reports */}
          <Link
            to="/reports"
            onClick={onClose}
            className={`
              flex items-center space-x-3 px-4 py-3 rounded-lg
              transition-colors duration-150 group relative
              ${isActive('/reports')
                ? 'bg-accent-50 text-accent-600 font-semibold border-l-[3px] border-accent-500'
                : 'text-gray-500 hover:text-gray-900 hover:bg-surface-200'
              }
            `}
          >
            <div className={`${isActive('/reports') ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>
              <FileText className="h-5 w-5" />
            </div>
            <span className="text-sm">Reports</span>
          </Link>

          {/* Compare */}
          <Link
            to="/compare"
            onClick={onClose}
            className={`
              flex items-center space-x-3 px-4 py-3 rounded-lg
              transition-colors duration-150 group relative
              ${isActive('/compare')
                ? 'bg-accent-50 text-accent-600 font-semibold border-l-[3px] border-accent-500'
                : 'text-gray-500 hover:text-gray-900 hover:bg-surface-200'
              }
            `}
          >
            <div className={`${isActive('/compare') ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>
              <ArrowLeftRight className="h-5 w-5" />
            </div>
            <span className="text-sm">Compare</span>
          </Link>

          {/* Cloud Accounts Section */}
          {!isDemoMode && Object.keys(groupedAccounts).length > 0 && (
            <div className="pt-6 mt-6 border-t border-surface-300">
              <div className="px-4 pb-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Cloud Providers
              </div>

              {Object.entries(groupedAccounts).map(([providerId, accounts]) => (
                <div key={providerId} className="mt-1.5">
                  <button
                    onClick={() => toggleProviderExpand(providerId)}
                    className={`
                      flex items-center space-x-3 px-4 py-3 w-full rounded-lg
                      transition-colors duration-150 group
                      ${expandedProviders.has(providerId)
                        ? 'bg-surface-100 text-gray-900'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-surface-100'
                      }
                    `}
                  >
                    <div
                      className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
                        expandedProviders.has(providerId)
                          ? 'bg-surface-200'
                          : 'bg-surface-100 group-hover:bg-surface-200'
                      }`}
                    >
                      <ProviderIcon providerId={providerId} size={20} />
                    </div>
                    <span className="flex-1 text-left text-sm font-semibold">
                      {accounts[0].providerName}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-surface-200 text-gray-600">
                      {accounts.length}
                    </span>
                    {expandedProviders.has(providerId) ? (
                      <ChevronUp className="h-4 w-4 text-gray-400 transition-transform duration-200" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400 transition-transform duration-200" />
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
                            transition-colors duration-150
                            ${location.search.includes(`account=${account.accountId}`)
                              ? 'bg-accent-50 text-accent-600 font-medium'
                              : account.isActive
                                ? 'text-gray-600 hover:text-gray-900 hover:bg-surface-200'
                                : 'text-gray-400 hover:text-gray-600 hover:bg-surface-100'
                            }
                          `}
                        >
                          <div
                            className={`w-1.5 h-1.5 rounded-full transition-colors ${
                              account.isActive ? 'bg-accent-400' : 'bg-gray-300'
                            }`}
                          />
                          <span className="truncate flex-1 font-medium">
                            {account.accountAlias || `Account ${account.accountId}`}
                          </span>
                          {!account.isActive && (
                            <span className="text-[10px] text-gray-400">Inactive</span>
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
            <div className="pt-6 mt-6 border-t border-surface-300">
              <div className="px-4 pb-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Cloud Providers
              </div>
              <div className="px-4 py-8 text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-accent-50 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-accent-500" />
                </div>
                <p className="text-xs text-gray-500 mb-4 font-medium">
                  Connect cloud providers to track costs
                </p>
                <Link
                  to={signupDisabled ? '/login' : '/signup'}
                  className="inline-flex items-center px-4 py-2 rounded-lg text-xs text-white bg-accent-500 hover:bg-accent-600 font-semibold transition-colors duration-150"
                >
                  {signupDisabled ? 'Sign in' : 'Get started'}
                </Link>
              </div>
            </div>
          )}

        </nav>

        {/* Footer with Contact link */}
        <div className="absolute bottom-0 left-0 right-0 px-4 py-4 border-t border-surface-300 bg-white">
          <button
            onClick={() => { onContactClick?.(); onClose(); }}
            className="flex items-center space-x-3 px-4 py-2.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-surface-200 transition-colors duration-150 group w-full text-left"
          >
            <MessageCircle className="h-4 w-4 opacity-70 group-hover:opacity-100" />
            <span className="text-sm">Contact Us</span>
          </button>
        </div>

      </aside>
    </>
  )
}
