import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import TopNav from './TopNav'
import AIChat from './AIChat'
import ContactChat from './ContactChat'
import TrialBanner from './TrialBanner'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [contactChatOpen, setContactChatOpen] = useState(false)

  // Prevent body scroll when mobile sidebar is open
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
    <div className="flex h-screen bg-surface-100">
      {/* Sidebar - Always visible on desktop, drawer on mobile */}
      <div className="hidden lg:flex h-full">
        <Sidebar isOpen={true} onClose={() => {}} isPermanent={true} onContactClick={() => setContactChatOpen(true)} />
      </div>

      {/* Mobile Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} isPermanent={false} onContactClick={() => setContactChatOpen(true)} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 w-full lg:ml-0">
        {/* Top Navigation */}
        <div className="relative z-30 shrink-0">
          <TopNav onMenuClick={() => setSidebarOpen(true)} />
        </div>

        {/* Trial Banner */}
        <TrialBanner />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-surface-100">
          <div className="min-h-full px-6 lg:px-8 py-6 lg:py-8">
            {children}
          </div>
        </main>
      </div>

      {/* AI Chat Assistant */}
      <AIChat />

      {/* Contact Support Chat */}
      <ContactChat isOpen={contactChatOpen} onClose={() => setContactChatOpen(false)} />
    </div>
  )
}
