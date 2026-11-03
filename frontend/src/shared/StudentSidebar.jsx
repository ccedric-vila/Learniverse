import { BookOpen, Home, ListChecks, LogOut, NotebookPen, Plus, UserRoundPen } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function StudentSidebar({ onOpenJoinClass, onOpenQuickNotes, quickNotesOpen = false, onRequestSignOut }) {
  const { user, logout } = useAuth()
  const location = useLocation()

  if (user?.role !== 'STUDENT') return null

  const navItems = [
    { label: 'My dashboard', path: '/student', icon: Home },
    { label: 'My classes', path: '/student#classes', icon: BookOpen },
    { label: 'Join a class', action: onOpenJoinClass, icon: Plus },
    { label: 'To-Do', path: '/student/todo', icon: ListChecks },
    { label: 'Quick Notes', action: onOpenQuickNotes, icon: NotebookPen },
    { label: 'Edit profile', path: '/profile', icon: UserRoundPen },
  ]

  return (
    <aside className="app-sidebar" aria-label="Student navigation">
      <Link className="sidebar-brand" to="/student" aria-label="The Learniverse dashboard">
        <span className="brand-mark"><BookOpen size={19} /></span>
        <span className="sidebar-brand-label">The Learniverse</span>
      </Link>
      <nav className="sidebar-nav">
        {navItems.map(({ label, path, action, icon: Icon }) => {
          const active = label === 'Quick Notes' ? quickNotesOpen : path === '/student#classes'
            ? location.hash === '#classes' || location.pathname.startsWith('/student/classes/')
            : location.pathname === path
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
      <button className="sidebar-link sidebar-logout" type="button" onClick={onRequestSignOut || logout} aria-label="Sign out" title="Sign out">
        <LogOut size={17} />
        <span className="sidebar-tooltip" role="tooltip">Sign out</span>
      </button>
    </aside>
  )
}
