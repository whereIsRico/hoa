import { Navigate, Outlet } from 'react-router-dom'
import { useStaffAuth } from '@/context/StaffAuthContext'

export function StaffPublicOnlyRoute() {
  const { token, loading } = useStaffAuth()

  if (loading) return null
  if (token) return <Navigate to="/staff/dashboard" replace />

  return <Outlet />
}
