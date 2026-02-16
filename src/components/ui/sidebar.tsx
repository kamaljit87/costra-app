import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { MessageCircle, Sparkles, Plus, Lightbulb } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { usePublicConfig } from '../../contexts/PublicConfigContext'
import { cloudProvidersAPI } from '../../services/api'
import { ProviderIcon } from '../CloudProviderIcons'

const AnimatedMenuToggle = ({
  toggle,
  isOpen,
}: {
  toggle: () => void
  isOpen: boolean
}) => (
  <button
    type="button"
    onClick={toggle}
    aria-label="Toggle menu"
    className="focus:outline-none z-50"
  >
    <motion.div animate={{ y: isOpen ? 13 : 0 }} transition={{ duration: 0.3 }}>
      <motion.svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        initial="closed"
        animate={isOpen ? 'open' : 'closed'}
        transition={{ duration: 0.3 }}
        className="text-gray-900 dark:text-gray-100"
      >
        <motion.path
          fill="transparent"
          strokeWidth="3"
          stroke="currentColor"
          strokeLinecap="round"
          variants={{
            closed: { d: 'M 2 2.5 L 22 2.5' },
            open: { d: 'M 3 16.5 L 17 2.5' },
          }}
        />
        <motion.path
          fill="transparent"
          strokeWidth="3"
          stroke="currentColor"
          strokeLinecap="round"
          variants={{
            closed: { d: 'M 2 12 L 22 12', opacity: 1 },
            open: { opacity: 0 },
          }}
          transition={{ duration: 0.2 }}
        />
        <motion.path
          fill="transparent"
          strokeWidth="3"
          stroke="currentColor"
          strokeLinecap="round"
          variants={{
            closed: { d: 'M 2 21.5 L 22 21.5' },
            open: { d: 'M 3 2.5 L 17 16.5' },
          }}
        />
      </motion.svg>
    </motion.div>
  </button>
)

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
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

// Module-level cache so cloud provider list survives Sidebar remounts (e.g. on route change)
let cloudProvidersCache: { providers: CloudAccount[]; expandedIds: string[] } | null = null

interface SidebarProps {
  /** Main content to render beside the sidebar */
  children?: React.ReactNode
  /** Controlled open state (use with onToggle for Layout) */
  isOpen?: boolean
  /** Called when menu toggle is clicked or a nav link is clicked on mobile (close) */
  onToggle?: () => void
  /** Nav items (links with icons) */
  navItems?: NavItem[]
  /** Callback when "Contact Us" is clicked */
  onContactClick?: () => void
}

const defaultNavItems: NavItem[] = []

