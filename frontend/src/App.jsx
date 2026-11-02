import { useEffect } from 'react'
import { ArrowUpRight, BookOpen, CalendarDays, ClipboardList, GraduationCap, MessageCircle, Sparkles, UsersRound } from 'lucide-react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import Login from './auth/Login'
import ProtectedRoute from './auth/ProtectedRoute'
import Register from './auth/Register'
import Profile from './auth/Profile'
import AdminDashboard from './admin/AdminDashboard'
import AdminAcademics from './admin/AdminAcademics'
import CreateProfessor from './admin/CreateProfessor'
import ProfessorDashboard from './professor/ProfessorDashboard'
import ProfessorClassroom from './professor/ProfessorClassroom'
import ProfessorCreateClass from './professor/ProfessorCreateClass'
import ProfessorMaterialReview from './professor/ProfessorMaterialReview'
import StudentDashboard from './student/StudentDashboard'
import StudentClassroom from './student/StudentClassroom'
import JoinClass from './student/JoinClass'
import MaterialDetail from './student/MaterialDetail'
import MaterialFileViewer from './student/MaterialFileViewer'
import Footer from './shared/Footer'
import Header from './shared/Header'
import NotificationsPage from './shared/NotificationsPage'
import Sidebar from './shared/Sidebar'
import './App.css'

