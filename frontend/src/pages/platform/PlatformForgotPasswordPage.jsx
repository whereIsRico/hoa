import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlatformAuth } from '@/context/PlatformAuthContext'
import { ApiError } from '@/lib/api'
import { AuthLayout } from '@/components/AuthLayout'
import { FormField, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'

export function PlatformForgotPasswordPage() {
  const { forgotPassword } = usePlatformAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await forgotPassword({ email })
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <AuthLayout title="Check your email" subtitle="If an account exists for that email, we've sent a reset link.">
        <Link to="/platform/login" className="font-medium text-accent-600 hover:underline">
          Back to sign in
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="We'll email you a link to reset it"
      footer={
        <Link to="/platform/login" className="font-medium text-accent-600 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Banner tone="danger">{error}</Banner>}

        <FormField label="Email" required>
          {(fieldProps) => (
            <Input {...fieldProps} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          )}
        </FormField>

        <Button type="submit" loading={submitting} className="mt-2">
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  )
}
