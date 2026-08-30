import { useEffect, useState, useCallback } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { UserCircle, MagnifyingGlass, Buildings } from '@phosphor-icons/react'
import { useStaffAuth } from '@/context/StaffAuthContext'
import { staffApi, ApiError } from '@/lib/api'
import { useDirectorySearch, STATUS_FILTERS } from '@/lib/useDirectorySearch'
import { Input } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'
import { Banner } from '@/components/ui/Banner'
import { EmptyState } from '@/components/ui/EmptyState'
import { GuestRowSkeleton } from '@/components/ui/Skeleton'
import { Avatar } from '@/components/ui/Avatar'
import { DirectoryDetailModal } from '@/components/DirectoryDetailModal'
import { cn } from '@/lib/utils'

const SEARCH_FIELDS = ['first_name', 'last_name', 'unit_number', 'phone']

const chipClass = (active) =>
  cn(
    'rounded-[var(--radius-field)] border px-3 py-1.5 text-sm font-medium transition-colors',
    active
      ? 'border-accent2-500 bg-accent2-100 text-accent2-700 dark:border-accent2-400 dark:bg-accent2-900/40 dark:text-accent2-300'
      : 'border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800'
  )

// Read-only mirror of AdminResidentsPage's directory: search, filter, pinned
// office row, click-through detail — but no approve/promote actions. Gate
// staff already indirectly sees resident name/unit via the guest-list join,
// so this introduces no new privacy boundary.
export function StaffDirectoryPage() {
  const { token } = useStaffAuth()
  const reduce = useReducedMotion()
  const [residents, setResidents] = useState(null)
  const [community, setCommunity] = useState(null)
  const [error, setError] = useState(null)
  const [detail, setDetail] = useState(null)

  const { search, setSearch, statusFilter, setStatusFilter, filtered } = useDirectorySearch(residents, {
    searchFields: SEARCH_FIELDS,
  })

  const load = useCallback(async () => {
    setError(null)
    try {
      const [{ residents }, { community }] = await Promise.all([
        staffApi.listResidents(token),
        staffApi.getCommunity(token),
      ])
      setResidents(residents)
      setCommunity(community)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load directory')
    }
  }, [token])

  useEffect(() => {
    setResidents(null)
    load()
  }, [load])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Directory</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Look up residents and the HOA office</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <MagnifyingGlass
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, unit, or phone"
            className="pl-9"
            aria-label="Search residents"
          />
        </div>

        <div className="flex items-center gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={chipClass(statusFilter === f.value)}
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <Banner tone="danger">{error}</Banner>}

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-neutral-200 dark:border-neutral-800">
        {residents === null && !error && (
          <>
            <GuestRowSkeleton />
            <GuestRowSkeleton />
          </>
        )}

        {community && (
          <button
            type="button"
            onClick={() => setDetail({ name: community.name, phone: community.phone })}
            className="flex w-full items-center justify-between gap-4 bg-accent2-100 px-4 py-3.5 text-left transition-colors hover:bg-accent2-100/70 dark:bg-accent2-900/40 dark:hover:bg-accent2-900/60"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-field)] bg-accent2-500 text-accent2-contrast">
                <Buildings size={16} weight="fill" />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="truncate text-sm font-medium text-accent2-700 dark:text-accent2-300">
                  {community.name} · HOA Office
                </p>
                <p className="truncate text-xs text-accent2-700/70 dark:text-accent2-300/70">
                  {community.phone || 'No phone on file'}
                </p>
              </div>
            </div>
            <Badge tone="neutral" className="bg-accent2-500/10 text-accent2-700 dark:text-accent2-300">
              Office
            </Badge>
          </button>
        )}

        {residents?.length === 0 && <EmptyState icon={UserCircle} title="No residents found" />}

        {residents?.length > 0 && filtered.length === 0 && (
          <EmptyState icon={UserCircle} title="No residents match your search" />
        )}

        {filtered.map((resident, i) => (
          <motion.button
            key={resident.id}
            type="button"
            onClick={() =>
              setDetail({
                name: `${resident.first_name} ${resident.last_name}`,
                unitNumber: resident.unit_number,
                phone: resident.phone,
              })
            }
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 26, delay: reduce ? 0 : i * 0.04 }}
            className={
              'flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900 ' +
              (i > 0 || community ? 'border-t border-neutral-200 dark:border-neutral-800' : '')
            }
          >
            <div className="flex items-center gap-3 min-w-0">
              <Avatar name={`${resident.first_name} ${resident.last_name}`} size="sm" />
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {resident.first_name} {resident.last_name}
                </p>
                <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                  {resident.unit_number && `Unit ${resident.unit_number}`}
                </p>
              </div>
            </div>
            <Badge tone={resident.is_approved ? 'success' : 'neutral'}>
              {resident.is_approved ? 'On Palisade' : 'Pending'}
            </Badge>
          </motion.button>
        ))}
      </div>

      <DirectoryDetailModal
        open={detail !== null}
        onClose={() => setDetail(null)}
        name={detail?.name}
        unitNumber={detail?.unitNumber}
        phone={detail?.phone}
      />
    </div>
  )
}
