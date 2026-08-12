import { Navigate } from 'react-router-dom'
import { useAdminAuth } from '../context/AdminAuthContext'

// Wraps every admin page. Anyone hitting /admin/* without a valid token
// is bounced straight to /admin/login — the route is never linked from
// anywhere in the public site.
export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAdminAuth()
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />
  return children
}
