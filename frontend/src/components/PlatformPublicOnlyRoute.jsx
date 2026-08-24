import { Navigate, Outlet } from 'react-router-dom'
import { usePlatformAuth } from '@/context/PlatformAuthContext'

export function PlatformPublicOnlyRoute() {
  const { token, loading } = usePlatformAuth()

  if (loading) return null
  if (token) return <Navigate to="/platform/communities" replace />

  return <Outlet />
}
