import {
  ArrowUpRight,
  BookOpen,
  Moon,
  Sun,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import NotificationBell from './NotificationBell'

export default function Header({ professorTheme, onToggleProfessorTheme, studentTheme, onToggleStudentTheme, adminTheme, onToggleAdminTheme }) {
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
                {user.role === 'PROFESSOR' && (
                  <button
                    className="professor-theme-toggle"
                    type="button"
                    aria-label={`Switch to ${professorTheme === 'dark' ? 'light' : 'dark'} theme`}
                    aria-pressed={professorTheme === 'dark'}
                    title={`Switch to ${professorTheme === 'dark' ? 'light' : 'dark'} theme`}
                    onClick={onToggleProfessorTheme}
                  >
                    {professorTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                  </button>
                )}
                {user.role === 'STUDENT' && (
                  <button
                    className="student-theme-toggle"
                    type="button"
                    aria-label={`Switch to ${studentTheme === 'dark' ? 'light' : 'dark'} theme`}
                    aria-pressed={studentTheme === 'dark'}
                    title={`Switch to ${studentTheme === 'dark' ? 'light' : 'dark'} theme`}
                    onClick={onToggleStudentTheme}
                  >
                    {studentTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                  </button>
                )}
                {user.role === 'ADMIN' && (
                  <button
                    className="admin-theme-toggle"
                    type="button"
                    aria-label={`Switch to ${adminTheme === 'dark' ? 'light' : 'dark'} theme`}
                    aria-pressed={adminTheme === 'dark'}
                    title={`Switch to ${adminTheme === 'dark' ? 'light' : 'dark'} theme`}
                    onClick={onToggleAdminTheme}
                  >
                    {adminTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                  </button>
                )}
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
