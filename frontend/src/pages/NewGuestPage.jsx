import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from '@phosphor-icons/react'
import { useAuth } from '@/context/AuthContext'
import { guestsApi, ApiError } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { FormField, Input, Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'

const initialForm = {
  first_name: '',
  last_name: '',
  phone: '',
  license_plate: '',
  purpose: '',
  scheduled_arrival: '',
  scheduled_departure: '',
  notes: '',
}

export function NewGuestPage() {
  const { token, resident } = useAuth()
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
        if (value) payload[key] = key.startsWith('scheduled_') ? new Date(value).toISOString() : value
      }
      await guestsApi.create(token, payload)
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

  if (!resident.is_approved) {
    // The layout already shows a persistent pending-approval banner on every
    // dashboard page — no need to repeat it here, just don't offer the form.
    return (
      <div className="flex flex-col gap-6">
        <Link to="/dashboard/guests" className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
          <ArrowLeft size={15} />
          Back to guests
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to="/dashboard/guests" className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
        <ArrowLeft size={15} />
        Back to guests
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Invite a guest</CardTitle>
          <CardDescription>Pre-register a visitor so the gate can check them in</CardDescription>
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
                {(fieldProps) => <Input {...fieldProps} value={form.first_name} onChange={update('first_name')} required />}
              </FormField>
              <FormField label="Last name" required>
                {(fieldProps) => <Input {...fieldProps} value={form.last_name} onChange={update('last_name')} required />}
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Phone" helper="Optional">
                {(fieldProps) => <Input {...fieldProps} type="tel" value={form.phone} onChange={update('phone')} />}
              </FormField>
              <FormField label="License plate" helper="Optional">
                {(fieldProps) => <Input {...fieldProps} value={form.license_plate} onChange={update('license_plate')} />}
              </FormField>
            </div>

            <FormField label="Purpose of visit" helper="Optional">
              {(fieldProps) => <Input {...fieldProps} value={form.purpose} onChange={update('purpose')} placeholder="e.g. Dinner, contractor visit" />}
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Expected arrival" helper="Optional">
                {(fieldProps) => (
                  <Input {...fieldProps} type="datetime-local" value={form.scheduled_arrival} onChange={update('scheduled_arrival')} />
                )}
              </FormField>
              <FormField label="Expected departure" helper="Optional">
                {(fieldProps) => (
                  <Input {...fieldProps} type="datetime-local" value={form.scheduled_departure} onChange={update('scheduled_departure')} />
                )}
              </FormField>
            </div>

            <FormField label="Notes" helper="Optional, visible to gate staff">
              {(fieldProps) => <Textarea {...fieldProps} value={form.notes} onChange={update('notes')} rows={3} />}
            </FormField>

            <Button type="submit" loading={submitting} className="self-start">
              Invite guest
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
