import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ClockCounterClockwise } from '@phosphor-icons/react'
import { usePlatformAuth } from '@/context/PlatformAuthContext'
import { platformApi, ApiError } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { TIER_LABELS, BILLING_STATUS_LABELS, BILLING_STATUS_TONES } from '@/lib/constants'
import { Badge } from '@/components/ui/Badge'
import { Banner } from '@/components/ui/Banner'
import { EmptyState } from '@/components/ui/EmptyState'
import { GuestRowSkeleton } from '@/components/ui/Skeleton'
import { Select } from '@/components/ui/Field'

function humanizeAction(action) {
  return action.replace('.', ' ').replace(/_/g, ' ')
}

export function CommunityDetailPage() {
  const { id } = useParams()
  const { token } = usePlatformAuth()
  const [community, setCommunity] = useState(null)
  const [auditLogs, setAuditLogs] = useState(null)
  const [error, setError] = useState(null)
  const [billingError, setBillingError] = useState(null)
  const [updatingBilling, setUpdatingBilling] = useState(false)

  useEffect(() => {
    platformApi
      .communityAuditLogs(token, id)
      .then(({ community, auditLogs }) => {
        setCommunity(community)
        setAuditLogs(auditLogs)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load community'))
  }, [token, id])

  const onBillingStatusChange = (e) => {
    const status = e.target.value
    setBillingError(null)
    setUpdatingBilling(true)
    platformApi
      .updateBillingStatus(token, id, status)
      .then(() => platformApi.communityAuditLogs(token, id))
      .then(({ community, auditLogs }) => {
        setCommunity(community)
        setAuditLogs(auditLogs)
      })
      .catch((err) => setBillingError(err instanceof ApiError ? err.message : 'Could not update billing status'))
      .finally(() => setUpdatingBilling(false))
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

      {error && <Banner tone="danger">{error}</Banner>}

      {community && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">{community.name}</h1>
            <Badge tone="approved">{TIER_LABELS[community.subscription_tier] || community.subscription_tier}</Badge>
            <Badge tone={community.is_active ? 'success' : 'neutral'}>{community.is_active ? 'Active' : 'Inactive'}</Badge>
            <Badge tone={BILLING_STATUS_TONES[community.subscription_status] || 'neutral'}>
              {BILLING_STATUS_LABELS[community.subscription_status] || 'Not set'}
            </Badge>
          </div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {community.email || 'No contact email on file'}
            {community.phone && ` · ${community.phone}`}
          </p>

          <div className="flex items-center gap-2">
            <label htmlFor="billing-status" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Billing status
            </label>
            <Select
              id="billing-status"
              className="w-40"
              value={community.subscription_status || ''}
              disabled={updatingBilling}
              onChange={onBillingStatusChange}
            >
              {!community.subscription_status && (
                <option value="" disabled>
                  Not set
                </option>
              )}
              <option value="active">Paying</option>
              <option value="trial">Trial</option>
              <option value="overdue">Overdue</option>
            </Select>
          </div>
          {billingError && <Banner tone="danger">{billingError}</Banner>}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          <ClockCounterClockwise size={16} />
          Activity log
        </div>

        <div className="overflow-hidden rounded-[var(--radius-card)] border border-neutral-200 dark:border-neutral-800">
          {auditLogs === null && !error && (
            <>
              <GuestRowSkeleton />
              <GuestRowSkeleton />
            </>
          )}

          {auditLogs?.length === 0 && <EmptyState icon={ClockCounterClockwise} title="No activity yet" />}

          {auditLogs?.map((log, i) => (
            <div
              key={log.id}
              className={
                'flex items-start justify-between gap-4 px-4 py-3 ' +
                (i > 0 ? 'border-t border-neutral-200 dark:border-neutral-800' : '')
              }
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-sm font-medium capitalize text-neutral-900 dark:text-neutral-100">
                  {humanizeAction(log.action)}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {log.actor_type} #{log.actor_id} · {log.resource_type} #{log.resource_id}
                </p>
                {log.details && Object.keys(log.details).length > 0 && (
                  <p className="font-mono text-xs text-neutral-400 dark:text-neutral-500">
                    {Object.entries(log.details)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(', ')}
                  </p>
                )}
              </div>
              <p className="shrink-0 text-xs text-neutral-400 dark:text-neutral-500">{formatDateTime(log.created_at)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
