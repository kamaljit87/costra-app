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
    <img
      src="/logo.png"
      alt="Costra"
      className={`w-auto ${className}`}
      style={{ height: `${height}px` }}
    />
  )
}
