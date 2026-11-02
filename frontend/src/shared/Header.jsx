import {
  ArrowUpRight,
  BookOpen,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import NotificationBell from './NotificationBell'

export default function Header() {
  const { user } = useAuth()
  const location = useLocation()
  const rolePath = { ADMIN: '/admin', PROFESSOR: '/professor', STUDENT: '/student' }[user?.role]

  return (
    <>
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
