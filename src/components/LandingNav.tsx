import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, CreditCard, Mail, BookOpen, LayoutDashboard, BookMarked } from 'lucide-react'
import Logo from './Logo'
import { cn } from '@/lib/utils'
import { useAuth } from '../contexts/AuthContext'
import { usePublicConfig } from '../contexts/PublicConfigContext'

const NAV_ITEMS = [
  { name: 'Home', url: '/', icon: Home },
  { name: 'Pricing', url: '/#pricing', icon: CreditCard },
  { name: 'Docs', url: '/docs', icon: BookMarked },
  { name: 'Blog', url: '/blog', icon: BookOpen },
  { name: 'Contact', url: '/contact', icon: Mail },
]

export default function LandingNav() {
  const location = useLocation()
  const { isAuthenticated, user } = useAuth()
  const { signupDisabled } = usePublicConfig()

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <header className="sticky top-0 z-[100] border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-5 lg:px-6">
        <div className="flex justify-between items-center h-14 sm:h-16 gap-4">
          <Link to="/" className="flex items-center shrink-0" aria-label="Costra Home">
            <Logo height={40} />
          </Link>

          {/* Single unified bar: same glass style for all items */}
          <nav
            className="flex items-center gap-0.5 sm:gap-1 bg-background/90 border border-border backdrop-blur-lg py-1 pl-1.5 pr-1.5 rounded-full shadow-lg"
            aria-label="Main navigation"
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const [pathname, hash] = item.url.includes('#')
                ? item.url.split('#')
                : [item.url, '']
              const linkTo = hash
                ? { pathname: pathname || '/', hash: hash }
                : pathname
              const isActive = hash
                ? location.pathname === (pathname || '/') &&
                  location.hash === `#${hash}`
                : item.url === '/'
                  ? location.pathname === '/' && !location.hash
                  : location.pathname === item.url ||
                    location.pathname.startsWith(item.url + '/')

              return (
                <Link
                  key={item.name}
                  to={linkTo}
                  className={cn(
                    'relative cursor-pointer text-sm font-semibold px-3 sm:px-4 py-2 rounded-full transition-colors',
                    'text-foreground/80 hover:text-primary',
                    isActive && 'bg-muted text-primary',
                  )}
                >
                  <span className="hidden md:inline">{item.name}</span>
                  <span className="md:hidden flex items-center justify-center">
                    <Icon size={18} strokeWidth={2.5} />
                  </span>
                  {isActive && (
                    <motion.div
                      key={item.url}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="absolute inset-0 w-full bg-primary/5 rounded-full -z-10"
                    >
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-t-full pointer-events-none">
                        <div className="absolute w-12 h-6 bg-primary/20 rounded-full blur-md -top-2 -left-2" />
                        <div className="absolute w-8 h-6 bg-primary/20 rounded-full blur-md -top-1" />
                        <div className="absolute w-4 h-4 bg-primary/20 rounded-full blur-sm top-0 left-2" />
                      </div>
                    </motion.div>
                  )}
                </Link>
              )
            })}

            <span className="w-px h-4 bg-border mx-1.5 hidden sm:block" aria-hidden />

            {isAuthenticated ? (
              <>
                <Link
                  to="/dashboard"
                  className={cn(
                    'flex items-center gap-1.5 text-sm font-semibold px-3 sm:px-4 py-2 rounded-full transition-colors',
                    'bg-primary text-white hover:bg-primary/90',
                  )}
                >
                  <LayoutDashboard size={16} strokeWidth={2.5} />
                  <span className="hidden sm:inline">Dashboard</span>
                </Link>
                <Link
                  to="/dashboard"
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-accent-100 text-accent-700 text-xs font-bold overflow-hidden shrink-0"
                  title={user?.name || 'Profile'}
                >
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    initials
                  )}
                </Link>
              </>
            ) : !signupDisabled ? (
              <>
                <Link
                  to="/login"
                  className={cn(
                    'text-sm font-semibold px-3 sm:px-4 py-2 rounded-full transition-colors',
                    'text-foreground/80 hover:text-primary hover:bg-muted/50',
                  )}
                >
                  Sign In
                </Link>
                <Link
                  to="/waitlist"
                  className={cn(
                    'text-sm font-semibold px-4 py-2 rounded-full transition-colors shrink-0',
                    'bg-primary text-white hover:bg-primary/90',
                  )}
                >
                  Join Waitlist
                </Link>
              </>
            ) : null}
          </nav>
        </div>
      </div>
    </header>
  )
}
