import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlatformAuth } from '@/context/PlatformAuthContext'
import { ApiError } from '@/lib/api'
import { AuthLayout } from '@/components/AuthLayout'
import { FormField, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'

export function PlatformLoginPage() {
  const { login } = usePlatformAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(form)
      navigate('/platform/communities')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Platform sign in" subtitle="Threshold internal — onboard and manage communities">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Banner tone="danger">{error}</Banner>}

        <FormField label="Email" required>
          {(fieldProps) => (
            <Input {...fieldProps} type="email" autoComplete="email" value={form.email} onChange={update('email')} required />
          )}
        </FormField>

        <FormField label="Password" required>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={update('password')}
              required
            />
          )}
        </FormField>

        <Button type="submit" loading={submitting} className="mt-2">
          Sign in
        </Button>
      </form>
    </AuthLayout>
  )
}
