import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { IdentificationBadge, Plus } from '@phosphor-icons/react'
import { useAuth } from '@/context/AuthContext'
import { adminApi, ApiError } from '@/lib/api'
import { buttonVariants } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Banner } from '@/components/ui/Banner'
import { EmptyState } from '@/components/ui/EmptyState'
import { GuestRowSkeleton } from '@/components/ui/Skeleton'
import { Avatar } from '@/components/ui/Avatar'
import { DirectoryDetailModal } from '@/components/DirectoryDetailModal'
import { cn } from '@/lib/utils'

function formatShift(start, end) {
  if (!start || !end) return null
  return `${start.slice(0, 5)} – ${end.slice(0, 5)}`
}

export function AdminStaffPage() {
  const { token } = useAuth()
  const reduce = useReducedMotion()
  const [staff, setStaff] = useState(null)
  const [error, setError] = useState(null)
  const [detail, setDetail] = useState(null)

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
        <Link to="/dashboard/admin/staff/new" className={cn(buttonVariants({ size: 'sm' }), 'inline-flex items-center gap-1.5 active:scale-[0.98] transition-transform')}>
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
          <motion.button
            key={s.id}
            type="button"
            onClick={() =>
              setDetail({
                name: `${s.first_name} ${s.last_name}`,
                phone: s.phone,
                fields: [
                  { label: 'Email', value: s.email },
                  { label: 'Shift', value: formatShift(s.shift_start, s.shift_end) },
                ],
              })
            }
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 26, delay: reduce ? 0 : i * 0.04 }}
            className={
              'flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900 ' +
              (i > 0 ? 'border-t border-neutral-200 dark:border-neutral-800' : '')
            }
          >
            <div className="flex items-center gap-3 min-w-0">
              <Avatar name={`${s.first_name} ${s.last_name}`} size="sm" />
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {s.first_name} {s.last_name}
                </p>
                <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                  {s.email}
                  {formatShift(s.shift_start, s.shift_end) && ` · ${formatShift(s.shift_start, s.shift_end)}`}
                </p>
              </div>
            </div>
            <Badge tone={s.is_active ? 'success' : 'neutral'}>{s.is_active ? 'Active' : 'Inactive'}</Badge>
          </motion.button>
        ))}
      </div>

      <DirectoryDetailModal
        open={detail !== null}
        onClose={() => setDetail(null)}
        name={detail?.name}
        phone={detail?.phone}
        fields={detail?.fields}
      />
    </div>
  )
}
