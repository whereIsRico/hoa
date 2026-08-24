import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export function ProtectedRoute() {
  const { token, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="size-6 animate-spin rounded-full border-2 border-neutral-300 border-t-accent-600" />
      </div>
    )
  }

  if (!token) return <Navigate to="/login" replace />

  return <Outlet />
}
