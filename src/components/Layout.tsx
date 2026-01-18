import { useState } from 'react'
import Sidebar from './Sidebar'
import TopNav from './TopNav'
import AIChat from './AIChat'
import { Menu } from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar - Hidden on desktop when TopNav is shown, only for mobile */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Top Navigation - Desktop only, Mobile shows hamburger */}
        <div className="hidden lg:block">
          <TopNav />
        </div>
        
        {/* Mobile header with hamburger */}
        <header className="lg:hidden bg-white border-b border-gray-200 h-16 flex items-center px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <Menu className="h-6 w-6" />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-white">
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
