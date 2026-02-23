import React, { useState } from 'react'

/** Base path for custom provider icons. Place SVG or PNG files here to override built-in icons. */
export const PROVIDER_ICONS_BASE = '/icons/providers'

/** Maps providerId to icon filename (without extension). Used to load custom icons from public folder. */
export const getProviderIconFilename = (providerId: string): string | null => {
  const id = providerId.toLowerCase()
  const map: Record<string, string> = {
    aws: 'aws',
    azure: 'azure',
    gcp: 'gcp',
    google: 'gcp',
    digitalocean: 'digitalocean',
    do: 'digitalocean',
    linode: 'linode',
    akamai: 'linode',
    vultr: 'vultr',
    ibm: 'ibm',
    ibmcloud: 'ibm',
    mongodb: 'mongodb',
    mongodbatlas: 'mongodb',
    atlas: 'mongodb',
  }
  return map[id] ?? null
}

interface IconProps {
  className?: string
  size?: number
}

// AWS Icon
export const AWSIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="currentColor"
  >
    <path d="M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.063.056.127.056.183 0 .08-.048.16-.152.24l-.503.335a.383.383 0 0 1-.208.072c-.08 0-.16-.04-.239-.112a2.47 2.47 0 0 1-.287-.375 6.18 6.18 0 0 1-.248-.471c-.622.734-1.405 1.101-2.347 1.101-.67 0-1.205-.191-1.596-.574-.391-.384-.59-.894-.59-1.533 0-.678.239-1.23.726-1.644.487-.415 1.133-.623 1.955-.623.272 0 .551.024.846.064.296.04.6.104.918.176v-.583c0-.607-.127-1.03-.375-1.277-.255-.248-.686-.367-1.3-.367-.28 0-.568.031-.863.103-.296.072-.583.16-.863.272a2.287 2.287 0 0 1-.28.104.488.488 0 0 1-.127.023c-.112 0-.168-.08-.168-.247v-.391c0-.128.016-.224.056-.28a.597.597 0 0 1 .224-.167c.279-.144.614-.264 1.005-.36a4.84 4.84 0 0 1 1.246-.151c.95 0 1.644.216 2.091.647.439.43.662 1.085.662 1.963v2.586zm-3.24 1.214c.263 0 .534-.048.822-.144.287-.096.543-.271.758-.51.128-.152.224-.32.272-.512.047-.191.08-.423.08-.694v-.335a6.66 6.66 0 0 0-.735-.136 6.02 6.02 0 0 0-.75-.048c-.535 0-.926.104-1.19.32-.263.215-.39.518-.39.917 0 .375.095.655.295.846.191.2.47.296.838.296zm6.41.862c-.144 0-.24-.024-.304-.08-.064-.048-.12-.16-.168-.311L7.586 5.55a1.398 1.398 0 0 1-.072-.32c0-.128.064-.2.191-.2h.783c.151 0 .255.025.31.08.065.048.113.16.16.312l1.342 5.284 1.245-5.284c.04-.16.088-.264.151-.312a.549.549 0 0 1 .32-.08h.638c.152 0 .256.025.32.08.063.048.12.16.151.312l1.261 5.348 1.381-5.348c.048-.16.104-.264.16-.312a.52.52 0 0 1 .311-.08h.743c.127 0 .2.065.2.2 0 .04-.009.08-.017.128a1.137 1.137 0 0 1-.056.2l-1.923 6.17c-.048.16-.104.263-.168.311a.51.51 0 0 1-.303.08h-.687c-.151 0-.255-.024-.32-.08-.063-.056-.119-.16-.15-.32l-1.238-5.148-1.23 5.14c-.04.16-.087.264-.15.32-.065.056-.177.08-.32.08zm10.256.215c-.415 0-.83-.048-1.229-.143-.399-.096-.71-.2-.918-.32-.128-.071-.215-.151-.247-.223a.563.563 0 0 1-.048-.224v-.407c0-.167.064-.247.183-.247.048 0 .096.008.144.024.048.016.12.048.2.08.271.12.566.215.878.279.319.064.63.096.95.096.502 0 .894-.088 1.165-.264a.86.86 0 0 0 .415-.758.777.777 0 0 0-.215-.559c-.144-.151-.416-.287-.807-.415l-1.157-.36c-.583-.183-1.014-.454-1.277-.813a1.902 1.902 0 0 1-.4-1.158c0-.335.073-.63.216-.886.144-.255.335-.479.575-.654.24-.184.51-.32.83-.415.32-.096.655-.136 1.006-.136.176 0 .359.008.535.032.183.024.35.056.518.088.16.04.312.08.455.127.144.048.256.096.336.144a.69.69 0 0 1 .24.2.43.43 0 0 1 .071.263v.375c0 .168-.064.256-.184.256a.83.83 0 0 1-.303-.096 3.652 3.652 0 0 0-1.532-.311c-.455 0-.815.071-1.062.223-.248.152-.375.383-.375.71 0 .224.08.416.24.567.159.152.454.304.877.44l1.134.358c.574.184.99.44 1.237.767.247.327.367.702.367 1.117 0 .343-.072.655-.207.926-.144.272-.336.511-.583.703-.248.2-.543.343-.886.447-.36.111-.734.167-1.142.167z" fill="#FF9900"/>
  </svg>
)

