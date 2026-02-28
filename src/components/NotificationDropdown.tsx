import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CheckCheck, AlertTriangle, DollarSign, TrendingUp, FileText, Info, AlertCircle, Loader, Check, X } from 'lucide-react'
import { notificationsAPI } from '../services/api'
import { useNotification } from '../contexts/NotificationContext'

interface Notification {
  id: number
  type: 'budget' | 'anomaly' | 'sync' | 'report' | 'warning' | 'info' | 'success'
  title: string
  message?: string
  link?: string
  linkText?: string
  isRead: boolean
  metadata?: any
  createdAt: string
  readAt?: string
}

type FilterTab = 'all' | 'alerts' | 'info' | 'success'

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'info', label: 'Info' },
  { id: 'success', label: 'Success' },
]

const FILTER_TYPE_MAP: Record<FilterTab, Notification['type'][] | null> = {
  all: null,
  alerts: ['anomaly', 'warning', 'budget'],
  info: ['info', 'sync', 'report'],
  success: ['success'],
}

interface NotificationDropdownProps {
  isOpen: boolean
  onClose: () => void
}

// --- Swipeable notification item ---

interface SwipeableItemProps {
  notification: Notification
  onDelete: (id: number) => void
  onMarkRead: (id: number) => void
  onClose: () => void
}

function SwipeableNotificationItem({ notification, onDelete, onMarkRead, onClose }: SwipeableItemProps) {
  const [offsetX, setOffsetX] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const isHorizontalSwipe = useRef<boolean | null>(null)

  const SWIPE_THRESHOLD = 80

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    isHorizontalSwipe.current = null
    setIsSwiping(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current

    // Determine swipe direction on first significant movement
    if (isHorizontalSwipe.current === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        isHorizontalSwipe.current = Math.abs(dx) > Math.abs(dy)
      }
      return
    }

    if (!isHorizontalSwipe.current) return

    // Allow swiping left (delete) freely, dampen right swipe
    const clamped = dx < 0 ? Math.max(dx, -160) : Math.min(dx * 0.3, 60)
    setOffsetX(clamped)
  }

  const handleTouchEnd = () => {
    setIsSwiping(false)
    isHorizontalSwipe.current = null

    if (offsetX < -SWIPE_THRESHOLD) {
      // Swipe left - delete
      setIsExiting(true)
      setTimeout(() => onDelete(notification.id), 300)
    } else if (offsetX > SWIPE_THRESHOLD / 2 && !notification.isRead) {
      // Swipe right - mark as read
      onMarkRead(notification.id)
      setOffsetX(0)
    } else {
      setOffsetX(0)
    }
  }

  const handleClick = () => {
    if (Math.abs(offsetX) > 4) return // Ignore clicks during swipe
    if (!notification.isRead) {
      onMarkRead(notification.id)
    }
  }

  const Icon = getNotificationIcon(notification.type)
  const iconClasses = getNotificationIconClasses(notification.type)

  return (
    <div className={`relative overflow-hidden group ${isExiting ? 'animate-slide-out-left' : ''}`}>
      {/* Delete backdrop (revealed on swipe left) */}
      <div className="absolute inset-0 bg-red-500 dark:bg-red-600 flex items-center justify-end pr-6">
        <span className="text-white text-sm font-medium">Delete</span>
      </div>

      {/* Mark-read backdrop (revealed on swipe right) */}
      {!notification.isRead && (
        <div className="absolute inset-0 bg-accent-500 flex items-center pl-6">
          <span className="text-white text-sm font-medium">Mark read</span>
        </div>
      )}

      {/* Main card */}
      <div
        className={`
          relative px-4 py-3 bg-white dark:bg-gray-800 cursor-pointer
          transition-colors hover:bg-surface-50 dark:hover:bg-gray-700/50
          ${!isSwiping ? 'transition-transform duration-200' : ''}
        `}
        style={{ transform: `translateX(${offsetX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
      >
        <div className="flex items-start gap-3">
          {/* Unread dot */}
          <div className="flex-shrink-0 w-2 pt-4">
            {!notification.isRead && (
              <div className="w-2 h-2 rounded-full bg-accent-500" />
            )}
          </div>

          {/* Icon */}
          <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${iconClasses}`}>
            <Icon className="h-4 w-4" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className={`text-sm leading-snug ${!notification.isRead ? 'font-semibold text-gray-900 dark:text-gray-100' : 'font-medium text-gray-500 dark:text-gray-400'}`}>
              {notification.title}
            </p>
            {notification.message && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{notification.message}</p>
            )}
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[11px] text-gray-400 dark:text-gray-500">{formatTimeAgo(notification.createdAt)}</span>
              {notification.link && (
                <Link
                  to={notification.link}
                  onClick={(e) => { e.stopPropagation(); onClose() }}
                  className="text-[11px] text-accent-500 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300 font-medium"
                >
                  {notification.linkText || 'View details'} &rarr;
                </Link>
              )}
            </div>
          </div>

          {/* Desktop hover delete */}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(notification.id) }}
            className="flex-shrink-0 p-1 rounded-md text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"
            title="Delete"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Helper functions (module-level) ---

function getNotificationIcon(type: Notification['type']) {
  switch (type) {
    case 'budget': return DollarSign
    case 'anomaly': return AlertTriangle
    case 'sync': return TrendingUp
    case 'report': return FileText
    case 'warning': return AlertCircle
    case 'info': return Info
    case 'success': return Check
    default: return Bell
  }
}

function getNotificationIconClasses(type: Notification['type']) {
  switch (type) {
    case 'budget':
    case 'warning':
      return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30'
    case 'anomaly':
      return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30'
    case 'sync':
      return 'text-accent-600 bg-accent-50 dark:text-accent-400 dark:bg-accent-900/30'
    case 'report':
    case 'info':
      return 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30'
    case 'success':
      return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/30'
    default:
      return 'text-gray-500 bg-gray-100 dark:text-gray-400 dark:bg-gray-700'
  }
}

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'Just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
  return date.toLocaleDateString()
}

