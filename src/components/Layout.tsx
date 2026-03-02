import { useState, useEffect, useMemo } from 'react'
import { Sidebar, type NavGroup } from './ui/sidebar'
import TopNav from './TopNav'
import AIChat from './AIChat'
import ContactChat from './ContactChat'
import TrialBanner from './TrialBanner'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard,
  Wallet,
  FileText,
  ArrowLeftRight,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  Shield,
  Container,
  ClipboardList,
  Percent,
  Split,
  FileCode,
  Cloud,
  LayoutGrid,
} from 'lucide-react'

const BASE_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/custom-dashboard', label: 'My Dashboards', icon: LayoutGrid },
      { to: '/budgets', label: 'Budgets', icon: Wallet },
      { to: '/reports', label: 'Reports', icon: FileText },
    ],
  },
  {
    label: 'Cost Management',
    items: [
      { to: '/anomalies', label: 'Anomalies', icon: AlertTriangle },
      { to: '/workflows', label: 'Reviews', icon: ClipboardList },
      { to: '/forecasts', label: 'Forecasts', icon: TrendingUp },
      { to: '/policies', label: 'Policies', icon: Shield },
      { to: '/savings-plans', label: 'RI/SP Plans', icon: Percent },
      { to: '/allocations', label: 'Allocations', icon: Split },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { to: '/kubernetes', label: 'Kubernetes', icon: Container },
      { to: '/terraform', label: 'Terraform', icon: FileCode },
      { to: '/saas', label: 'SaaS Spend', icon: Cloud },
      { to: '/compare', label: 'Compare', icon: ArrowLeftRight },
    ],
  },
]

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [contactChatOpen, setContactChatOpen] = useState(false)

  const navGroups = useMemo(() => {
    if (user?.isAdmin) {
      return [
        ...BASE_NAV_GROUPS,
        { label: 'Admin', items: [{ to: '/admin/tickets', label: 'Admin', icon: ShieldCheck }] },
      ]
    }
    return BASE_NAV_GROUPS
  }, [user?.isAdmin])

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [sidebarOpen])

  return (
    <>
    <Sidebar
      isOpen={sidebarOpen}
      onToggle={() => setSidebarOpen((o) => !o)}
      navGroups={navGroups}
      onContactClick={() => setContactChatOpen(true)}
    >
      <div className="flex flex-col min-h-screen">
        <div className="relative z-30 shrink-0">
          <TopNav onMenuClick={() => setSidebarOpen(true)} />
        </div>
        <TrialBanner />
        <main className="flex-1 overflow-y-auto bg-surface-100 dark:bg-gray-900">
          <div className="min-h-full px-6 lg:px-8 py-6 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </Sidebar>
    <AIChat />
    <ContactChat isOpen={contactChatOpen} onClose={() => setContactChatOpen(false)} />
  </>
  )
}
