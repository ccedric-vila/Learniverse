import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'

export default function ProtectedRoute({ allowedRoles = [], children }) {
  const { user, loading } = useAuth()

  if (loading) return <main aria-live="polite">Checking your session…</main>
  if (!user) return <Navigate to="/login" replace />
  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />
  }
  return children || <Outlet />
}