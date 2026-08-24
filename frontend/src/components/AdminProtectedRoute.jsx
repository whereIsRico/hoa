import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

// Admin isn't a separate identity like gate staff — it's a resident with
// role='admin'. So this reuses the resident token/session entirely and just
// adds a role check, mirroring the backend's authenticate + requireAdmin.
export function AdminProtectedRoute() {
  const { token, resident, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="size-6 animate-spin rounded-full border-2 border-neutral-300 border-t-accent-600" />
      </div>
    )
  }

  if (!token) return <Navigate to="/login" replace />
  if (resident.role !== 'admin') return <Navigate to="/dashboard/guests" replace />

  return <Outlet />
}
