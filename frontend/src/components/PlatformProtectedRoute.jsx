import { Navigate, Outlet } from 'react-router-dom'
import { usePlatformAuth } from '@/context/PlatformAuthContext'

export function PlatformProtectedRoute() {
  const { token, loading } = usePlatformAuth()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="size-6 animate-spin rounded-full border-2 border-neutral-300 border-t-accent-600" />
      </div>
    )
  }

  if (!token) return <Navigate to="/platform/login" replace />

  return <Outlet />
}
