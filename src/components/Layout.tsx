import { useState } from 'react'
import Sidebar from './Sidebar'
import TopNav from './TopNav'
import AIChat from './AIChat'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      {/* Sidebar - Always visible on desktop, drawer on mobile */}
      <div className="hidden lg:block">
        <Sidebar isOpen={true} onClose={() => {}} isPermanent={true} />
      </div>
      
      {/* Mobile Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} isPermanent={false} />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden w-full lg:ml-0">
        {/* Top Navigation */}
        <TopNav onMenuClick={() => setSidebarOpen(true)} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-[#F8FAFC]">
          <div className="min-h-full">
            {children}
          </div>
        </main>
      </div>

      {/* AI Chat Assistant */}
      <AIChat />
    </div>
  )
}
