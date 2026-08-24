import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/lib/api'
import { AuthLayout } from '@/components/AuthLayout'
import { CommunityPicker } from '@/components/CommunityPicker'
import { FormField, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ community_id: '', email: '', password: '' })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login({ ...form, community_id: Number(form.community_id) })
      navigate('/dashboard/guests')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Manage your guests and profile"
      footer={
        <>
          Don't have an account?{' '}
          <Link to="/register" className="font-medium text-accent-600 hover:underline">
            Register
          </Link>
        </>
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