const Sidebar = ({
  children,
  isOpen: controlledOpen,
  onToggle,
  navItems = defaultNavItems,
  onContactClick,
}: SidebarProps) => {
  const [internalOpen, setInternalOpen] = useState(false)
  const [cloudAccounts, setCloudAccounts] = useState<CloudAccount[]>(() => cloudProvidersCache?.providers ?? [])
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(
    () => new Set(cloudProvidersCache?.expandedIds ?? [])
  )
  const cloudFetchedRef = useRef(false)
  const { isDemoMode } = useAuth()
  const { signupDisabled } = usePublicConfig()
  const isControlled = controlledOpen !== undefined && onToggle !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen
  const toggleSidebar = isControlled ? onToggle! : () => setInternalOpen((o) => !o)
  const location = useLocation()

  const fetchCloudAccounts = () => {
    if (isDemoMode) return
    cloudProvidersAPI.getCloudProviders().then((res) => {
      const providers = res.providers || []
      const expandedIds =
        cloudProvidersCache && cloudProvidersCache.expandedIds.length > 0
          ? cloudProvidersCache.expandedIds
          : providers.map((p: CloudAccount) => p.providerId)
      cloudProvidersCache = { providers, expandedIds }
      setCloudAccounts(providers)
      setExpandedProviders(new Set(expandedIds))
    }).catch((err) => {
      console.error('Failed to load cloud accounts', err)
      cloudFetchedRef.current = false
    })
  }

  useEffect(() => {
    if (isDemoMode) {
      cloudFetchedRef.current = false
      cloudProvidersCache = null
      setCloudAccounts([])
      setExpandedProviders(new Set())
      return
    }
    // If we have cached data, use it and skip fetch (avoids refetch on remount)
    if (cloudProvidersCache?.providers?.length && !cloudFetchedRef.current) {
      cloudFetchedRef.current = true
      return
    }
    if (cloudFetchedRef.current) return
    cloudFetchedRef.current = true
    fetchCloudAccounts()
  }, [isDemoMode])

  // Refetch when providers change (add/delete/update from Settings)
  useEffect(() => {
    if (isDemoMode) return
    const onProvidersChanged = () => {
      cloudProvidersCache = null
      cloudFetchedRef.current = false
      fetchCloudAccounts()
    }
    window.addEventListener('cloud-providers-changed', onProvidersChanged)
    return () => window.removeEventListener('cloud-providers-changed', onProvidersChanged)
  }, [isDemoMode])

  const toggleProviderExpand = (providerId: string) => {
    setExpandedProviders((prev) => {
      const next = new Set(prev)
      if (next.has(providerId)) next.delete(providerId)
      else next.add(providerId)
      if (cloudProvidersCache) {
        cloudProvidersCache = { ...cloudProvidersCache, expandedIds: Array.from(next) }
      }
      return next
    })
  }

  const groupedAccounts = cloudAccounts.reduce((acc, account) => {
    if (!acc[account.providerId]) acc[account.providerId] = []
    acc[account.providerId].push(account)
    return acc
  }, {} as Record<string, CloudAccount[]>)

  const closeOnNav = () => {
    if (isControlled) onToggle!()
  }

  const isActive = (path: string) => location.pathname === path

  const mobileSidebarVariants = {
    hidden: { x: '-100%' },
    visible: { x: 0 },
  }

  const linkClass = (path: string) =>
    `flex gap-2 font-medium text-sm items-center w-full py-2 px-4 rounded-xl transition-colors text-left ${
      isActive(path)
        ? 'bg-accent-50 dark:bg-accent-900/50 text-accent-700 dark:text-accent-200'
        : 'text-gray-700 dark:text-gray-300 hover:bg-surface-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
    }`

  const renderNav = () => (
    <ul>
      {navItems.map(({ to, label, icon: Icon }) => (
        <li key={to} className="mb-2">
          <Link
            to={to}
            onClick={closeOnNav}
            className={linkClass(to)}
          >
            <Icon className="h-5 w-5 flex-shrink-0" />
            {label}
          </Link>
        </li>
      ))}
    </ul>
  )

  const renderFooter = () => (
    <div className="p-4 border-t border-surface-200 dark:border-gray-700 space-y-2">
      {onContactClick && (
        <button
          type="button"
          onClick={() => {
            onContactClick()
            closeOnNav()
          }}
          className="flex items-center gap-2 w-full font-medium text-sm py-2 px-4 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-surface-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          Contact Us
        </button>
      )}
      <Link
        to="/settings"
        onClick={closeOnNav}
        className="flex items-center justify-center gap-2 font-medium text-sm p-2 text-center bg-accent-100 dark:bg-accent-900/50 text-accent-800 dark:text-accent-200 rounded-xl hover:bg-accent-200 dark:hover:bg-accent-800/50 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Add provider
      </Link>
    </div>
  )

  const renderCloudProviders = () => {
    if (isDemoMode) {
      return (
        <div className="mt-4 pt-4 border-t border-surface-200">
          <div className="px-2 pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Cloud providers
          </div>
          <div className="px-2 py-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-accent-50 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-accent-500" />
            </div>
            <p className="text-xs text-gray-500 mb-3 font-medium">Connect cloud providers to track costs</p>
            <Link
              to={signupDisabled ? '/login' : '/signup'}
              onClick={closeOnNav}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs text-white bg-accent-500 hover:bg-accent-600 font-semibold transition-colors"
            >
              {signupDisabled ? 'Sign in' : 'Get started'}
            </Link>
          </div>
        </div>
      )
    }
    if (Object.keys(groupedAccounts).length === 0) return null
    return (
      <div className="mt-4 pt-4 border-t border-surface-200">
        <div className="px-2 pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          Cloud providers
        </div>
        <div className="space-y-1">
          {Object.entries(groupedAccounts).map(([providerId, accounts]) => (
            <div key={providerId}>
              <button
                type="button"
                onClick={() => toggleProviderExpand(providerId)}
                className={`flex items-center gap-2 w-full py-2 px-3 rounded-xl text-left transition-colors ${
                  expandedProviders.has(providerId)
                    ? 'bg-surface-200 text-gray-900'
                    : 'text-gray-600 hover:bg-surface-200 hover:text-gray-900'
                }`}
              >
                <div className={`w-8 h-8 flex items-center justify-center rounded-lg shrink-0 ${expandedProviders.has(providerId) ? 'bg-surface-200' : 'bg-surface-100'}`}>
                  <ProviderIcon providerId={providerId} size={18} />
                </div>
                <span className="flex-1 text-sm font-semibold truncate">{accounts[0].providerName}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-200 text-gray-600 shrink-0">
                  {accounts.length}
                </span>
                <span className="text-gray-500 text-sm font-medium w-5 text-center shrink-0" aria-label={expandedProviders.has(providerId) ? 'Collapse' : 'Expand'}>
                  {expandedProviders.has(providerId) ? '−' : '+'}
                </span>
              </button>
              {expandedProviders.has(providerId) && (
                <div className="ml-2 mt-1 space-y-0.5 pl-3 border-l border-surface-200">
                  {accounts.map((account) => (
                    <div
                      key={account.accountId}
                      className="flex items-center gap-1 group"
                    >
                      <Link
                        to={`/provider/${providerId}?account=${account.accountId}`}
                        onClick={closeOnNav}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors flex-1 min-w-0 ${
                          location.search.includes(`account=${account.accountId}`)
                            ? 'bg-accent-50 text-accent-700 font-medium'
                            : account.isActive
                              ? 'text-gray-600 hover:bg-surface-200 hover:text-gray-900'
                              : 'text-gray-400 hover:bg-surface-200 hover:text-gray-600'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${account.isActive ? 'bg-accent-400' : 'bg-gray-300'}`} />
                        <span className="truncate flex-1">{account.accountAlias || `Account ${account.accountId}`}</span>
                        {!account.isActive && <span className="text-[10px] text-gray-400 shrink-0">Inactive</span>}
                      </Link>
                      <Link
                        to={`/recommendations?providerId=${providerId}&accountId=${account.accountId}`}
                        onClick={closeOnNav}
                        className="p-1.5 rounded-md text-gray-400 hover:text-accent-600 hover:bg-accent-50 transition-colors shrink-0"
                        title="Recommendations"
                        aria-label={`Recommendations for ${account.accountAlias || account.accountId}`}
                      >
                        <Lightbulb className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const sidebarContent = (
    <>
      <nav className="flex-1 p-4 overflow-y-auto">
        {renderNav()}
        {renderCloudProviders()}
      </nav>
      {renderFooter()}
    </>
  )

  return (
    <div className="flex h-screen bg-surface-100 dark:bg-gray-900">
      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 bg-black/60 z-30"
              onClick={toggleSidebar}
              aria-hidden
            />
            <motion.div
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={mobileSidebarVariants}
              transition={{ duration: 0.3 }}
              className="md:hidden fixed inset-y-0 left-0 w-72 z-40 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-r border-surface-200 dark:border-gray-800 shadow-xl flex flex-col"
            >
              <div className="flex items-center justify-center h-16 px-4 border-b border-surface-200 dark:border-gray-800 shrink-0 relative">
                <Link to="/dashboard" onClick={closeOnNav} className="w-full flex justify-center items-center">
                  <span className="dark:inline-block dark:rounded-lg dark:bg-gray-900 dark:px-1">
                    <img src="/logo.png" alt="Costra" className="h-9 w-auto block dark:mix-blend-multiply" />
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={toggleSidebar}
                  aria-label="Close menu"
                  className="absolute right-4 p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-surface-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  <span className="text-xl leading-none">×</span>
                </button>
              </div>
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex flex-col fixed top-0 left-0 h-full w-72 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-r border-surface-200 dark:border-gray-800 shadow-sm z-20">
        <div className="flex items-center justify-center h-16 px-4 border-b border-surface-200 dark:border-gray-800 shrink-0">
          <Link to="/dashboard" className="w-full flex justify-center items-center">
            <span className="dark:inline-block dark:rounded-lg dark:bg-gray-900 dark:px-1">
              <img src="/logo.png" alt="Costra" className="h-9 w-auto block dark:mix-blend-multiply" />
            </span>
          </Link>
        </div>
        {sidebarContent}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-72 transition-all duration-300">
        {/* When no children, show placeholder and mobile menu toggle */}
        {children === undefined ? (
          <>
            <div className="lg:hidden flex justify-end items-center pr-4 pt-3 pb-2 bg-surface-100 border-b border-surface-200">
              <AnimatedMenuToggle toggle={toggleSidebar} isOpen={isOpen} />
            </div>
            <div className="p-6">
              <h1 className="text-2xl font-bold text-gray-900">Main Content</h1>
              <p className="text-sm text-gray-500 mt-1">Replace this with your content.</p>
            </div>
          </>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

export { Sidebar }
