import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from '@phosphor-icons/react'
import { useAuth } from '@/context/AuthContext'
import { adminApi, ApiError } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { FormField, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'

const initialForm = { first_name: '', last_name: '', email: '', password: '', phone: '', shift_start: '', shift_end: '' }

export function NewStaffPage() {
  const { token } = useAuth()
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
      const payload = {}
      for (const [key, value] of Object.entries(form)) {
        if (value) payload[key] = value
      }
      await adminApi.createStaff(token, payload)
      navigate('/dashboard/admin/staff')
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
    <div className="flex flex-col gap-6">
      <Link
        to="/dashboard/admin/staff"
        className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
      >
        <ArrowLeft size={15} />
        Back to staff
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>New gate staff account</CardTitle>
          <CardDescription>They'll be able to sign in at /staff/login with this email and password</CardDescription>
        </CardHeader>
        <CardContent>
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

            <FormField label="Phone" helper="Optional">
              {(fieldProps) => <Input {...fieldProps} type="tel" autoComplete="tel" value={form.phone} onChange={update('phone')} />}
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Shift start" helper="Optional">
                {(fieldProps) => <Input {...fieldProps} type="time" value={form.shift_start} onChange={update('shift_start')} />}
              </FormField>
              <FormField label="Shift end" helper="Optional">
                {(fieldProps) => <Input {...fieldProps} type="time" value={form.shift_end} onChange={update('shift_end')} />}
              </FormField>
            </div>

            <Button type="submit" loading={submitting} className="self-start">
              Create account
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
