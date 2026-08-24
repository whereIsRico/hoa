import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { residentsApi, ApiError } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { FormField, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'

export function ProfilePage() {
  const { token, resident, setResident } = useAuth()
  const [form, setForm] = useState({
    first_name: resident.first_name,
    last_name: resident.last_name,
    phone: resident.phone || '',
  })
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const update = (key) => (e) => {
    setSuccess(false)
    setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const payload = { ...form }
      if (!payload.phone) delete payload.phone
      const { resident: updated } = await residentsApi.updateMe(token, payload)
      setResident(updated)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Profile</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Manage your contact details</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contact details</CardTitle>
          <CardDescription>Your name and phone number, visible to your HOA</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {error && <Banner tone="danger">{error}</Banner>}
            {success && <Banner tone="success">Profile updated</Banner>}

            <div className="grid grid-cols-2 gap-3">
              <FormField label="First name" required>
                {(fieldProps) => <Input {...fieldProps} value={form.first_name} onChange={update('first_name')} required />}
              </FormField>
              <FormField label="Last name" required>
                {(fieldProps) => <Input {...fieldProps} value={form.last_name} onChange={update('last_name')} required />}
              </FormField>
            </div>

            <FormField label="Phone" helper="Optional">
              {(fieldProps) => <Input {...fieldProps} type="tel" value={form.phone} onChange={update('phone')} />}
            </FormField>

            <FormField label="Email" helper="Contact your HOA admin to change your email">
              {(fieldProps) => <Input {...fieldProps} value={resident.email} disabled />}
            </FormField>

            <FormField label="Unit number" helper="Assigned by your HOA admin">
              {(fieldProps) => <Input {...fieldProps} value={resident.unit_number || 'Not assigned'} disabled />}
            </FormField>

            <Button type="submit" loading={submitting} className="self-start">
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
