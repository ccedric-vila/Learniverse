import { useEffect, useState } from 'react'
import { ArrowRight, BookOpen, CalendarDays, Eye, EyeOff, LockKeyhole, MessageSquareText, ShieldCheck, Sparkles, X } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import GoogleSignInButton from './GoogleSignInButton'
import { googleSignInEnabled } from './googleSignInConfig'
import './auth.css'

export default function Register() {
  const { register, verifyRegistration, googleLogin, user } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [verificationStep, setVerificationStep] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [resendWait, setResendWait] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!privacyOpen) return undefined
    function closeOnEscape(event) {
      if (event.key === 'Escape') setPrivacyOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [privacyOpen])

  useEffect(() => {
    if (resendWait <= 0) return undefined
    const timer = window.setTimeout(() => setResendWait((current) => Math.max(0, current - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [resendWait])

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
      const result = await register({ fullName: fullName.trim(), email: email.trim(), password })
      setVerificationStep(true)
      setVerificationCode('')
      setResendWait(result.retryAfterSeconds || 60)
      setNotice(result.message || 'Check your email for a verification code.')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create your account. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleVerify(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setSubmitting(true)
    try {
      await verifyRegistration({ email: email.trim(), code: verificationCode })
      navigate('/student', { replace: true })
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to verify your email. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function resendVerificationCode() {
    setError('')
    setNotice('')
    setSubmitting(true)
    try {
      const result = await register({ fullName: fullName.trim(), email: email.trim(), password })
      setResendWait(result.retryAfterSeconds || 60)
      setNotice(result.message || 'A new verification code has been sent.')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to resend the verification code.')
      setResendWait(requestError.response?.data?.retryAfterSeconds || 0)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGoogleSignIn(credential) {
    if (!privacyAccepted) {
      setError('Please agree to the privacy policy before continuing.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await googleLogin(credential)
      navigate('/student', { replace: true })
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to sign in with Google. Please try again.')
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
          <form className="auth-card auth-register-card" onSubmit={verificationStep ? handleVerify : handleSubmit}>
            <span className="auth-form-eyebrow">GET STARTED</span>
            <h1>{verificationStep ? 'Check your email' : 'Create your account'}</h1>
            <p className="auth-card-intro">{verificationStep
              ? `Enter the six-digit code sent to ${email}. It expires in 10 minutes.`
              : 'Set up your student account and join the learning.'}</p>
            {error && <p className="auth-error" role="alert">{error}</p>}
            {notice && <p className="auth-success" role="status">{notice}</p>}
            {verificationStep ? (
              <>
                <div className="auth-field">
                  <label htmlFor="register-verification-code">Email verification code</label>
                  <input id="register-verification-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="6-digit code" required value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
                </div>
                <button type="submit" disabled={submitting}>{submitting ? 'Verifying…' : <>Verify and create account <ArrowRight size={17} /></>}</button>
                <button className="auth-text-button" type="button" disabled={submitting || resendWait > 0} onClick={resendVerificationCode}>
                  {resendWait > 0 ? `Resend code in ${resendWait}s` : 'Resend verification code'}
                </button>
                <button className="auth-text-button" type="button" disabled={submitting} onClick={() => { setVerificationStep(false); setVerificationCode(''); setError(''); setNotice('') }}>
                  Back to registration details
                </button>
              </>
            ) : (
              <>
            <div className="auth-field">
              <label htmlFor="register-name">Full name</label>
              <input id="register-name" type="text" autoComplete="name" minLength={2} maxLength={150} pattern="[A-Za-zÀ-ÖØ-öø-ÿ]+([ .'-][A-Za-zÀ-ÖØ-öø-ÿ]+)*" title="Use letters, spaces, apostrophes, periods, or hyphens." placeholder="Your name" required value={fullName} onChange={(event) => setFullName(event.target.value)} />
              <small className="auth-field-hint">Use letters, spaces, apostrophes, periods, or hyphens.</small>
            </div>
            <div className="auth-field">
              <label htmlFor="register-email">Email address</label>
              <input id="register-email" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="auth-field">
              <label htmlFor="register-password">Password</label>
              <div className="auth-input-wrap auth-password-wrap">
                <LockKeyhole size={17} aria-hidden="true" />
                <input id="register-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9\\s]).{8,}" title="Use at least 8 characters, including uppercase and lowercase letters, a number, and a special character." placeholder="At least 8 characters" required value={password} onChange={(event) => setPassword(event.target.value)} />
                <button
                  className="auth-password-toggle"
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              <small className="auth-field-hint">At least 8 characters, with uppercase and lowercase letters, a number, and a special character (such as !, @, or #).</small>
            </div>
            <div className="privacy-check">
              <input id="register-privacy" type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} />
              <label htmlFor="register-privacy">I agree to the</label>
              <button className="privacy-policy-link" type="button" onClick={() => setPrivacyOpen(true)}>privacy policy</button>
            </div>
            <button type="submit" disabled={submitting}>{submitting ? 'Sending verification code…' : <>Continue with email <ArrowRight size={17} /></>}</button>
            {googleSignInEnabled && (
              <>
                <div className="auth-divider"><span>or</span></div>
                <GoogleSignInButton onSuccess={handleGoogleSignIn} onError={setError} />
                {!privacyAccepted && <small className="auth-field-hint">Agree to the privacy policy to continue with Google.</small>}
              </>
            )}
            <p className="auth-switch">Already have an account? <Link to="/login" viewTransition className="auth-switch-link">Sign in</Link></p>
              </>
            )}
          </form>
          <p className="auth-form-footnote">A shared learning space for every subject.</p>
        </div>
      </section>
      {privacyOpen && (
        <div className="privacy-policy-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setPrivacyOpen(false)
        }}>
          <section className="privacy-policy-dialog" role="dialog" aria-modal="true" aria-labelledby="privacy-policy-title">
            <header className="privacy-policy-header">
              <div className="privacy-policy-icon"><ShieldCheck size={20} /></div>
              <div><span>LEARNIVERSE</span><h2 id="privacy-policy-title">Privacy policy</h2><p>How account and learning information is used.</p></div>
              <button type="button" aria-label="Close privacy policy" onClick={() => setPrivacyOpen(false)}><X size={18} /></button>
            </header>
            <div className="privacy-policy-content">
              <p className="privacy-policy-notice">Please review this information before creating an account. Your school or institution may provide additional privacy terms that also apply.</p>
              <section><h3>Information collected</h3><p>When you register, Learniverse collects your name and email address, and stores a protected password hash when you choose password registration. Email registration uses a one-time verification code. Google sign-in uses account details provided by Google. As you use the platform, it may also store class enrollment, quiz responses and scores, submissions, and other information you provide.</p></section>
              <section><h3>How information is used</h3><p>Information is used to create and secure your account, provide access to classes and learning activities, record academic progress, and deliver relevant class updates. Passwords are stored as protected password hashes rather than readable text.</p></section>
              <section><h3>Who can see learning information</h3><p>Authorized instructors and school administrators may access account or class-related information as needed to manage classes, provide instruction, and support the platform.</p></section>
              <section><h3>Retention and questions</h3><p>Your institution determines applicable academic-record retention and deletion practices. For questions about access, correction, deletion, or the institution’s privacy contact, please contact your school administrator.</p></section>
              <p className="privacy-policy-updated">This in-app policy preview describes Learniverse account and learning data at a general level. Institution-specific terms may supplement it.</p>
            </div>
            <footer className="privacy-policy-footer">
              <button type="button" onClick={() => { setPrivacyAccepted(true); setPrivacyOpen(false) }}>Agree and close</button>
            </footer>
          </section>
        </div>
      )}
    </main>
  )
}