import { useEffect } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'

export type NotificationType = 'success' | 'error' | 'warning' | 'info'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message?: string
  duration?: number
}

interface NotificationProps {
  notification: Notification
  onClose: (id: string) => void
}

export default function Notification({ notification, onClose }: NotificationProps) {
  const { id, type, title, message, duration = 5000 } = notification

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id)
    }, duration)

    return () => clearTimeout(timer)
  }, [id, duration, onClose])

  const icons = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
  }

  const colors = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  }

  const iconColors = {
    success: 'text-green-600',
    error: 'text-red-600',
    warning: 'text-yellow-600',
    info: 'text-blue-600',
  }

  const Icon = icons[type]

  return (
    <div
      className={`
        relative flex items-start gap-3 p-4 rounded-xl border shadow-lg
        animate-slide-in-right
        ${colors[type]}
        max-w-md
      `}
      role="alert"
    >
      <div className={`flex-shrink-0 ${iconColors[type]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{title}</p>
        {message && (
          <p className="mt-1 text-sm opacity-90 whitespace-pre-line">{message}</p>
        )}
      </div>
      <button
        onClick={() => onClose(id)}
        className={`
          flex-shrink-0 p-1 rounded-lg hover:bg-black/10 transition-colors
          ${iconColors[type]} opacity-70 hover:opacity-100
        `}
        aria-label="Close notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
