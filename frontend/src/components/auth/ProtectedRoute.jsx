import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

// ── ProtectedRoute ────────────────────────────────────────────────────────────
// Wraps any route that requires authentication.
// Redirects to /login with the current path saved in state so we can redirect
// back after login.
export default function ProtectedRoute({ children, adminOnly = false }) {
  const { isLoggedIn, isAdmin } = useAuth()
  const location = useLocation()

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />
  }

  return children
}
