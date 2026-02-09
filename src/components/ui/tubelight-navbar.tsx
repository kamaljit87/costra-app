import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface NavItem {
  name: string
  url: string
  icon: LucideIcon
}

interface NavBarProps {
  items: NavItem[]
  className?: string
  /** When true, navbar is inline (no fixed positioning) for use inside a header */
  inline?: boolean
}

export function NavBar({ items, className, inline }: NavBarProps) {
  const location = useLocation()

  const pill = (
    <div className="flex items-center gap-3 bg-background/95 border border-border backdrop-blur-lg py-1 px-1 rounded-full shadow-lg">
        {items.map((item) => {
          const Icon = item.icon
          const [pathname, hash] = item.url.includes('#')
            ? item.url.split('#')
            : [item.url, '']
          const linkTo = hash ? { pathname: pathname || '/', hash: hash } : pathname
          const isActive = hash
            ? location.pathname === (pathname || '/') && location.hash === `#${hash}`
            : location.pathname === item.url ||
              (item.url !== '/' && location.pathname.startsWith(item.url))

          return (
            <Link
              key={item.name}
              to={linkTo}
              className={cn(
                'relative cursor-pointer text-sm font-semibold px-6 py-2 rounded-full transition-colors',
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
                  layoutId="tubelight-lamp"
                  className="absolute inset-0 w-full bg-primary/5 rounded-full -z-10"
                  initial={false}
                  transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 30,
                  }}
                >
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-t-full">
                    <div className="absolute w-12 h-6 bg-primary/20 rounded-full blur-md -top-2 -left-2" />
                    <div className="absolute w-8 h-6 bg-primary/20 rounded-full blur-md -top-1" />
                    <div className="absolute w-4 h-4 bg-primary/20 rounded-full blur-sm top-0 left-2" />
                  </div>
                </motion.div>
              )}
            </Link>
          )
        })}
    </div>
  )

  if (inline) {
    return <div className={cn('flex items-center', className)}>{pill}</div>
  }

  return (
    <div
      className={cn(
        'fixed bottom-0 sm:top-0 left-1/2 -translate-x-1/2 z-[100] mb-6 sm:pt-6',
        className,
      )}
    >
      {pill}
    </div>
  )
}
