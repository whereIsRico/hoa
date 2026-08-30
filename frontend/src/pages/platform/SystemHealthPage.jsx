import { useEffect, useState } from 'react'
import { Buildings, Pulse } from '@phosphor-icons/react'
import { usePlatformAuth } from '@/context/PlatformAuthContext'
import { platformApi, ApiError } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { Badge } from '@/components/ui/Badge'
import { Banner } from '@/components/ui/Banner'
import { EmptyState } from '@/components/ui/EmptyState'
import { GuestRowSkeleton } from '@/components/ui/Skeleton'
import { Avatar } from '@/components/ui/Avatar'

const DAY_MS = 24 * 60 * 60 * 1000

// audit_logs records guest/admin lifecycle actions, not HTTP requests — a
// quiet community isn't necessarily an unhealthy one. Thresholds: healthy
// under 24h, warning under 7 days, stale beyond that.
function activityStatus(lastActivity) {
  if (!lastActivity) return { label: 'No activity recorded', tone: 'neutral' }

  const ageMs = Date.now() - new Date(lastActivity).getTime()
  const when = formatDateTime(lastActivity)

  if (ageMs < DAY_MS) return { label: `Last activity ${when}`, tone: 'success' }
  if (ageMs < 7 * DAY_MS) return { label: `Last activity ${when}`, tone: 'warning' }
  return { label: `Last activity ${when}`, tone: 'danger' }
}

export function SystemHealthPage() {
  const { token } = usePlatformAuth()
  const [communities, setCommunities] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    platformApi
      .getSystemHealth(token)
      .then(({ communities }) => setCommunities(communities))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load system health'))
  }, [token])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">System Health</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Last activity per community, based on recorded guest and admin actions
        </p>
      </div>

      {error && <Banner tone="danger">{error}</Banner>}

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-neutral-200 dark:border-neutral-800">
        {communities === null && !error && (
          <>
            <GuestRowSkeleton />
            <GuestRowSkeleton />
          </>
        )}

        {communities?.length === 0 && <EmptyState icon={Buildings} title="No communities yet" />}

        {communities?.map((c, i) => {
          const status = activityStatus(c.last_activity)
          return (
            <div
              key={c.id}
              className={
                'flex flex-col items-start gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 ' +
                (i > 0 ? 'border-t border-neutral-200 dark:border-neutral-800' : '')
              }
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={c.name} size="sm" />
                <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">{c.name}</p>
              </div>
              <Badge tone={status.tone} className="shrink-0">
                <Pulse size={12} className="mr-1" weight="bold" />
                {status.label}
              </Badge>
            </div>
          )
        })}
      </div>
    </div>
  )
}