function HomePage() {
  const { user, loading } = useAuth()
  function handleHeroPointerMove(event) {
    if (event.pointerType === 'touch') return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - bounds.left) / bounds.width
    const y = (event.clientY - bounds.top) / bounds.height
    event.currentTarget.style.setProperty('--pointer-x', `${x * 100}%`)
    event.currentTarget.style.setProperty('--pointer-y', `${y * 100}%`)
    event.currentTarget.style.setProperty('--parallax-x', `${(x - 0.5) * 12}px`)
    event.currentTarget.style.setProperty('--parallax-y', `${(y - 0.5) * 12}px`)
  }

  function handleHeroPointerLeave(event) {
    for (const property of ['--pointer-x', '--pointer-y', '--parallax-x', '--parallax-y']) {
      event.currentTarget.style.removeProperty(property)
    }
  }

  function handleFeaturePointerMove(event) {
    if (event.pointerType === 'touch') return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - bounds.left) / bounds.width
    const y = (event.clientY - bounds.top) / bounds.height
    event.currentTarget.style.setProperty('--tilt-x', `${(x - 0.5) * 5}deg`)
    event.currentTarget.style.setProperty('--tilt-y', `${(0.5 - y) * 5}deg`)
  }

  function handleFeaturePointerLeave(event) {
    event.currentTarget.style.removeProperty('--tilt-x')
    event.currentTarget.style.removeProperty('--tilt-y')
  }

  if (loading) return <main className="loading-page">Loading your learning space…</main>
  if (user) {
    const destination = { ADMIN: '/admin', PROFESSOR: '/professor', STUDENT: '/student' }[user.role]
    return <Navigate to={destination || '/login'} replace />
  }
  return (
    <main className="landing-page">
      <section
        className="landing-hero"
        aria-labelledby="landing-title"
        onPointerMove={handleHeroPointerMove}
        onPointerLeave={handleHeroPointerLeave}
      >
        <div className="landing-ambient" aria-hidden="true">
          <span className="ambient-orb ambient-orb-one" />
          <span className="ambient-orb ambient-orb-two" />
          <span className="ambient-note ambient-book"><BookOpen size={18} /></span>
          <span className="ambient-note ambient-cap"><GraduationCap size={20} /></span>
          <span className="ambient-note ambient-chat"><MessageCircle size={17} /></span>
        </div>
        <div className="landing-hero-inner">
          <div className="landing-copy">
            <span className="eyebrow"><Sparkles size={15} /> LEARN. SHARE. GROW.</span>
            <h1 id="landing-title">A better place to <em>learn together.</em></h1>
            <p>Bring professors and students together with class updates, learning materials, schedules, and conversations—all in one place.</p>
            <div className="landing-actions">
              <Link className="primary-link" to="/register">Get started <ArrowUpRight size={17} /></Link>
              <Link className="secondary-link" to="/login">Sign in</Link>
            </div>
            <div className="landing-note"><GraduationCap size={18} /><span>A shared classroom for every subject and every learner.</span></div>
          </div>

          <div className="landing-scene" aria-label="Preview of a connected classroom dashboard">
            <div className="scene-backdrop" />
            <div className="scene-window">
              <div className="scene-window-bar">
                <span className="scene-dots"><i /><i /><i /></span>
                <span>YOUR CLASSROOM</span>
                <span className="scene-window-avatar">S</span>
              </div>
              <div className="scene-layout">
                <div className="scene-sidebar" aria-hidden="true">
                  <span className="scene-brand-mark"><BookOpen size={14} /></span>
                  <i className="scene-nav-item selected" /><i className="scene-nav-item" /><i className="scene-nav-item" /><i className="scene-nav-item short" />
                  <span className="scene-sidebar-avatar">JD</span>
                </div>
                <div className="scene-content">
                  <div className="scene-welcome">
                    <span>MONDAY, OCTOBER 19</span>
                    <strong>Your learning space</strong>
                    <small>Everything you need for this week.</small>
                  </div>
                  <div className="scene-stat-row">
                    <div className="scene-stat"><span>MY CLASSES</span><strong>04</strong><i /></div>
                    <div className="scene-stat"><span>NEW MATERIALS</span><strong>12</strong><i /></div>
                  </div>
                  <div className="scene-class">
                    <span className="scene-class-icon"><BookOpen size={16} /></span>
                    <span className="scene-class-name"><strong>Foundations of Science</strong><small>Prof. Jordan Davis</small></span>
                    <span className="scene-class-pill">TODAY</span>
                  </div>
                  <div className="scene-class second">
                    <span className="scene-class-icon lavender"><ClipboardList size={16} /></span>
                    <span className="scene-class-name"><strong>World Literature</strong><small>Reading materials · 3 new</small></span>
                    <span className="scene-class-arrow"><ArrowUpRight size={15} /></span>
                  </div>
                </div>
              </div>
            </div>
            <div className="scene-float scene-float-top"><span><CalendarDays size={16} /></span><div><strong>Class, connected</strong><small>One space for everything</small></div></div>
            <div className="scene-float scene-float-bottom"><span className="float-check">✓</span><div><strong>Always in the loop</strong><small>Updates right when you need them</small></div></div>
            <span className="scene-sparkle sparkle-one">✳</span><span className="scene-sparkle sparkle-two">✦</span>
          </div>
        </div>
        <div className="landing-benefits-rail" aria-label="What you can do">
          <div className="landing-benefit"><span className="benefit-icon"><UsersRound size={19} /></span><span><strong>One shared space</strong><small>Professors and students, together</small></span></div>
          <div className="landing-benefit"><span className="benefit-icon"><BookOpen size={19} /></span><span><strong>Everything in reach</strong><small>Classes, materials, and updates</small></span></div>
          <div className="landing-benefit"><span className="benefit-icon"><MessageCircle size={19} /></span><span><strong>Learning that flows</strong><small>Stay connected from day one</small></span></div>
        </div>
      </section>

      <section className="landing-details" aria-labelledby="landing-details-title">
        <div className="landing-details-heading">
          <div>
            <span className="eyebrow">MADE FOR THE CLASSROOM</span>
            <h2 id="landing-details-title">Less searching.<br /><em>More learning.</em></h2>
          </div>
          <p>From the first class update to the last assignment, your learning essentials stay organized and easy to find.</p>
        </div>
        <div className="landing-feature-grid">
          <article className="landing-feature-card feature-classes" onPointerMove={handleFeaturePointerMove} onPointerLeave={handleFeaturePointerLeave}>
            <div className="feature-card-top"><span className="feature-card-icon"><UsersRound size={20} /></span><span className="feature-card-number">01</span></div>
            <h3>Your classes, all together</h3>
            <p>Find your classrooms and keep track of what is happening across every subject.</p>
            <div className="feature-class-preview"><span className="feature-preview-mark"><BookOpen size={15} /></span><span><strong>Foundations of Science</strong><small>Classroom · Updated today</small></span><ArrowUpRight size={15} /></div>
          </article>
          <article className="landing-feature-card feature-materials" onPointerMove={handleFeaturePointerMove} onPointerLeave={handleFeaturePointerLeave}>
            <div className="feature-card-top"><span className="feature-card-icon"><ClipboardList size={20} /></span><span className="feature-card-number">02</span></div>
            <h3>Materials within reach</h3>
            <p>Keep lessons, resources, and assignments easy to find when it is time to study.</p>
            <div className="feature-material-preview"><span className="material-preview-icon"><BookOpen size={14} /></span><span className="material-preview-lines"><i /><i /><i /></span><span className="material-preview-tag">LESSON NOTES</span></div>
          </article>
          <article className="landing-feature-card feature-updates" onPointerMove={handleFeaturePointerMove} onPointerLeave={handleFeaturePointerLeave}>
            <div className="feature-card-top"><span className="feature-card-icon"><MessageCircle size={20} /></span><span className="feature-card-number">03</span></div>
            <h3>Updates that find you</h3>
            <p>Stay in the loop with important class news, reminders, and schedule changes.</p>
            <div className="feature-update-preview"><span className="update-indicator" /><span><strong>New class announcement</strong><small>Your professor shared an update</small></span><span className="update-time">NOW</span></div>
          </article>
        </div>
      </section>

      <section className="landing-cta" aria-labelledby="landing-cta-title">
        <div className="cta-decoration cta-decoration-one" /><div className="cta-decoration cta-decoration-two" />
        <div className="landing-cta-copy">
          <span className="cta-eyebrow"><Sparkles size={14} /> YOUR NEXT CHAPTER STARTS HERE</span>
          <h2 id="landing-cta-title">Ready to make learning <em>feel connected?</em></h2>
          <p>Join your learning community and bring your classroom into one shared space.</p>
        </div>
        <div className="landing-cta-actions">
          <Link className="cta-primary-link" to="/register">Join the community <ArrowUpRight size={17} /></Link>
          <Link className="cta-secondary-link" to="/login">I already have an account</Link>
        </div>
      </section>
    </main>
  )
}

