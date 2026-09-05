import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { StaffAuthProvider } from '@/context/StaffAuthContext'
import { PlatformAuthProvider } from '@/context/PlatformAuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { PublicOnlyRoute } from '@/components/PublicOnlyRoute'
import { AdminProtectedRoute } from '@/components/AdminProtectedRoute'
import { StaffProtectedRoute } from '@/components/StaffProtectedRoute'
import { StaffPublicOnlyRoute } from '@/components/StaffPublicOnlyRoute'
import { PlatformProtectedRoute } from '@/components/PlatformProtectedRoute'
import { PlatformPublicOnlyRoute } from '@/components/PlatformPublicOnlyRoute'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { TermsPage } from '@/pages/TermsPage'
import { PrivacyPage } from '@/pages/PrivacyPage'
import { VerifyEmailPage } from '@/pages/VerifyEmailPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { DashboardLayout } from '@/pages/DashboardLayout'
import { GuestsPage } from '@/pages/GuestsPage'
import { NewGuestPage } from '@/pages/NewGuestPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { StaffLoginPage } from '@/pages/StaffLoginPage'
import { StaffForgotPasswordPage } from '@/pages/StaffForgotPasswordPage'
import { StaffResetPasswordPage } from '@/pages/StaffResetPasswordPage'
import { StaffDashboardLayout } from '@/pages/StaffDashboardLayout'
import { StaffGuestsPage } from '@/pages/StaffGuestsPage'
import { StaffDirectoryPage } from '@/pages/StaffDirectoryPage'
import { AdminLayout } from '@/pages/admin/AdminLayout'
import { AdminGuestsPage } from '@/pages/admin/AdminGuestsPage'
import { AdminResidentsPage } from '@/pages/admin/AdminResidentsPage'
import { AdminStaffPage } from '@/pages/admin/AdminStaffPage'
import { NewStaffPage } from '@/pages/admin/NewStaffPage'
import { AdminPoliciesPage } from '@/pages/admin/AdminPoliciesPage'
import { PlatformLoginPage } from '@/pages/platform/PlatformLoginPage'
import { PlatformForgotPasswordPage } from '@/pages/platform/PlatformForgotPasswordPage'
import { PlatformResetPasswordPage } from '@/pages/platform/PlatformResetPasswordPage'
import { PlatformDashboardLayout } from '@/pages/platform/PlatformDashboardLayout'
import { CommunitiesPage } from '@/pages/platform/CommunitiesPage'
import { NewCommunityPage } from '@/pages/platform/NewCommunityPage'
import { CommunityDetailPage } from '@/pages/platform/CommunityDetailPage'
import { DirectoryPage } from '@/pages/platform/DirectoryPage'
import { SystemHealthPage } from '@/pages/platform/SystemHealthPage'

export default function App() {
  return (
    <AuthProvider>
      <StaffAuthProvider>
        <PlatformAuthProvider>
          <Routes>
            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardLayout />}>
                <Route index element={<Navigate to="guests" replace />} />
                <Route path="guests" element={<GuestsPage />} />
                <Route path="guests/new" element={<NewGuestPage />} />
                <Route path="profile" element={<ProfilePage />} />

                <Route element={<AdminProtectedRoute />}>
                  <Route path="admin" element={<AdminLayout />}>
                    <Route index element={<Navigate to="guests" replace />} />
                    <Route path="guests" element={<AdminGuestsPage />} />
                    <Route path="residents" element={<AdminResidentsPage />} />
                    <Route path="staff" element={<AdminStaffPage />} />
                    <Route path="staff/new" element={<NewStaffPage />} />
                    <Route path="policies" element={<AdminPoliciesPage />} />
                  </Route>
                </Route>
              </Route>
            </Route>

            <Route element={<StaffPublicOnlyRoute />}>
              <Route path="/staff/login" element={<StaffLoginPage />} />
              <Route path="/staff/forgot-password" element={<StaffForgotPasswordPage />} />
              <Route path="/staff/reset-password" element={<StaffResetPasswordPage />} />
            </Route>

            <Route element={<StaffProtectedRoute />}>
              <Route path="/staff/dashboard" element={<StaffDashboardLayout />}>
                <Route index element={<Navigate to="guests" replace />} />
                <Route path="guests" element={<StaffGuestsPage />} />
                <Route path="directory" element={<StaffDirectoryPage />} />
              </Route>
            </Route>

            <Route element={<PlatformPublicOnlyRoute />}>
              <Route path="/platform/login" element={<PlatformLoginPage />} />
              <Route path="/platform/forgot-password" element={<PlatformForgotPasswordPage />} />
              <Route path="/platform/reset-password" element={<PlatformResetPasswordPage />} />
            </Route>

            <Route element={<PlatformProtectedRoute />}>
              <Route path="/platform" element={<PlatformDashboardLayout />}>
                <Route index element={<Navigate to="communities" replace />} />
                <Route path="communities" element={<CommunitiesPage />} />
                <Route path="communities/new" element={<NewCommunityPage />} />
                <Route path="communities/:id" element={<CommunityDetailPage />} />
                <Route path="directory" element={<DirectoryPage />} />
                <Route path="system-health" element={<SystemHealthPage />} />
              </Route>
            </Route>

            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </PlatformAuthProvider>
      </StaffAuthProvider>
    </AuthProvider>
  )
}
