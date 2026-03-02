import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { MessageCircle, Sparkles, Plus, Lightbulb, ChevronDown } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
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

export interface NavGroup {
  label: string
  items: NavItem[]
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
  /** Nav items (links with icons) — flat list fallback */
  navItems?: NavItem[]
  /** Nav groups — grouped sections with labels */
  navGroups?: NavGroup[]
  /** Callback when "Contact Us" is clicked */
  onContactClick?: () => void
}

const defaultNavItems: NavItem[] = []

const sidebarTransition = {
  type: 'tween' as const,
  ease: 'easeOut' as const,
  duration: 0.2,
}

const COLLAPSED_WIDTH = 56
const EXPANDED_WIDTH = 288

const Sidebar = ({
  children,
  isOpen: controlledOpen,
  onToggle,
  navItems = defaultNavItems,
  navGroups,
  onContactClick,
}: SidebarProps) => {
  const [internalOpen, setInternalOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [cloudAccounts, setCloudAccounts] = useState<CloudAccount[]>(() => cloudProvidersCache?.providers ?? [])
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(
    () => new Set(cloudProvidersCache?.expandedIds ?? [])
  )
  const cloudFetchedRef = useRef(false)
  const { isDemoMode } = useAuth()
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
    if (cloudProvidersCache?.providers?.length && !cloudFetchedRef.current) {
      cloudFetchedRef.current = true
      return
    }
    if (cloudFetchedRef.current) return
    cloudFetchedRef.current = true
    fetchCloudAccounts()
  }, [isDemoMode])

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

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
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

  const linkClass = (path: string, collapsed: boolean) =>
    `flex gap-2 font-medium text-sm items-center w-full py-2 ${collapsed ? 'px-0 justify-center' : 'px-4'} rounded-xl transition-colors text-left ${
      isActive(path)
        ? 'bg-accent-50 dark:bg-accent-900/50 text-accent-700 dark:text-accent-200'
        : 'text-gray-700 dark:text-gray-300 hover:bg-surface-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-gray-100'
    }`

  // Check if any item in a group is active
  const isGroupActive = (group: NavGroup) =>
    group.items.some((item) => isActive(item.to))

  // Render nav for expanded sidebar (both desktop expanded + mobile)
  const renderExpandedNav = (grouped: boolean) => {
    if (grouped && navGroups) {
      return (
        <div className="space-y-3">
          {navGroups.map((group) => {
            const groupIsCollapsed = collapsedGroups.has(group.label)
            const active = isGroupActive(group)
            return (
              <div key={group.label}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className="flex items-center w-full px-3 py-1 mb-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <span className="flex-1 text-left">{group.label}</span>
                  <ChevronDown
                    className={`h-3 w-3 transition-transform duration-200 ${groupIsCollapsed ? '-rotate-90' : ''}`}
                  />
                </button>
                {!groupIsCollapsed && (
                  <ul>
                    {group.items.map(({ to, label, icon: Icon }) => (
                      <li key={to} className="mb-0.5">
                        <Link
                          to={to}
                          onClick={closeOnNav}
                          className={linkClass(to, false)}
                        >
                          <Icon className="h-5 w-5 flex-shrink-0" />
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {groupIsCollapsed && active && (
                  <ul>
                    {group.items
                      .filter((item) => isActive(item.to))
                      .map(({ to, label, icon: Icon }) => (
                        <li key={to} className="mb-0.5">
                          <Link to={to} onClick={closeOnNav} className={linkClass(to, false)}>
                            <Icon className="h-5 w-5 flex-shrink-0" />
                            {label}
                          </Link>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )
    }
    // Flat fallback
    return (
      <ul>
        {navItems.map(({ to, label, icon: Icon }) => (
          <li key={to} className="mb-2">
            <Link to={to} onClick={closeOnNav} className={linkClass(to, false)}>
              <Icon className="h-5 w-5 flex-shrink-0" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    )
  }

  // Render nav for collapsed desktop sidebar (icons only)
  const renderCollapsedNav = () => {
    const allItems = navGroups
      ? navGroups.flatMap((g) => g.items)
      : navItems
    return (
      <ul className="flex flex-col items-center gap-0.5">
        {allItems.map(({ to, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
                isActive(to)
                  ? 'bg-accent-50 dark:bg-accent-900/50 text-accent-700 dark:text-accent-200'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-surface-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
              title={navGroups?.flatMap((g) => g.items).find((i) => i.to === to)?.label || navItems.find((i) => i.to === to)?.label}
            >
              <Icon className="h-5 w-5" />
            </Link>
          </li>
        ))}
      </ul>
    )
  }

  const renderFooter = (collapsed: boolean) => (
    <div className={`p-2 border-t border-surface-200 dark:border-gray-700 space-y-1 ${collapsed ? 'flex flex-col items-center' : ''}`}>
      {onContactClick && (
        <button
          type="button"
          onClick={() => {
            onContactClick()
            closeOnNav()
          }}
          className={`flex items-center ${collapsed ? 'justify-center w-10 h-10' : 'gap-2 w-full py-2 px-4'} font-medium text-sm rounded-xl text-gray-600 dark:text-gray-300 hover:bg-surface-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-gray-100 transition-colors`}
          title={collapsed ? 'Contact Us' : undefined}
        >
          <MessageCircle className="h-4 w-4 flex-shrink-0" />
          {!collapsed && 'Contact Us'}
        </button>
      )}
      <Link
        to="/settings?tab=providers"
        onClick={closeOnNav}
        className={`flex items-center ${collapsed ? 'justify-center w-10 h-10' : 'justify-center gap-2 w-full p-2'} font-medium text-sm ${collapsed ? '' : 'text-center'} bg-accent-100 dark:bg-accent-900/50 text-accent-800 dark:text-accent-200 rounded-xl hover:bg-accent-200 dark:hover:bg-accent-800/50 transition-colors`}
        title={collapsed ? 'Add provider' : undefined}
      >
        <Plus className="h-4 w-4 flex-shrink-0" />
        {!collapsed && 'Add provider'}
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
              to="/waitlist"
              onClick={closeOnNav}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs text-white bg-accent-500 hover:bg-accent-600 font-semibold transition-colors"
            >
              Join waitlist
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
                    ? 'bg-surface-200 dark:bg-gray-600 text-gray-900 dark:text-gray-100'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-surface-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                <div className={`w-8 h-8 flex items-center justify-center rounded-lg shrink-0 ${expandedProviders.has(providerId) ? 'bg-surface-200 dark:bg-gray-500' : 'bg-surface-100 dark:bg-gray-700'}`}>
                  <ProviderIcon providerId={providerId} size={18} />
                </div>
                <span className="flex-1 text-sm font-semibold truncate">{accounts[0].providerName}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 shrink-0">
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
                            ? 'bg-accent-50 dark:bg-accent-900/40 text-accent-700 dark:text-accent-300 font-medium'
                            : account.isActive
                              ? 'text-gray-600 dark:text-gray-300 hover:bg-surface-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-gray-100'
                              : 'text-gray-400 dark:text-gray-500 hover:bg-surface-200 dark:hover:bg-gray-600 hover:text-gray-600 dark:hover:text-gray-300'
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

  // Mobile sidebar content (always expanded, with groups)
  const mobileSidebarContent = (
    <>
      <nav className="flex-1 p-4 overflow-y-auto">
        {renderExpandedNav(true)}
        {renderCloudProviders()}
      </nav>
      {renderFooter(false)}
    </>
  )

  // Desktop sidebar content changes based on collapsed state
  const desktopSidebarContent = (
    <>
      <nav className={`flex-1 ${isCollapsed ? 'px-1 py-2' : 'p-4'} overflow-y-auto`}>
        {isCollapsed ? renderCollapsedNav() : renderExpandedNav(true)}
        {!isCollapsed && renderCloudProviders()}
      </nav>
      {renderFooter(isCollapsed)}
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
                  <span className="dark:inline-block dark:rounded-lg dark:bg-gray-100 dark:px-2 dark:py-1.5">
                    <img src="/logo.png" alt="Costra" className="h-9 w-auto block" />
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={toggleSidebar}
                  aria-label="Close menu"
                  className="absolute right-4 p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-surface-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  <span className="text-xl leading-none">×</span>
                </button>
              </div>
              {mobileSidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <motion.div
        className="hidden lg:flex flex-col fixed top-0 left-0 h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-r border-surface-200 dark:border-gray-800 shadow-sm z-20 overflow-hidden"
        initial={{ width: COLLAPSED_WIDTH }}
        animate={{ width: isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
        transition={sidebarTransition}
        onMouseEnter={() => setIsCollapsed(false)}
        onMouseLeave={() => setIsCollapsed(true)}
      >
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-center'} h-16 px-2 border-b border-surface-200 dark:border-gray-800 shrink-0`}>
          <Link to="/dashboard" className="flex items-center justify-center">
            {isCollapsed ? (
              <span className="dark:inline-block dark:rounded-lg dark:bg-gray-100 dark:p-1">
                <img src="/favicon-192.png" alt="Costra" className="h-8 w-8 block object-contain" />
              </span>
            ) : (
              <span className="dark:inline-block dark:rounded-lg dark:bg-gray-100 dark:px-2 dark:py-1.5">
                <img src="/logo.png" alt="Costra" className="h-9 w-auto block" />
              </span>
            )}
          </Link>
        </div>
        {desktopSidebarContent}
      </motion.div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-14 transition-all duration-300">
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
