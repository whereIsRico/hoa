import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

// Keeps an already-signed-in resident from seeing the login/register forms.
export function PublicOnlyRoute() {
  const { token, loading } = useAuth()

  if (loading) return null
  if (token) return <Navigate to="/dashboard/guests" replace />

  return <Outlet />
}