function AppRoutes() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const isJoinClassOpen = Boolean(location.state?.openJoinClass)

  useEffect(() => {
    if (!location.hash) return undefined
    const targetId = decodeURIComponent(location.hash.slice(1))
    const frame = requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => cancelAnimationFrame(frame)
  }, [location.hash, location.key])

  function openJoinClass() {
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: { ...location.state, openJoinClass: true },
    })
  }

  function closeJoinClass() {
    navigate(`${location.pathname}${location.search}${location.hash}`, { replace: true, state: null })
  }

  return (
    <div className={`app-shell${user ? ' authenticated-shell' : ''}${user?.role === 'STUDENT' ? ' student-sidebar-auto' : ''}${user?.role === 'PROFESSOR' ? ' professor-app-shell' : ''}`}>
      <Sidebar onOpenJoinClass={openJoinClass} />
      <Header />
      <div className="app-main-column">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/profile" element={<ProtectedRoute allowedRoles={['PROFESSOR', 'STUDENT']}><Profile /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute allowedRoles={['PROFESSOR', 'STUDENT']}><NotificationsPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/academics" element={<Navigate to="/admin/subjects" replace />} />
          <Route path="/admin/subjects" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminAcademics mode="subjects" /></ProtectedRoute>} />
          <Route path="/admin/classes" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminAcademics mode="classes" /></ProtectedRoute>} />
          <Route path="/admin/professors/new" element={<ProtectedRoute allowedRoles={['ADMIN']}><CreateProfessor /></ProtectedRoute>} />
          <Route path="/professor" element={<ProtectedRoute allowedRoles={['PROFESSOR']}><ProfessorDashboard /></ProtectedRoute>} />
          <Route path="/professor/classes/new" element={<ProtectedRoute allowedRoles={['PROFESSOR']}><ProfessorCreateClass /></ProtectedRoute>} />
          <Route path="/professor/classes/:classId" element={<ProtectedRoute allowedRoles={['PROFESSOR']}><ProfessorClassroom /></ProtectedRoute>} />
          <Route path="/professor/materials/:materialId" element={<ProtectedRoute allowedRoles={['PROFESSOR']}><ProfessorMaterialReview /></ProtectedRoute>} />
          <Route path="/student/classes/join" element={<ProtectedRoute allowedRoles={['STUDENT']}><Navigate to="/student" replace state={{ openJoinClass: true }} /></ProtectedRoute>} />
          <Route path="/student/classes/:classId/materials/:materialId/view" element={<ProtectedRoute allowedRoles={['STUDENT']}><MaterialFileViewer /></ProtectedRoute>} />
          <Route path="/student/classes/:classId/materials/:materialId" element={<ProtectedRoute allowedRoles={['STUDENT']}><MaterialDetail /></ProtectedRoute>} />
          <Route path="/student/classes/:classId" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentClassroom /></ProtectedRoute>} />
          <Route path="/student" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentDashboard onOpenJoinClass={openJoinClass} /></ProtectedRoute>} />
          <Route path="/unauthorized" element={<main><h1>Access denied</h1><p>Your account does not have permission to view this page.</p></main>} />
          <Route path="*" element={<main><h1>Page not found</h1></main>} />
        </Routes>
        <Footer onOpenJoinClass={openJoinClass} />
      </div>
      {isJoinClassOpen && <JoinClass onClose={closeJoinClass} />}
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
