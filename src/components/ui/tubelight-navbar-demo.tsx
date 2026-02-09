import { Home, CreditCard, Mail, LayoutDashboard, FileText } from 'lucide-react'
import { NavBar } from '@/components/ui/tubelight-navbar'

export function NavBarDemo() {
  const navItems = [
    { name: 'Home', url: '/', icon: Home },
    { name: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
    { name: 'Pricing', url: '/billing', icon: CreditCard },
    { name: 'Contact', url: '/contact', icon: Mail },
    { name: 'Terms', url: '/terms', icon: FileText },
  ]

  return <NavBar items={navItems} />
}