function getDateGroup(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const notifDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (notifDate.getTime() >= today.getTime()) return 'Today'
  if (notifDate.getTime() >= yesterday.getTime()) return 'Yesterday'
  return 'Earlier'
}

// --- Main dropdown ---

export default function NotificationDropdown({ isOpen, onClose }: NotificationDropdownProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isMarkingAll, setIsMarkingAll] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { showSuccess, showError } = useNotification()

  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true)
      const [notificationsResponse, countResponse] = await Promise.all([
        notificationsAPI.getNotifications({ limit: 20 }),
        notificationsAPI.getUnreadCount()
      ])
      setNotifications(notificationsResponse.data || [])
      setUnreadCount(countResponse.count || 0)
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
      showError('Failed to load notifications', 'Please try again later')
    } finally {
      setIsLoading(false)
    }
  }, [showError])

  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
      setActiveFilter('all')
    }
  }, [isOpen, fetchNotifications])

  // Poll every 30s when open
  useEffect(() => {
    if (!isOpen) return
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [isOpen, fetchNotifications])

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  const handleMarkAsRead = useCallback(async (notificationId: number) => {
    try {
      await notificationsAPI.markAsRead(notificationId)
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
        )
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }, [])

  const handleMarkAllAsRead = async () => {
    try {
      setIsMarkingAll(true)
      await notificationsAPI.markAllAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      setUnreadCount(0)
      showSuccess('All notifications marked as read')
    } catch (error) {
      console.error('Failed to mark all as read:', error)
      showError('Failed to mark all notifications as read')
    } finally {
      setIsMarkingAll(false)
    }
  }

  const handleDelete = useCallback(async (notificationId: number) => {
    try {
      await notificationsAPI.deleteNotification(notificationId)
      const notification = notifications.find(n => n.id === notificationId)
      if (notification && !notification.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
    } catch (error) {
      console.error('Failed to delete notification:', error)
      showError('Failed to delete notification')
    }
  }, [notifications, showError])

  // Filter + group
  const filteredNotifications = useMemo(() => {
    const types = FILTER_TYPE_MAP[activeFilter]
    if (!types) return notifications
    return notifications.filter(n => types.includes(n.type))
  }, [notifications, activeFilter])

  const groupedNotifications = useMemo(() => {
    const groups: { label: string; items: Notification[] }[] = []
    const groupMap = new Map<string, Notification[]>()

    for (const n of filteredNotifications) {
      const group = getDateGroup(n.createdAt)
      if (!groupMap.has(group)) {
        groupMap.set(group, [])
      }
      groupMap.get(group)!.push(n)
    }

    // Maintain order: Today, Yesterday, Earlier
    for (const label of ['Today', 'Yesterday', 'Earlier']) {
      const items = groupMap.get(label)
      if (items && items.length > 0) {
        groups.push({ label, items })
      }
    }

    return groups
  }, [filteredNotifications])

  // Count per filter for badges
  const filterCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = { all: 0, alerts: 0, info: 0, success: 0 }
    for (const n of notifications) {
      if (!n.isRead) {
        counts.all++
        for (const [key, types] of Object.entries(FILTER_TYPE_MAP)) {
          if (types && types.includes(n.type)) {
            counts[key as FilterTab]++
          }
        }
      }
    }
    return counts
  }, [notifications])

  if (!isOpen) return null

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-[400px] bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-surface-200 dark:border-gray-700 z-50 max-h-[560px] flex flex-col animate-fade-in"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Notifications</h3>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              disabled={isMarkingAll}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-surface-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {isMarkingAll ? (
                <Loader className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCheck className="h-3 w-3" />
              )}
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-surface-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 px-5 pb-3">
        {FILTER_TABS.map(tab => {
          const count = filterCounts[tab.id]
          const isActive = activeFilter === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
                ${isActive
                  ? 'bg-accent-50 dark:bg-accent-900/40 text-accent-700 dark:text-accent-300 ring-1 ring-accent-200 dark:ring-accent-800'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-surface-50 dark:hover:bg-gray-700'
                }
              `}
            >
              {tab.label}
              {count > 0 && (
                <span className={`ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold ${
                  isActive
                    ? 'bg-accent-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Divider */}
      <div className="border-t border-surface-200 dark:border-gray-700" />

      {/* Notifications List */}
      <div className="overflow-y-auto flex-1 overscroll-contain">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader className="h-5 w-5 animate-spin text-accent-500" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-12 h-12 rounded-2xl bg-surface-100 dark:bg-gray-700 flex items-center justify-center mb-3">
              <Bell className="h-6 w-6 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {activeFilter === 'all' ? 'No notifications' : `No ${activeFilter} notifications`}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">You're all caught up!</p>
          </div>
        ) : (
          <div>
            {groupedNotifications.map((group, gi) => (
              <div key={group.label}>
                {/* Date group header */}
                <div className="sticky top-0 z-10 px-5 py-2 bg-surface-50/80 dark:bg-gray-800/80 backdrop-blur-sm">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    {group.label}
                  </span>
                </div>

                {/* Items */}
                <div className="space-y-px">
                  {group.items.map((notification, ni) => (
                    <div
                      key={notification.id}
                      className="animate-slide-up"
                      style={{ animationDelay: `${(gi * 3 + ni) * 30}ms`, animationFillMode: 'both' }}
                    >
                      <SwipeableNotificationItem
                        notification={notification}
                        onDelete={handleDelete}
                        onMarkRead={handleMarkAsRead}
                        onClose={onClose}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
