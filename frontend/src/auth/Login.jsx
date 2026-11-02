import { useState } from 'react'
import { ArrowRight, BookOpen, CalendarDays, MessageSquareText, Sparkles } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import './auth.css'

function roleHome(role) {
  return ({ ADMIN: '/admin', PROFESSOR: '/professor', STUDENT: '/student' })[role] || '/'
}

export default function Login() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to={roleHome(user.role)} replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const loggedInUser = await login({ identifier, password })
      navigate(roleHome(loggedInUser.role), { replace: true })
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to log in. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-layout" aria-label="Sign in to The Learniverse">
        <aside className="auth-showcase">
          <div className="auth-showcase-brand"><span className="auth-brand-icon"><BookOpen size={22} /></span><span>The <strong>Learniverse</strong></span></div>
          <div className="auth-showcase-copy">
            <span className="auth-kicker"><Sparkles size={14} /> YOUR CLASSROOM, CONNECTED</span>
            <h2>Make room for <em>what’s next.</em></h2>
            <p>Everything your class needs to learn, share, and move forward—together.</p>
          </div>
          <div className="auth-feature-list">
            <div className="auth-feature"><span><CalendarDays size={17} /></span><div><strong>Stay in the loop</strong><small>Class schedules and updates, all together.</small></div></div>
            <div className="auth-feature"><span><MessageSquareText size={17} /></span><div><strong>Keep learning flowing</strong><small>Find class materials when you need them.</small></div></div>
          </div>
          <div className="auth-showcase-orbit auth-orbit-one" /><div className="auth-showcase-orbit auth-orbit-two" />
          <span className="auth-showcase-note">A little more organized. A lot more connected.</span>
        </aside>

        <div className="auth-form-panel">
          <form className="auth-card" onSubmit={handleSubmit}>
            <span className="auth-form-eyebrow">WELCOME BACK</span>
            <h1>Sign in to your space</h1>
            <p className="auth-card-intro">Pick up right where your class left off.</p>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <div className="auth-field"><label htmlFor="login-identifier">Username or email</label><input id="login-identifier" type="text" autoComplete="username" placeholder="Your username or email" required value={identifier} onChange={(event) => setIdentifier(event.target.value)} /></div>
            <div className="auth-field"><label htmlFor="login-password">Password</label><input id="login-password" type="password" autoComplete="current-password" placeholder="Enter your password" required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
            <button type="submit" disabled={submitting}>{submitting ? 'Signing in…' : <>Sign in <ArrowRight size={17} /></>}</button>
            <p className="auth-switch">New to The Learniverse? <Link to="/register" viewTransition className="auth-switch-link">Create an account</Link></p>
          </form>
          <p className="auth-form-footnote">A shared learning space for every subject.</p>
        </div>
      </section>
    </main>
  )
}