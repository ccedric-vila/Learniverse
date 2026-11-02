import { useEffect, useRef, useState } from 'react'
import { Bell, BookOpenCheck, Check, ClipboardCheck, GraduationCap, Megaphone } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { api, useAuth } from '../auth/AuthContext'

function notificationIcon(type) {
  if (type === 'grade_posted' || type === 'deadline_reminder') return ClipboardCheck
  if (type === 'student_enrolled' || type === 'class_updated') return GraduationCap
  if (type === 'online_quiz_published') return BookOpenCheck
  return Megaphone
}

function formatNotificationTime(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default function NotificationBell() {
  const { user } = useAuth()
  const location = useLocation()
  const panelRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user || !['STUDENT', 'PROFESSOR'].includes(user.role)) return undefined

    let active = true
    async function refreshUnreadCount() {
      try {
        const { data } = await api.get('/notifications', { params: { limit: 1 } })
        if (active) setUnreadCount(data.unreadCount)
      } catch {
        if (active) setError('Notifications could not be loaded.')
      }
    }

    window.addEventListener('notifications-updated', refreshUnreadCount)
    void refreshUnreadCount()
    const timer = window.setInterval(refreshUnreadCount, 60_000)
    return () => {
      active = false
      window.removeEventListener('notifications-updated', refreshUnreadCount)
      window.clearInterval(timer)
    }
  }, [user, location.pathname])

  useEffect(() => {
    if (!open) return undefined
    function closeOnOutsideClick(event) {
      if (!panelRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [open])

  async function loadNotifications() {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/notifications', { params: { limit: 6 } })
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Notifications could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  async function togglePanel() {
    const willOpen = !open
    setOpen(willOpen)
    if (willOpen) await loadNotifications()
  }

  async function markAllRead() {
    try {
      const { data } = await api.patch('/notifications/read-all')
      setUnreadCount(data.unreadCount)
      setNotifications((current) => current.map((notification) => ({ ...notification, readAt: notification.readAt || new Date().toISOString() })))
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Notifications could not be updated.')
    }
  }

  async function markRead(notificationId) {
    try {
      const { data } = await api.patch(`/notifications/${notificationId}/read`)
      setUnreadCount(data.unreadCount)
      setNotifications((current) => current.map((notification) => (
        notification._id === notificationId
          ? { ...notification, readAt: notification.readAt || new Date().toISOString() }
          : notification
      )))
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Notification could not be updated.')
    }
  }

  if (!user || !['STUDENT', 'PROFESSOR'].includes(user.role)) return null

  return (
    <div className="notification-bell-wrap" ref={panelRef}>
      <button
        className="notification-bell"
        type="button"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        aria-controls="notification-popover"
        onClick={togglePanel}
      >
        <Bell size={19} />
        {unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>
      {open && (
        <section className="notification-popover" id="notification-popover" aria-label="Recent notifications">
          <header className="notification-popover-header">
            <div><strong>Notifications</strong><span>{unreadCount ? `${unreadCount} unread` : 'You’re all caught up'}</span></div>
            {unreadCount > 0 && <button type="button" onClick={markAllRead}><Check size={14} /> Mark all read</button>}
          </header>
          {error && <p className="notification-inline-error" role="alert">{error}</p>}
          {loading ? <p className="notification-popover-empty">Loading notifications…</p> : notifications.length ? (
            <div className="notification-popover-list">
              {notifications.map((notification) => {
                const Icon = notificationIcon(notification.type)
                return (
                  <Link
                    className={`notification-item${notification.readAt ? '' : ' unread'}`}
                    key={notification._id}
                    to={notification.href}
                    onClick={() => {
                      setOpen(false)
                      if (!notification.readAt) void markRead(notification._id)
                    }}
                  >
                    <span className="notification-item-icon"><Icon size={16} /></span>
                    <span className="notification-item-copy">
                      <strong>{notification.title}</strong>
                      <span>{notification.message}</span>
                      <time dateTime={notification.createdAt}>{formatNotificationTime(notification.createdAt)}</time>
                    </span>
                    {!notification.readAt && <span className="notification-unread-dot" aria-label="Unread" />}
                  </Link>
                )
              })}
            </div>
          ) : !error && <p className="notification-popover-empty">No notifications yet. New updates from your classes will show up here.</p>}
          <Link className="notification-view-all" to="/notifications" onClick={() => setOpen(false)}>View all notifications</Link>
        </section>
      )}
    </div>
  )
}
