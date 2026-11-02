import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Home,
  LogOut,
  Plus,
  UserRoundPen,
  UsersRound,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import NotificationBell from './NotificationBell'

function isActive(location, path) {
  if (path === '/student#classes') {
    return location.hash === '#classes' || location.pathname.startsWith('/student/classes/')
  }
  if (path === '/professor#classes') {
    return location.hash === '#classes' || location.pathname.startsWith('/professor/classes/')
  }
  if (path === '/professor#schedule') return location.hash === '#schedule'
  return location.pathname === path
}

export default function Header({ onOpenJoinClass }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const rolePath = { ADMIN: '/admin', PROFESSOR: '/professor', STUDENT: '/student' }[user?.role]

  const navItems = user?.role === 'STUDENT'
    ? [
        { label: 'My dashboard', path: '/student', icon: Home },
        { label: 'My classes', path: '/student#classes', icon: BookOpen },
        { label: 'Join a class', action: onOpenJoinClass, icon: Plus },
        { label: 'Edit profile', path: '/profile', icon: UserRoundPen },
      ]
    : user?.role === 'PROFESSOR'
      ? [
          { label: 'Teaching dashboard', path: '/professor', icon: Home },
          { label: 'My classes', path: '/professor#classes', icon: BookOpen },
          { label: 'My schedule', path: '/professor#schedule', icon: CalendarDays },
          { label: 'Edit profile', path: '/profile', icon: UserRoundPen },
        ]
      : user?.role === 'ADMIN'
        ? [
            { label: 'Admin dashboard', path: '/admin', icon: Home },
            { label: 'Subjects', path: '/admin/subjects', icon: BookOpen },
            { label: 'Class offerings', path: '/admin/classes', icon: CalendarDays },
            { label: 'Create professor', path: '/admin/professors/new', icon: UsersRound },
          ]
        : []

  return (
    <>
      {user && (
        <aside className="app-sidebar" aria-label="Main navigation">
          <Link className="sidebar-brand" to={rolePath || '/'} aria-label="The Learniverse dashboard">
            <span className="brand-mark"><BookOpen size={19} /></span>
          </Link>
          <nav className="sidebar-nav">
            {navItems.map(({ label, path, action, icon: Icon }) => {
              const active = path ? isActive(location, path) : false
              return path ? (
                <Link
                  key={label}
                  className={`sidebar-link${active ? ' active' : ''}`}
                  to={path}
                  aria-label={label}
                  aria-current={active ? 'page' : undefined}
                  title={label}
                >
                  <Icon size={17} />
                  <span className="sidebar-tooltip" role="tooltip">{label}</span>
                </Link>
              ) : (
                <button key={label} className="sidebar-link" type="button" onClick={action} aria-label={label} title={label}>
                  <Icon size={17} />
                  <span className="sidebar-tooltip" role="tooltip">{label}</span>
                </button>
              )
            })}
          </nav>
          <button className="sidebar-link sidebar-logout" type="button" onClick={logout} aria-label="Sign out" title="Sign out">
            <LogOut size={17} />
            <span className="sidebar-tooltip" role="tooltip">Sign out</span>
          </button>
        </aside>
      )}
      <header className="site-header">
        {user ? (
          <div className="site-header-user">
              <Link className="brand header-brand" to={rolePath || '/'} aria-label="The Learniverse dashboard">
                <span className="brand-mark"><BookOpen size={19} /></span>
                <span>The <span className="brand-light">Learniverse</span></span>
              </Link>
              <div className="site-header-actions">
                <NotificationBell />
                <span className="user-chip">
                  <span className="avatar">{user.profileImage ? <img src={user.profileImage} alt="" /> : user.fullName?.charAt(0)?.toUpperCase()}</span>
                  <span className="user-chip-name">{user.fullName}</span>
                </span>
              </div>
          </div>
        ) : (
          <>
            <Link className="brand" to="/" aria-label="The Learniverse home">
              <span className="brand-mark"><BookOpen size={20} /></span>
              <span>The <span className="brand-light">Learniverse</span></span>
            </Link>
            <nav className="site-nav" aria-label="Main navigation">
              <Link className={location.pathname === '/login' ? 'nav-active' : ''} to="/login" viewTransition>Sign in</Link>
              <Link className="nav-join" to="/register" viewTransition>Join the community <ArrowUpRight size={15} /></Link>
            </nav>
          </>
        )}
      </header>
    </>
  )
}
