import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { Buildings, Plus, UsersThree, UserCircle, IdentificationBadge } from '@phosphor-icons/react'
import { usePlatformAuth } from '@/context/PlatformAuthContext'
import { platformApi, ApiError } from '@/lib/api'
import { buttonVariants } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Banner } from '@/components/ui/Banner'
import { EmptyState } from '@/components/ui/EmptyState'
import { GuestRowSkeleton } from '@/components/ui/Skeleton'
import { Avatar } from '@/components/ui/Avatar'
import { TIER_LABELS, BILLING_STATUS_LABELS, BILLING_STATUS_TONES } from '@/lib/constants'
import { cn } from '@/lib/utils'

const MotionLink = motion.create(Link)

export function CommunitiesPage() {
  const { token } = usePlatformAuth()
  const reduce = useReducedMotion()
  const [communities, setCommunities] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    platformApi
      .listCommunities(token)
      .then(({ communities }) => setCommunities(communities))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load communities'))
  }, [token])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Communities</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Every HOA on the platform</p>
        </div>
        <Link to="/platform/communities/new" className={cn(buttonVariants({ size: 'sm' }), 'inline-flex items-center gap-1.5 active:scale-[0.98] transition-transform')}>
          <Plus size={15} weight="bold" />
          Onboard HOA
        </Link>
      </div>

      {error && <Banner tone="danger">{error}</Banner>}

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-neutral-200 dark:border-neutral-800">
        {communities === null && !error && (
          <>
            <GuestRowSkeleton />
            <GuestRowSkeleton />
          </>
        )}

        {communities?.length === 0 && (
          <EmptyState icon={Buildings} title="No communities yet" description="Onboard your first HOA to get started" />
        )}

        {communities?.map((c, i) => (
          <MotionLink
            key={c.id}
            to={`/platform/communities/${c.id}`}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={reduce ? undefined : { scale: 1.015 }}
            transition={{ type: 'spring', stiffness: 400, damping: 26, delay: reduce ? 0 : i * 0.04 }}
            className={
              'relative flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50 hover:shadow-md hover:z-10 sm:flex-row sm:items-center sm:justify-between sm:gap-4 ' +
              (i > 0 ? 'border-t border-neutral-200 dark:border-neutral-800' : '')
            }
          >
            <div className="flex items-center gap-3 min-w-0">
              <Avatar name={c.name} size="sm" />
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">{c.name}</p>
                <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                  <span className="flex items-center gap-1">
                    <UserCircle size={13} />
                    {c.resident_count}
                  </span>
                  <span className="flex items-center gap-1">
                    <UsersThree size={13} />
                    {c.guest_count}
                  </span>
                  <span className="flex items-center gap-1">
                    <IdentificationBadge size={13} />
                    {c.staff_count}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
              <Badge tone="approved">{TIER_LABELS[c.subscription_tier] || c.subscription_tier}</Badge>
              <Badge tone={c.is_active ? 'success' : 'neutral'}>{c.is_active ? 'Active' : 'Inactive'}</Badge>
              <Badge tone={BILLING_STATUS_TONES[c.subscription_status] || 'neutral'}>
                {BILLING_STATUS_LABELS[c.subscription_status] || 'Not set'}
              </Badge>
            </div>
          </MotionLink>
        ))}
      </div>
    </div>
  )
}
