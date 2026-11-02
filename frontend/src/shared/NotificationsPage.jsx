import { useEffect, useState } from 'react'
import { Bell, BookOpenCheck, Check, ClipboardCheck, GraduationCap, Megaphone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, useAuth } from '../auth/AuthContext'
import './notifications.css'

const PAGE_SIZE = 20

function notificationIcon(type) {
  if (type === 'grade_posted' || type === 'deadline_reminder') return ClipboardCheck
  if (type === 'student_enrolled' || type === 'class_updated') return GraduationCap
  if (type === 'online_quiz_published') return BookOpenCheck
  return Megaphone
}

function formatNotificationTime(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default function NotificationsPage() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api.get('/notifications', { params: { limit: PAGE_SIZE } })
      .then(({ data }) => {
        if (!active) return
        setNotifications(data.notifications)
        setUnreadCount(data.unreadCount)
        setCursor(data.nextCursor)
        setHasMore(data.hasMore)
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Notifications could not be loaded.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function loadMore() {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    setError('')
    try {
      const { data } = await api.get('/notifications', { params: { limit: PAGE_SIZE, before: cursor } })
      setNotifications((current) => [...current, ...data.notifications])
      setUnreadCount(data.unreadCount)
      setCursor(data.nextCursor)
      setHasMore(data.hasMore)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Older notifications could not be loaded.')
    } finally {
      setLoadingMore(false)
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
      window.dispatchEvent(new Event('notifications-updated'))
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Notification could not be updated.')
    }
  }

  async function markAllRead() {
    try {
      const { data } = await api.patch('/notifications/read-all')
      setUnreadCount(data.unreadCount)
      setNotifications((current) => current.map((notification) => ({ ...notification, readAt: notification.readAt || new Date().toISOString() })))
      window.dispatchEvent(new Event('notifications-updated'))
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Notifications could not be updated.')
    }
  }

  const dashboardPath = user?.role === 'PROFESSOR' ? '/professor' : '/student'

  return (
    <main className="notifications-page">
      <Link className="notifications-back" to={dashboardPath}>← Back to dashboard</Link>
      <header className="notifications-heading">
        <span className="notifications-eyebrow"><Bell size={14} /> YOUR UPDATES</span>
        <div>
          <div><h1>Notifications</h1><p>Class updates, new learning materials, and assessment feedback.</p></div>
          {unreadCount > 0 && <button className="notifications-mark-all" type="button" onClick={markAllRead}><Check size={15} /> Mark all as read</button>}
        </div>
      </header>
      {error && <p className="notifications-error" role="alert">{error}</p>}
      {loading ? <p className="notifications-empty">Loading your notifications…</p> : notifications.length ? (
        <section className="notifications-list" aria-label="All notifications">
          {notifications.map((notification) => {
            const Icon = notificationIcon(notification.type)
            return (
              <Link
                className={`notifications-row${notification.readAt ? '' : ' unread'}`}
                key={notification._id}
                to={notification.href}
                onClick={() => { if (!notification.readAt) void markRead(notification._id) }}
              >
                <span className="notifications-icon"><Icon size={18} /></span>
                <span className="notifications-copy">
                  <strong>{notification.title}</strong>
                  <span>{notification.message}</span>
                  <time dateTime={notification.createdAt}>{formatNotificationTime(notification.createdAt)}</time>
                </span>
                {!notification.readAt && <span className="notifications-unread-label">Unread</span>}
              </Link>
            )
          })}
        </section>
      ) : <div className="notifications-empty"><Bell size={26} /><strong>No notifications yet</strong><span>Updates from your classes and professors will appear here.</span></div>}
      {hasMore && <button className="notifications-load-more" type="button" disabled={loadingMore} onClick={loadMore}>{loadingMore ? 'Loading…' : 'Load older notifications'}</button>}
    </main>
  )
}
