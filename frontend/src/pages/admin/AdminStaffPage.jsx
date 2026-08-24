import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { IdentificationBadge, Plus } from '@phosphor-icons/react'
import { useAuth } from '@/context/AuthContext'
import { adminApi, ApiError } from '@/lib/api'
import { buttonVariants } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Banner } from '@/components/ui/Banner'
import { EmptyState } from '@/components/ui/EmptyState'
import { GuestRowSkeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

function formatShift(start, end) {
  if (!start || !end) return null
  return `${start.slice(0, 5)} – ${end.slice(0, 5)}`
}

export function AdminStaffPage() {
  const { token } = useAuth()
  const [staff, setStaff] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    adminApi
      .listStaff(token)
      .then(({ staff }) => setStaff(staff))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load staff'))
  }, [token])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Gate staff accounts for this community</p>
        <Link to="/dashboard/admin/staff/new" className={cn(buttonVariants({ size: 'sm' }), 'inline-flex items-center gap-1.5')}>
          <Plus size={15} weight="bold" />
          New staff
        </Link>
      </div>

      {error && <Banner tone="danger">{error}</Banner>}

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-neutral-200 dark:border-neutral-800">
        {staff === null && !error && (
          <>
            <GuestRowSkeleton />
            <GuestRowSkeleton />
          </>
        )}

        {staff?.length === 0 && (
          <EmptyState
            icon={IdentificationBadge}
            title="No gate staff yet"
            description="Add a staff account so they can check guests in and out"
          />
        )}

        {staff?.map((s, i) => (
          <div
            key={s.id}
            className={
              'flex items-center justify-between gap-4 px-4 py-3.5 ' +
              (i > 0 ? 'border-t border-neutral-200 dark:border-neutral-800' : '')
            }
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {s.first_name} {s.last_name}
              </p>
              <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                {s.email}
                {formatShift(s.shift_start, s.shift_end) && ` · ${formatShift(s.shift_start, s.shift_end)}`}
              </p>
            </div>
            <Badge tone={s.is_active ? 'success' : 'neutral'}>{s.is_active ? 'Active' : 'Inactive'}</Badge>
          </div>
        ))}
      </div>
    </div>
  )
}
