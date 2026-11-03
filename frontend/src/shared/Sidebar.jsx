import {
  BookOpen,
  CalendarPlus,
  CalendarDays,
  Home,
  LogOut,
  NotebookPen,
  UserRoundPen,
  UsersRound,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import StudentSidebar from './StudentSidebar'

function isActive(location, path) {
  if (path === '/student#classes') {
    return location.hash === '#classes' || location.pathname.startsWith('/student/classes/')
  }
  if (path === '/professor#classes') {
    return location.hash === '#classes' || (location.pathname.startsWith('/professor/classes/') && location.pathname !== '/professor/classes/new')
  }
  if (path === '/professor#schedule') return location.hash === '#schedule'
  return location.pathname === path
}

export default function Sidebar({ onOpenJoinClass, onOpenQuickNotes, quickNotesOpen = false, onRequestSignOut }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const rolePath = { ADMIN: '/admin', PROFESSOR: '/professor', STUDENT: '/student' }[user?.role]

  if (user?.role === 'STUDENT') {
    return (
      <StudentSidebar
        onOpenJoinClass={onOpenJoinClass}
        onOpenQuickNotes={onOpenQuickNotes}
        quickNotesOpen={quickNotesOpen}
        onRequestSignOut={onRequestSignOut}
      />
    )
  }

  const navItems = user?.role === 'PROFESSOR'
    ? [
          { label: 'Teaching dashboard', path: '/professor', icon: Home },
          { label: 'My classes', path: '/professor#classes', icon: BookOpen },
          { label: 'Create class', path: '/professor/classes/new', icon: CalendarPlus },
          { label: 'My schedule', path: '/professor#schedule', icon: CalendarDays },
          { label: 'Quick Notes', action: onOpenQuickNotes, icon: NotebookPen },
          { label: 'Edit profile', path: '/profile', icon: UserRoundPen },
        ]
    : user?.role === 'ADMIN'
      ? [
            { label: 'Admin dashboard', path: '/admin', icon: Home },
            { label: 'Subjects', path: '/admin/subjects', icon: BookOpen },
            { label: 'Class offerings', path: '/admin/classes', icon: CalendarDays },
            { label: 'Professors', path: '/admin/professors', icon: UsersRound },
            { label: 'Create professor', path: '/admin/professors/new', icon: UsersRound },
          ]
      : []

  if (!user) return null

  return (
    <aside className="app-sidebar" aria-label="Main navigation">
      <Link className="sidebar-brand" to={rolePath || '/'} aria-label="The Learniverse dashboard">
        <span className="brand-mark"><BookOpen size={19} /></span>
        <span className="sidebar-brand-label">The Learniverse</span>
      </Link>
      <nav className="sidebar-nav">
        {navItems.map(({ label, path, action, icon: Icon }) => {
          const active = label === 'Quick Notes' ? quickNotesOpen : path ? isActive(location, path) : false
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
            <button
              key={label}
              className={`sidebar-link${active ? ' active' : ''}`}
              type="button"
              onClick={action}
              aria-label={label}
              aria-pressed={label === 'Quick Notes' ? quickNotesOpen : undefined}
              title={label}
            >
              <Icon size={17} />
              <span className="sidebar-tooltip" role="tooltip">{label}</span>
            </button>
          )
        })}
      </nav>
      <button
        className="sidebar-link sidebar-logout"
        type="button"
        onClick={user.role === 'PROFESSOR' && onRequestSignOut ? onRequestSignOut : logout}
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut size={17} />
        <span className="sidebar-tooltip" role="tooltip">Sign out</span>
      </button>
    </aside>
  )
}
