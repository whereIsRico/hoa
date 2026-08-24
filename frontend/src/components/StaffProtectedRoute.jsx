import { Navigate, Outlet } from 'react-router-dom'
import { useStaffAuth } from '@/context/StaffAuthContext'

export function StaffProtectedRoute() {
  const { token, loading } = useStaffAuth()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="size-6 animate-spin rounded-full border-2 border-neutral-300 border-t-accent-600" />
      </div>
    )
  }

  if (!token) return <Navigate to="/staff/login" replace />

  return <Outlet />
}
