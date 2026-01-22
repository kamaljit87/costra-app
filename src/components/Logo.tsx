/**
 * Costra Logo Component
 * Optimized for white backgrounds
 */

interface LogoProps {
  className?: string
  height?: number
  showText?: boolean
}

export default function Logo({ className = '', height = 40, showText = true }: LogoProps) {
  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {/* Robot Icon - Costra Mascot */}
      <svg
        width={height}
        height={height}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        {/* Robot Head - Rounded Rectangle */}
        <rect
          x="20"
          y="15"
          width="80"
          height="50"
          rx="8"
          fill="#14B8A6"
          stroke="#0F766E"
          strokeWidth="2.5"
        />
        
        {/* Antenna Nubs */}
        <circle cx="45" cy="12" r="3" fill="#0F766E" />
        <circle cx="75" cy="12" r="3" fill="#0F766E" />
        
        {/* Eyes - Orange/Yellow with black pupils */}
        <circle cx="40" cy="35" r="8" fill="#FBBF24" />
        <circle cx="80" cy="35" r="8" fill="#FBBF24" />
        <circle cx="40" cy="35" r="4" fill="#1F2937" />
        <circle cx="80" cy="35" r="4" fill="#1F2937" />
        
        {/* Smile */}
        <path
          d="M 45 50 Q 60 55 75 50"
          stroke="#0F766E"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        
        {/* Robot Body */}
        <rect
          x="25"
          y="65"
          width="70"
          height="45"
          rx="8"
          fill="#14B8A6"
          stroke="#0F766E"
          strokeWidth="2.5"
        />
        
        {/* Chest Panel - Orange/Yellow with arrow */}
        <rect
          x="45"
          y="75"
          width="30"
          height="25"
          rx="3"
          fill="#FBBF24"
        />
        <path
          d="M 52 85 L 57 82 L 62 85 L 57 88 Z"
          fill="#1F2937"
        />
        
        {/* Left Arm - Waving (raised and bent) */}
        <rect
          x="8"
          y="70"
          width="18"
          height="12"
          rx="6"
          fill="#14B8A6"
          stroke="#0F766E"
          strokeWidth="2"
        />
        <rect
          x="2"
          y="55"
          width="12"
          height="18"
          rx="6"
          fill="#14B8A6"
          stroke="#0F766E"
          strokeWidth="2"
        />
        {/* Hand - three fingers */}
        <circle cx="8" cy="48" r="5" fill="#14B8A6" stroke="#0F766E" strokeWidth="2" />
        <circle cx="6" cy="46" r="1.5" fill="#0F766E" />
        <circle cx="10" cy="46" r="1.5" fill="#0F766E" />
        <circle cx="8" cy="49" r="1.5" fill="#0F766E" />
        
        {/* Right Arm - Resting at side */}
        <rect
          x="94"
          y="72"
          width="18"
          height="12"
          rx="6"
          fill="#14B8A6"
          stroke="#0F766E"
          strokeWidth="2"
        />
        <rect
          x="106"
          y="78"
          width="12"
          height="18"
          rx="6"
          fill="#14B8A6"
          stroke="#0F766E"
          strokeWidth="2"
        />
        
        {/* Legs - Boot-like feet */}
        <rect
          x="30"
          y="110"
          width="20"
          height="10"
          rx="5"
          fill="#14B8A6"
          stroke="#0F766E"
          strokeWidth="2"
        />
        <rect
          x="70"
          y="110"
          width="20"
          height="10"
          rx="5"
          fill="#14B8A6"
          stroke="#0F766E"
          strokeWidth="2"
        />
      </svg>
      
      {/* Logo Text */}
      {showText && (
        <span className="text-2xl font-bold text-teal-800" style={{ fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.5px' }}>
          Costra
        </span>
      )}
    </div>
  )
}
