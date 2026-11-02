import { useState } from 'react'
import { ArrowRight, BookOpen, CalendarDays, MessageSquareText, Sparkles } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import './auth.css'

export default function Register() {
  const { register, user } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/student" replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (!privacyAccepted) {
      setError('Please agree to the privacy policy to continue.')
      return
    }
    setSubmitting(true)
    try {
      await register({ fullName, email, password })
      navigate('/student', { replace: true })
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create your account. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-layout" aria-label="Create a Learniverse account">
        <aside className="auth-showcase">
          <div className="auth-showcase-brand"><span className="auth-brand-icon"><BookOpen size={22} /></span><span>The <strong>Learniverse</strong></span></div>
          <div className="auth-showcase-copy">
            <span className="auth-kicker"><Sparkles size={14} /> YOUR CLASSROOM, CONNECTED</span>
            <h2>Big ideas start in <em>good company.</em></h2>
            <p>Join your classes, meet your materials, and make learning a team effort.</p>
          </div>
          <div className="auth-feature-list">
            <div className="auth-feature"><span><CalendarDays size={17} /></span><div><strong>Know what’s coming</strong><small>Keep class schedules close at hand.</small></div></div>
            <div className="auth-feature"><span><MessageSquareText size={17} /></span><div><strong>Keep everything together</strong><small>Updates and learning materials in one space.</small></div></div>
          </div>
          <div className="auth-showcase-orbit auth-orbit-one" /><div className="auth-showcase-orbit auth-orbit-two" />
          <span className="auth-showcase-note">A little more organized. A lot more connected.</span>
        </aside>

        <div className="auth-form-panel">
          <form className="auth-card auth-register-card" onSubmit={handleSubmit}>
            <span className="auth-form-eyebrow">GET STARTED</span>
            <h1>Create your account</h1>
            <p className="auth-card-intro">Set up your student account and join the learning.</p>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <div className="auth-field"><label htmlFor="register-name">Full name</label><input id="register-name" type="text" autoComplete="name" maxLength={150} placeholder="Your name" required value={fullName} onChange={(event) => setFullName(event.target.value)} /></div>
            <div className="auth-field"><label htmlFor="register-email">Email address</label><input id="register-email" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
            <div className="auth-field"><label htmlFor="register-password">Password</label><input id="register-password" type="password" autoComplete="new-password" minLength={8} placeholder="At least 8 characters" required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
            <label className="privacy-check"><input type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} />I agree to the privacy policy.</label>
            <button type="submit" disabled={submitting}>{submitting ? 'Creating account…' : <>Create account <ArrowRight size={17} /></>}</button>
            <p className="auth-switch">Already have an account? <Link to="/login" viewTransition className="auth-switch-link">Sign in</Link></p>
          </form>
          <p className="auth-form-footnote">A shared learning space for every subject.</p>
        </div>
      </section>
    </main>
  )
}