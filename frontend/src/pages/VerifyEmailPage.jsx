import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/lib/api'
import { AuthLayout } from '@/components/AuthLayout'
import { FormField, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'

const RESEND_COOLDOWN_SECONDS = 60

// Reached two ways: from RegisterPage right after a code was sent, and
// from LoginPage when an unverified account tries to log in directly
// (see LoginPage.jsx). Both pass { email, community_id } via navigation
// state — there's no other way to know which pending registration this is.
export function VerifyEmailPage() {
  const { verifyEmail, resendCode } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { email, community_id } = location.state || {}

  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState(null)
  // Seeded, not 0: a code was already sent seconds ago on both entry paths
  // (register's send, or LoginPage's auto-resend), so the 1-per-60s resend
  // limit is already spent — starting enabled guarantees a 429 on the
  // user's first click.
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS)

  useEffect(() => {
    if (!email || !community_id) {
      navigate('/register', { replace: true })
    }
  }, [email, community_id, navigate])

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await verifyEmail({ community_id, email, code })
      navigate('/dashboard/guests')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const onResend = async () => {
    setError(null)
    setResendMessage(null)
    setResending(true)
    try {
      await resendCode({ community_id, email })
      setResendMessage('A new code has been sent.')
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resend the code. Please try again.')
    } finally {
      setResending(false)
    }
  }

  if (!email || !community_id) return null

  return (
    <AuthLayout title="Verify your email" subtitle={`Enter the 6-digit code sent to ${email}`}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Banner tone="danger">{error}</Banner>}
        {resendMessage && <Banner tone="success">{resendMessage}</Banner>}

        <FormField label="Verification code" required>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
            />
          )}
        </FormField>

        <Button type="submit" loading={submitting} disabled={code.length !== 6} className="mt-2">
          Verify
        </Button>

        <Button type="button" variant="ghost" onClick={onResend} loading={resending} disabled={cooldown > 0}>
          {cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}
        </Button>
      </form>
    </AuthLayout>
  )
}
