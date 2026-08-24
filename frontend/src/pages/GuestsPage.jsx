import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { UsersThree, Plus, CalendarBlank, X } from '@phosphor-icons/react'
import { useAuth } from '@/context/AuthContext'
import { guestsApi, ApiError } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { Button, buttonVariants } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { Banner } from '@/components/ui/Banner'
import { EmptyState } from '@/components/ui/EmptyState'
import { GuestRowSkeleton } from '@/components/ui/Skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { cn } from '@/lib/utils'

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'invited', label: 'Invited' },
  { value: 'approved', label: 'Approved' },
  { value: 'checked_in', label: 'Checked in' },
  { value: 'checked_out', label: 'Checked out' },
  { value: 'denied', label: 'Denied' },
  { value: 'cancelled', label: 'Cancelled' },
]

export function GuestsPage() {
  const { token } = useAuth()
  const [guests, setGuests] = useState(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const { guests } = await guestsApi.list(token, status || undefined)
      setGuests(guests)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load guests')
    }
  }, [token, status])

  useEffect(() => {
    setGuests(null)
    load()
  }, [load])

  const onCancel = async (id) => {
    setCancellingId(id)
    try {
      await guestsApi.cancel(token, id)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not cancel guest')
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Guests</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Guests you've invited</p>
        </div>
        <Link to="/dashboard/guests/new" className={cn(buttonVariants(), 'inline-flex items-center gap-1.5')}>
          <Plus size={16} weight="bold" />
          New guest
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-48">
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>

      {error && <Banner tone="danger">{error}</Banner>}

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-neutral-200 dark:border-neutral-800">
        {guests === null && !error && (
          <>
            <GuestRowSkeleton />
            <GuestRowSkeleton />
            <GuestRowSkeleton />
          </>
        )}

        {guests?.length === 0 && (
          <EmptyState
            icon={UsersThree}
            title={status ? `No guests with status "${status.replace('_', ' ')}"` : 'No guests yet'}
            description={!status && 'Invite your first guest to get started'}
            action={
              !status && (
                <Link
                  to="/dashboard/guests/new"
                  className={cn(buttonVariants({ size: 'sm' }), 'mt-1 inline-flex items-center gap-1.5')}
                >
                  <Plus size={15} weight="bold" />
                  New guest
                </Link>
              )
            }
          />
        )}

        {guests?.map((guest, i) => (
          <div
            key={guest.id}
            className={
              'flex items-center justify-between gap-4 px-4 py-3.5 ' +
              (i > 0 ? 'border-t border-neutral-200 dark:border-neutral-800' : '')
            }
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {guest.first_name} {guest.last_name}
              </p>
              {guest.scheduled_arrival && (
                <p className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                  <CalendarBlank size={12} />
                  {formatDateTime(guest.scheduled_arrival)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <StatusBadge status={guest.status} />
              {guest.status === 'invited' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2 text-neutral-400 hover:text-status-danger"
                  aria-label="Cancel guest"
                  loading={cancellingId === guest.id}
                  onClick={() => onCancel(guest.id)}
                >
                  {cancellingId !== guest.id && <X size={15} />}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
