import { useEffect } from 'react'
import { ArrowUpRight, BookOpen, GraduationCap, Sparkles } from 'lucide-react'
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
import ProfessorMaterialReview from './professor/ProfessorMaterialReview'
import StudentDashboard from './student/StudentDashboard'
import StudentClassroom from './student/StudentClassroom'
import JoinClass from './student/JoinClass'
import MaterialDetail from './student/MaterialDetail'
import MaterialFileViewer from './student/MaterialFileViewer'
import Footer from './shared/Footer'
import Header from './shared/Header'
import NotificationsPage from './shared/NotificationsPage'
import './App.css'

function HomePage() {
  const { user, loading } = useAuth()
  if (loading) return <main className="loading-page">Loading your learning space…</main>
  if (user) {
    const destination = { ADMIN: '/admin', PROFESSOR: '/professor', STUDENT: '/student' }[user.role]
    return <Navigate to={destination || '/login'} replace />
  }
  return <main className="landing-page"><div className="landing-copy"><span className="eyebrow"><Sparkles size={15} /> LEARN. SHARE. GROW.</span><h1>Every class, connected in one <em>learning space.</em></h1><p>Bring professors and students together with class updates, learning materials, schedules, and conversations—all in one place.</p><div className="landing-actions"><Link className="primary-link" to="/register">Get started <ArrowUpRight size={17} /></Link><Link className="secondary-link" to="/login">Sign in</Link></div><div className="landing-note"><GraduationCap size={18} /><span>A shared classroom for every subject and every learner.</span></div></div><div className="landing-visual"><div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" /><div className="visual-core"><BookOpen size={68} strokeWidth={1.2} /></div><div className="visual-tag tag-top">CLASSROOM <span>✳</span></div><div className="visual-tag tag-bottom">MATERIALS <span>↗</span></div><span className="visual-caption">Everything your class needs to learn.</span></div></main>
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
    <div className={`app-shell${user ? ' authenticated-shell' : ''}`}>
      <Header onOpenJoinClass={openJoinClass} />
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
