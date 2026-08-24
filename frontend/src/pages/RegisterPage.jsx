import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/lib/api'
import { AuthLayout } from '@/components/AuthLayout'
import { CommunityPicker } from '@/components/CommunityPicker'
import { FormField, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'

const initialForm = { community_id: '', first_name: '', last_name: '', email: '', phone: '', password: '' }

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState(null)
  const [details, setDetails] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setDetails(null)
    setSubmitting(true)
    try {
      const payload = { ...form, community_id: Number(form.community_id) }
      if (!payload.phone) delete payload.phone
      await register(payload)
      navigate('/dashboard/guests')
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
        setDetails(err.details)
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Register as a resident to invite guests"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-accent-600 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && (
          <Banner tone="danger" title={error}>
            {details && details.length > 0 && (
              <ul className="mt-1 list-disc pl-4">
                {details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </Banner>
        )}

        <FormField label="Community" required>
          {(fieldProps) => (
            <CommunityPicker {...fieldProps} value={form.community_id} onChange={update('community_id')} required />
          )}
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="First name" required>
            {(fieldProps) => (
              <Input {...fieldProps} autoComplete="given-name" value={form.first_name} onChange={update('first_name')} required />
            )}
          </FormField>
          <FormField label="Last name" required>
            {(fieldProps) => (
              <Input {...fieldProps} autoComplete="family-name" value={form.last_name} onChange={update('last_name')} required />
            )}
          </FormField>
        </div>

        <FormField label="Email" required>
          {(fieldProps) => (
            <Input {...fieldProps} type="email" autoComplete="email" value={form.email} onChange={update('email')} required />
          )}
        </FormField>

        <FormField label="Phone" helper="Optional">
          {(fieldProps) => (
            <Input {...fieldProps} type="tel" autoComplete="tel" value={form.phone} onChange={update('phone')} />
          )}
        </FormField>

        <FormField label="Password" required helper="At least 8 characters">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={update('password')}
              required
            />
          )}
        </FormField>

        <Button type="submit" loading={submitting} className="mt-2">
          Create account
        </Button>
      </form>
    </AuthLayout>
  )
}