// Azure Icon
export const AzureIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="currentColor"
  >
    <path d="M5.483 21.3H24L14.025 4.013l-3.038 8.347 5.836 6.938L5.483 21.3zM13.23 2.7L6.105 8.677 0 19.253h5.505v.014L13.23 2.7z" fill="#0078D4"/>
  </svg>
)

// Google Cloud Icon
export const GCPIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="currentColor"
  >
    <path d="M12.19 2.38a9.344 9.344 0 0 0-9.234 6.893c.053-.02-.055.013 0 0-3.875 2.551-3.922 8.11-.247 10.941l.006-.007-.007.03a6.717 6.717 0 0 0 4.077 1.356h5.173l.03.03h5.192c6.687.053 9.376-8.605 3.835-12.35a9.365 9.365 0 0 0-8.825-6.893zM8.073 19.39a4.303 4.303 0 0 1-2.57-.9l-.003.004a4.97 4.97 0 0 1 .262-8.391 9.365 9.365 0 0 0-.142 1.603c0 3.377 1.78 6.34 4.453 8.004H8.073zm8.146-.063l-.012.03h-3.345a9.31 9.31 0 0 0 5.553-8.464 9.343 9.343 0 0 0-.158-1.69 4.97 4.97 0 0 1-.318 8.124h-.002l.003.004a4.303 4.303 0 0 1-1.72.996zm.28-3.103a6.94 6.94 0 0 1-6.694-6.72 6.94 6.94 0 0 1 6.918-6.72h.001a6.94 6.94 0 0 1 6.7 6.72 6.94 6.94 0 0 1-6.924 6.72z" fill="#4285F4"/>
  </svg>
)

// DigitalOcean Icon
export const DigitalOceanIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="currentColor"
  >
    <path d="M12.04 0C5.408-.02.005 5.37.005 11.992h4.638c0-4.923 4.882-8.731 10.064-6.855a6.95 6.95 0 0 1 4.147 4.148c1.889 5.177-1.924 10.055-6.84 10.064v-4.61H7.391v4.623h4.61V24c7.86 0 13.967-7.588 11.397-15.83-1.115-3.58-3.985-6.45-7.565-7.565A12.07 12.07 0 0 0 12.039 0zM7.39 19.362H3.828v3.564H7.39zm-3.563 0v-2.978H.85v2.978z" fill="#0080FF"/>
  </svg>
)

// Linode Icon
export const LinodeIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="currentColor"
  >
    <path d="M10.813 0L1.22 5.217l1.575 1.92 6.558-2.1.394 4.02-5.902 2.588 1.313 1.838 5.377-1.575.919 7.95-4.463 1.707L8.566 24l6.952-3.412-1.444-7.82 4.727-1.314 1.182 3.807 2.494-1.838-1.707-5.507-5.246 1.182-.788-4.592 4.854-2.625-1.97-2.1z" fill="#00A95C"/>
  </svg>
)

// Vultr Icon
export const VultrIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="currentColor"
  >
    <path d="M8.36 2.172A1.194 1.194 0 0 0 7.26 2.87L.096 18.392A1.193 1.193 0 0 0 1.19 20.1h3.955a1.194 1.194 0 0 0 1.092-.71l4.704-10.466a.199.199 0 0 1 .364 0l2.261 4.963a.199.199 0 0 1-.182.28H11.46a1.194 1.194 0 0 0-1.09.71l-1.588 3.535a1.193 1.193 0 0 0 1.091 1.687h12.038a1.193 1.193 0 0 0 1.093-1.687L15.62 2.868a1.194 1.194 0 0 0-1.092-.71H8.36z" fill="#007BFC"/>
  </svg>
)

// IBM Cloud Icon
export const IBMCloudIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="currentColor"
  >
    <path d="M0 16.875h6.75v1.406H0zm0-2.813h6.75V15.47H0zm0-2.812h4.922v1.406H0zm0-2.813h4.922v1.407H0zM0 5.625h4.922v1.406H0zm0 2.813h6.75v1.406H0zm8.156 8.437h7.688v1.406H8.156zm0-2.813h7.688V15.47H8.156zm0-2.812h7.688v1.406H8.156zm0-2.813h7.688v1.407H8.156zm0-2.812h7.688v1.406H8.156zm0-2.813h7.688v1.407H8.156zm9.094 14.063H24v1.406h-6.75zm0-2.813H24V15.47h-6.75zm0-2.812h21.172v1.406H17.25zm0-2.813h21.172v1.407H17.25zm0-2.812h21.172v1.406H17.25zm0-2.813H24v1.407h-6.75z" fill="#1F70C1"/>
  </svg>
)

