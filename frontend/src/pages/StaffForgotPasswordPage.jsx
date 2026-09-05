import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStaffAuth } from '@/context/StaffAuthContext'
import { ApiError } from '@/lib/api'
import { AuthLayout } from '@/components/AuthLayout'
import { CommunityPicker } from '@/components/CommunityPicker'
import { FormField, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'

export function StaffForgotPasswordPage() {
  const { forgotPassword } = useStaffAuth()
  const [form, setForm] = useState({ community_id: '', email: '' })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await forgotPassword({ ...form, community_id: Number(form.community_id) })
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
        <Link to="/staff/login" className="font-medium text-accent-600 hover:underline">
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
        <Link to="/staff/login" className="font-medium text-accent-600 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Banner tone="danger">{error}</Banner>}

        <FormField label="Community" required>
          {(fieldProps) => (
            <CommunityPicker {...fieldProps} value={form.community_id} onChange={update('community_id')} required />
          )}
        </FormField>

        <FormField label="Email" required>
          {(fieldProps) => (
            <Input {...fieldProps} type="email" autoComplete="email" value={form.email} onChange={update('email')} required />
          )}
        </FormField>

        <Button type="submit" loading={submitting} className="mt-2">
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  )
}
