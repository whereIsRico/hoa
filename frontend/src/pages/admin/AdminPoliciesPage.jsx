import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { adminApi, ApiError } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { FormField, Input, Textarea } from '@/components/ui/Field'
import { Switch } from '@/components/ui/Switch'
import { Button } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'
import { Skeleton } from '@/components/ui/Skeleton'

export function AdminPoliciesPage() {
  const { token } = useAuth()
  const [policy, setPolicy] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    adminApi
      .getPolicy(token)
      .then(({ policy }) => setPolicy(policy))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load policy'))
  }, [token])

  const update = (key) => (value) => {
    setSuccess(false)
    setPolicy((p) => ({ ...p, [key]: value }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const { policy: updated } = await adminApi.updatePolicy(token, {
        max_guests_per_resident_per_month: policy.max_guests_per_resident_per_month,
        blacklisted_visitors: policy.blacklisted_visitors || '',
        require_id_verification: policy.require_id_verification,
        guest_checkout_required: policy.guest_checkout_required,
        auto_approval_enabled: policy.auto_approval_enabled,
      })
      setPolicy(updated)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save policy')
    } finally {
      setSubmitting(false)
    }
  }

  if (!policy) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {error && <Banner tone="danger">{error}</Banner>}
      {success && <Banner tone="success">Policy saved</Banner>}

      <Card>
        <CardHeader>
          <CardTitle>Guests</CardTitle>
          <CardDescription>Rules applied when residents invite guests</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FormField label="Monthly guest limit" helper="Applied to newly-registered residents going forward — doesn't change existing residents' individual limits">
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="number"
                min="0"
                className="w-32"
                value={policy.max_guests_per_resident_per_month}
                onChange={(e) => update('max_guests_per_resident_per_month')(Number(e.target.value))}
              />
            )}
          </FormField>

          <FormField label="Blacklisted visitors" helper="One full name per line, exact match — a resident won't be able to invite anyone on this list">
            {(fieldProps) => (
              <Textarea
                {...fieldProps}
                rows={4}
                placeholder="Jane Doe&#10;John Smith"
                value={policy.blacklisted_visitors || ''}
                onChange={(e) => update('blacklisted_visitors')(e.target.value)}
              />
            )}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gate</CardTitle>
          <CardDescription>Rules applied when gate staff check guests in</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
          <Switch
            label="Auto-approve guests"
            description="When on, guests can be checked in as soon as they're invited. When off, an admin must approve each guest before the gate can check them in."
            checked={policy.auto_approval_enabled}
            onChange={update('auto_approval_enabled')}
          />
          <Switch
            label="Require ID verification"
            description="Gate staff must confirm they checked ID before a check-in is accepted."
            checked={policy.require_id_verification}
            onChange={update('require_id_verification')}
          />
          <Switch
            label="Require checkout"
            description="Not enforced yet — this is saved but doesn't change any behavior in this build."
            checked={policy.guest_checkout_required}
            onChange={update('guest_checkout_required')}
            disabled
          />
        </CardContent>
      </Card>

      <Button type="submit" loading={submitting} className="self-start">
        Save policy
      </Button>
    </form>
  )
}
