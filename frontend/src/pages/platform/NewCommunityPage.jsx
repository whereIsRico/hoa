import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from '@phosphor-icons/react'
import { usePlatformAuth } from '@/context/PlatformAuthContext'
import { platformApi, ApiError } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { FormField, Input, Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'

const initialForm = {
  community_name: '', community_email: '', community_phone: '', community_address: '', subscription_tier: 'starter',
  admin_first_name: '', admin_last_name: '', admin_email: '', admin_password: '',
}

export function NewCommunityPage() {
  const { token } = usePlatformAuth()
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
      const { community } = await platformApi.onboardCommunity(token, payload)
      navigate(`/platform/communities/${community.id}`)
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
        to="/platform/communities"
        className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
      >
        <ArrowLeft size={15} />
        Back to communities
      </Link>

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
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

        <Card>
          <CardHeader>
            <CardTitle>Community</CardTitle>
            <CardDescription>The new HOA being onboarded</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FormField label="Community name" required>
              {(fieldProps) => <Input {...fieldProps} value={form.community_name} onChange={update('community_name')} required />}
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Contact email" helper="Optional">
                {(fieldProps) => <Input {...fieldProps} type="email" value={form.community_email} onChange={update('community_email')} />}
              </FormField>
              <FormField label="Contact phone" helper="Optional">
                {(fieldProps) => <Input {...fieldProps} type="tel" value={form.community_phone} onChange={update('community_phone')} />}
              </FormField>
            </div>

            <FormField label="Address" helper="Optional">
              {(fieldProps) => <Input {...fieldProps} value={form.community_address} onChange={update('community_address')} />}
            </FormField>

            <FormField label="Subscription tier">
              {(fieldProps) => (
                <Select {...fieldProps} value={form.subscription_tier} onChange={update('subscription_tier')}>
                  <option value="starter">Starter</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </Select>
              )}
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>First admin</CardTitle>
            <CardDescription>Created already approved, so they can sign in and manage the community right away</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="First name" required>
                {(fieldProps) => (
                  <Input {...fieldProps} autoComplete="given-name" value={form.admin_first_name} onChange={update('admin_first_name')} required />
                )}
              </FormField>
              <FormField label="Last name" required>
                {(fieldProps) => (
                  <Input {...fieldProps} autoComplete="family-name" value={form.admin_last_name} onChange={update('admin_last_name')} required />
                )}
              </FormField>
            </div>

            <FormField label="Email" required>
              {(fieldProps) => (
                <Input {...fieldProps} type="email" autoComplete="email" value={form.admin_email} onChange={update('admin_email')} required />
              )}
            </FormField>

            <FormField label="Password" required helper="At least 8 characters — share this with them directly, there's no invite email yet">
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="password"
                  autoComplete="new-password"
                  value={form.admin_password}
                  onChange={update('admin_password')}
                  required
                />
              )}
            </FormField>
          </CardContent>
        </Card>

        <Button type="submit" loading={submitting} className="self-start">
          Onboard community
        </Button>
      </form>
    </div>
  )
}
