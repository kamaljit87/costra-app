import { useLocation, Link } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cloudProvidersAPI } from '../services/api'

interface Breadcrumb {
  label: string
  path?: string
}

export default function Breadcrumbs() {
  const location = useLocation()
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([])

  useEffect(() => {
    const generateBreadcrumbs = async () => {
      const path = location.pathname
      const segments = path.split('/').filter(Boolean)
      const crumbs: Breadcrumb[] = []

      // Always start with Dashboard (home)
      if (segments.length === 0 || segments[0] !== 'dashboard') {
        crumbs.push({ label: 'Dashboard', path: '/dashboard' })
      }

      // Parse path segments
      if (segments.length > 0) {
        const [first, second] = segments

        switch (first) {
          case 'dashboard':
            crumbs.push({ label: 'Dashboard' })
            break

          case 'provider':
            crumbs.push({ label: 'Analytics', path: '/dashboard' })
            if (second) {
              // Fetch provider name
              try {
                const response = await cloudProvidersAPI.getCloudProviders()
                const provider = response.providers?.find(
                  (p: any) => p.providerId === second
                )
                const providerName = provider?.accountAlias || provider?.providerName || second.toUpperCase()
                crumbs.push({ label: providerName })
              } catch (error) {
                // Fallback to provider ID if fetch fails
                crumbs.push({ label: second.toUpperCase() })
              }
            }
            break

          case 'settings':
            crumbs.push({ label: 'Settings' })
            break

          case 'profile':
            crumbs.push({ label: 'Profile' })
            break

          case 'debug':
            crumbs.push({ label: 'API Debug', path: '/debug' })
            break

          case 'budgets':
            crumbs.push({ label: 'Budgets' })
            break

          case 'products':
            crumbs.push({ label: 'Product Costs' })
            break

          case 'teams':
            crumbs.push({ label: 'Team Costs' })
            break

          case 'reports':
            crumbs.push({ label: 'Reports' })
            break

          default:
            crumbs.push({ label: first.charAt(0).toUpperCase() + first.slice(1) })
        }
      }

      setBreadcrumbs(crumbs)
    }

    generateBreadcrumbs()
  }, [location.pathname])

  if (breadcrumbs.length === 0) {
    return null
  }

  // Don't show breadcrumbs on Dashboard if it's the only item
  if (breadcrumbs.length === 1 && breadcrumbs[0].path === '/dashboard') {
    return null
  }

  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1
        const isActive = !crumb.path || isLast

        return (
          <div key={index} className="flex items-center space-x-2">
            {index === 0 && (
              <Home className="h-4 w-4 text-gray-400" />
            )}
            {crumb.path && !isLast ? (
              <Link
                to={crumb.path}
                className="hover:text-gray-900 transition-colors"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className={isActive ? 'text-gray-900 font-medium' : ''}>
                {crumb.label}
              </span>
            )}
            {!isLast && (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
          </div>
        )
      })}
    </nav>
  )
}
