/**
 * Costra Logo Component
 * Uses the brand logo PNG image
 */

interface LogoProps {
  className?: string
  height?: number
}

export default function Logo({ className = '', height = 40 }: LogoProps) {
  return (
    <span className="dark:inline-block dark:rounded-lg dark:bg-gray-900 dark:px-1">
      <img
        src="/logo.png"
        alt="Costra"
        className={`w-auto dark:mix-blend-multiply ${className}`}
        style={{ height: `${height}px` }}
      />
    </span>
  )
}
