import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { StaffAuthProvider } from '@/context/StaffAuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { PublicOnlyRoute } from '@/components/PublicOnlyRoute'
import { StaffProtectedRoute } from '@/components/StaffProtectedRoute'
import { StaffPublicOnlyRoute } from '@/components/StaffPublicOnlyRoute'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { DashboardLayout } from '@/pages/DashboardLayout'
import { GuestsPage } from '@/pages/GuestsPage'
import { NewGuestPage } from '@/pages/NewGuestPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { StaffLoginPage } from '@/pages/StaffLoginPage'
import { StaffDashboardLayout } from '@/pages/StaffDashboardLayout'
import { StaffGuestsPage } from '@/pages/StaffGuestsPage'

export default function App() {
  return (
    <AuthProvider>
      <StaffAuthProvider>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<Navigate to="guests" replace />} />
              <Route path="guests" element={<GuestsPage />} />
              <Route path="guests/new" element={<NewGuestPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
          </Route>

          <Route element={<StaffPublicOnlyRoute />}>
            <Route path="/staff/login" element={<StaffLoginPage />} />
          </Route>

          <Route element={<StaffProtectedRoute />}>
            <Route path="/staff/dashboard" element={<StaffDashboardLayout />}>
              <Route index element={<StaffGuestsPage />} />
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </StaffAuthProvider>
    </AuthProvider>
  )
}