// MongoDB Atlas Icon (leaf logo)
export const MongoDBIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="currentColor"
  >
    <path d="M17.193 9.555c-1.264-5.58-4.252-7.414-4.573-8.115-.28-.394-.53-.954-.735-1.44-.036.495-.055.685-.523 1.184-.723.566-4.438 3.682-4.74 10.02-.282 5.912 4.27 9.435 4.888 9.884l.07.05A73.49 73.49 0 0 1 11.91 24h.213c.089-.574.196-1.15.33-1.72.468-.204.898-.46 1.284-.766.037-.029.073-.058.107-.09l.006-.004a7.024 7.024 0 0 0 3.343-5.865z" fill="#47A248"/>
    <path d="M12.123 24c-.089-.574-.196-1.15-.33-1.72-.468-.204-.898-.46-1.284-.766a7.025 7.025 0 0 1-3.107-5.545c-.015-.18-.025-.362-.03-.546-.07.654-.09 1.316-.055 1.982.18 3.449 2.413 5.437 4.477 6.532l.07.05A73.49 73.49 0 0 1 11.91 24h.213z" fill="#47A248" opacity="0.5"/>
  </svg>
)

// Generic Cloud Icon (fallback)
export const CloudIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="currentColor"
  >
    <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" fill="#6B7280"/>
  </svg>
)

// Inline icon components by provider id (for fallback when custom image is missing)
const PROVIDER_SVG_MAP: Record<string, React.FC<IconProps>> = {
  aws: AWSIcon,
  azure: AzureIcon,
  gcp: GCPIcon,
  google: GCPIcon,
  digitalocean: DigitalOceanIcon,
  do: DigitalOceanIcon,
  linode: LinodeIcon,
  akamai: LinodeIcon,
  vultr: VultrIcon,
  ibm: IBMCloudIcon,
  ibmcloud: IBMCloudIcon,
  mongodb: MongoDBIcon,
  mongodbatlas: MongoDBIcon,
  atlas: MongoDBIcon,
}

function getInlineIcon(providerId: string): React.FC<IconProps> {
  const id = providerId.toLowerCase()
  return PROVIDER_SVG_MAP[id] ?? CloudIcon
}

// Provider icon component: uses custom image from /icons/providers/{name}.svg or .png if present, else inline SVG
interface ProviderIconProps extends IconProps {
  providerId: string
}

export const ProviderIcon: React.FC<ProviderIconProps> = ({ providerId, className = '', size = 24 }) => {
  const filename = getProviderIconFilename(providerId)
  const [useFallback, setUseFallback] = useState(false)
  const InlineIcon = getInlineIcon(providerId)

  // No custom path for this provider, or we already failed loading custom icon
  if (!filename || useFallback) {
    return <InlineIcon className={className} size={size} />
  }

  // Try SVG first, then PNG (img onError will trigger fallback)
  const svgSrc = `${PROVIDER_ICONS_BASE}/${filename}.svg`
  const pngSrc = `${PROVIDER_ICONS_BASE}/${filename}.png`

  return (
    <ProviderIconImage
      src={svgSrc}
      fallbackSrc={pngSrc}
      alt=""
      width={size}
      height={size}
      className={className}
      onError={() => setUseFallback(true)}
    />
  )
}

// Renders img; on error tries fallbackSrc (PNG) once, then calls onError so parent can render inline SVG
function ProviderIconImage({
  src,
  fallbackSrc,
  alt,
  width,
  height,
  className,
  onError,
}: {
  src: string
  fallbackSrc: string
  alt: string
  width: number
  height: number
  className: string
  onError: () => void
}) {
  const [tryPng, setTryPng] = useState(false)
  const currentSrc = tryPng ? fallbackSrc : src

  const handleError = () => {
    if (!tryPng) {
      setTryPng(true)
    } else {
      onError()
    }
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading="lazy"
      onError={handleError}
      style={{ objectFit: 'contain' }}
    />
  )
}

// Helper to get provider color
export const getProviderColor = (providerId: string): string => {
  const id = providerId.toLowerCase()
  
  switch (id) {
    case 'aws':
      return '#FF9900'
    case 'azure':
      return '#0078D4'
    case 'gcp':
    case 'google':
      return '#4285F4'
    case 'digitalocean':
    case 'do':
      return '#0080FF'
    case 'linode':
    case 'akamai':
      return '#00A95C'
    case 'vultr':
      return '#007BFC'
    case 'ibm':
    case 'ibmcloud':
      return '#1F70C1'
    case 'mongodb':
    case 'mongodbatlas':
    case 'atlas':
      return '#47A248'
    default:
      return '#6B7280'
  }
}

export default ProviderIcon
