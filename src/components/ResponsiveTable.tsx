import { ReactNode } from 'react'

interface ResponsiveTableProps {
  children: ReactNode
  className?: string
}

/**
 * Responsive table wrapper that:
 * - Shows full table on desktop
 * - Provides horizontal scroll with sticky header on tablet
 * - Stacks rows on mobile (optional, can be overridden)
 */
export default function ResponsiveTable({ children, className = '' }: ResponsiveTableProps) {
  return (
    <div className={`overflow-x-auto -mx-4 sm:mx-0 ${className}`}>
      <div className="inline-block min-w-full align-middle sm:rounded-lg">
        <div className="overflow-hidden sm:rounded-lg border border-gray-200">
          {children}
        </div>
      </div>
    </div>
  )
}
