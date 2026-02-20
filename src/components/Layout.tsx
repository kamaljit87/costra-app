import { useState, useEffect, useMemo } from 'react'
import { Sidebar, type NavItem } from './ui/sidebar'
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
} from 'lucide-react'

const BASE_NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/budgets', label: 'Budgets', icon: Wallet },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/compare', label: 'Compare', icon: ArrowLeftRight },
]

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [contactChatOpen, setContactChatOpen] = useState(false)

  const navItems = useMemo(() => {
    if (user?.isAdmin) {
      return [...BASE_NAV_ITEMS, { to: '/admin/tickets', label: 'Admin', icon: ShieldCheck }]
    }
    return BASE_NAV_ITEMS
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
      navItems={navItems}
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
