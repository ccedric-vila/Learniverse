import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function Footer({ onOpenJoinClass }) {
  const { user } = useAuth()
  const isProfessor = user?.role === 'PROFESSOR'
  const isStudent = user?.role === 'STUDENT'

  return (
    <footer className="site-footer">
      <span>© 2026 STS Learning Management System</span>
      <nav aria-label="Footer navigation">
        <Link to="/">About STS LMS</Link>
        {isProfessor ? <><Link to="/professor">Teaching dashboard</Link><Link to="/professor#schedule">My schedule</Link></> : isStudent ? <><Link to="/student">Learning dashboard</Link><button type="button" onClick={onOpenJoinClass}>Join a class</button></> : <Link to="/register">Get started</Link>}
      </nav>
    </footer>
  )
}
