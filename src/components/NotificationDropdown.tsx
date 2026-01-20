import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Bell, X, Check, CheckCheck, Trash2, AlertTriangle, DollarSign, TrendingUp, FileText, Info, AlertCircle, Loader } from 'lucide-react'
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

interface NotificationDropdownProps {
  isOpen: boolean
  onClose: () => void
}

export default function NotificationDropdown({ isOpen, onClose }: NotificationDropdownProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isMarkingAll, setIsMarkingAll] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { showSuccess, showError } = useNotification()

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      setIsLoading(true)
      const [notificationsResponse, countResponse] = await Promise.all([
        notificationsAPI.getNotifications({ limit: 20 }),
        notificationsAPI.getUnreadCount()
      ])
      setNotifications(notificationsResponse.notifications || [])
      setUnreadCount(countResponse.count || 0)
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
      showError('Failed to load notifications', 'Please try again later')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
    }
  }, [isOpen])

  // Poll for new notifications every 30 seconds when dropdown is open
  useEffect(() => {
    if (!isOpen) return

    const interval = setInterval(() => {
      fetchNotifications()
    }, 30000) // Poll every 30 seconds

    return () => clearInterval(interval)
  }, [isOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  const handleMarkAsRead = async (notificationId: number) => {
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
      showError('Failed to mark notification as read')
    }
  }

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

  const handleDelete = async (notificationId: number) => {
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
  }

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'budget':
        return DollarSign
      case 'anomaly':
        return AlertTriangle
      case 'sync':
        return TrendingUp
      case 'report':
        return FileText
      case 'warning':
        return AlertCircle
      case 'info':
        return Info
      case 'success':
        return Check
      default:
        return Bell
    }
  }

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'budget':
        return 'text-[#F59E0B] bg-[#FEF3C7]'
      case 'anomaly':
        return 'text-[#DC2626] bg-[#FEE2E2]'
      case 'sync':
        return 'text-[#22B8A0] bg-[#F0FDFA]'
      case 'report':
        return 'text-[#1F3A5F] bg-[#EFF6FF]'
      case 'warning':
        return 'text-[#F59E0B] bg-[#FEF3C7]'
      case 'info':
        return 'text-[#1F3A5F] bg-[#EFF6FF]'
      case 'success':
        return 'text-[#16A34A] bg-[#F0FDF4]'
      default:
        return 'text-[#64748B] bg-[#F1F5F9]'
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
    return date.toLocaleDateString()
  }

  if (!isOpen) return null

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-xl border border-[#E2E8F0] z-50 max-h-[600px] flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#E2E8F0]">
        <h3 className="text-lg font-semibold text-[#0F172A]">Notifications</h3>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              disabled={isMarkingAll}
              className="text-xs text-[#64748B] hover:text-[#0F172A] flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[#F8FAFC] transition-colors disabled:opacity-50"
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
            className="p-1 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] rounded-lg transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="overflow-y-auto flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="h-6 w-6 animate-spin text-[#22B8A0]" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <Bell className="h-12 w-12 text-[#64748B] mb-3" />
            <p className="text-sm text-[#64748B] text-center">No notifications</p>
            <p className="text-xs text-[#64748B] text-center mt-1">You're all caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-[#E2E8F0]">
            {notifications.map((notification) => {
              const Icon = getNotificationIcon(notification.type)
              const iconColor = getNotificationColor(notification.type)

              return (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-[#F8FAFC] transition-colors ${
                    !notification.isRead ? 'bg-[#F0FDFA]' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${iconColor}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${!notification.isRead ? 'text-[#0F172A]' : 'text-[#64748B]'}`}>
                            {notification.title}
                          </p>
                          {notification.message && (
                            <p className="text-xs text-[#64748B] mt-1 line-clamp-2">{notification.message}</p>
                          )}
                          <p className="text-xs text-[#64748B] mt-1">{formatTimeAgo(notification.createdAt)}</p>
                          {notification.link && (
                            <Link
                              to={notification.link}
                              onClick={onClose}
                              className="text-xs text-[#22B8A0] hover:text-[#1F3A5F] mt-1 inline-block font-medium"
                            >
                              {notification.linkText || 'View details'} →
                            </Link>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {!notification.isRead && (
                            <button
                              onClick={() => handleMarkAsRead(notification.id)}
                              className="p-1 text-[#64748B] hover:text-[#22B8A0] hover:bg-[#F0FDFA] rounded transition-colors"
                              title="Mark as read"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(notification.id)}
                            className="p-1 text-[#64748B] hover:text-[#DC2626] hover:bg-[#FEE2E2] rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
