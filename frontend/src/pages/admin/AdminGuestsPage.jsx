import { useEffect, useState, useCallback } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { UsersThree, Check, X } from '@phosphor-icons/react'
import { useAuth } from '@/context/AuthContext'
import { guestsApi, ApiError } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Select, Input } from '@/components/ui/Field'
import { Banner } from '@/components/ui/Banner'
import { EmptyState } from '@/components/ui/EmptyState'
import { GuestRowSkeleton } from '@/components/ui/Skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { Avatar } from '@/components/ui/Avatar'

const STATUS_FILTERS = [
  { value: 'invited', label: 'Needs review' },
  { value: '', label: 'All statuses' },
  { value: 'approved', label: 'Approved' },
  { value: 'checked_in', label: 'Checked in' },
  { value: 'checked_out', label: 'Checked out' },
  { value: 'denied', label: 'Denied' },
  { value: 'cancelled', label: 'Cancelled' },
]

export function AdminGuestsPage() {
  const { token } = useAuth()
  const reduce = useReducedMotion()
  const [guests, setGuests] = useState(null)
  const [status, setStatus] = useState('invited')
  const [error, setError] = useState(null)
  const [actingId, setActingId] = useState(null)
  const [denyingId, setDenyingId] = useState(null)
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    setError(null)
    try {
      const { guests } = await guestsApi.listAdmin(token, status || undefined)
      setGuests(guests)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load guests')
    }
  }, [token, status])

  useEffect(() => {
    setGuests(null)
    load()
  }, [load])

  const onApprove = async (id) => {
    setActingId(id)
    try {
      await guestsApi.approve(token, id)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not approve guest')
    } finally {
      setActingId(null)
    }
  }

  const startDeny = (id) => {
    setDenyingId(id)
    setReason('')
  }

  const confirmDeny = async (id) => {
    setActingId(id)
    try {
      await guestsApi.deny(token, id, reason.trim() || undefined)
      setDenyingId(null)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not deny guest')
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-48">
        {STATUS_FILTERS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </Select>

      {error && <Banner tone="danger">{error}</Banner>}

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-neutral-200 dark:border-neutral-800">
        {guests === null && !error && (
          <>
            <GuestRowSkeleton />
            <GuestRowSkeleton />
          </>
        )}

        {guests?.length === 0 && (
          <EmptyState
            icon={UsersThree}
            title={status === 'invited' ? 'Nothing needs review' : 'No guests found'}
            description={status === 'invited' && 'New guest invites will show up here for approval'}
          />
        )}

        {guests?.map((guest, i) => (
          <motion.div
            key={guest.id}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 26, delay: reduce ? 0 : i * 0.04 }}
            className={
              'flex flex-col gap-3 px-4 py-3.5 ' +
              (i > 0 ? 'border-t border-neutral-200 dark:border-neutral-800' : '')
            }
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={`${guest.first_name} ${guest.last_name}`} size="sm" />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {guest.first_name} {guest.last_name}
                  </p>
                  <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                    Invited by {guest.resident_first_name} {guest.resident_last_name}
                    {guest.resident_unit_number && ` · Unit ${guest.resident_unit_number}`}
                    {guest.scheduled_arrival && ` · ${formatDateTime(guest.scheduled_arrival)}`}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                <StatusBadge status={guest.status} />
                {guest.status === 'invited' && denyingId !== guest.id && (
                  <>
                    <Button
                      size="sm"
                      loading={actingId === guest.id}
                      onClick={() => onApprove(guest.id)}
                      className="inline-flex items-center gap-1.5"
                    >
                      {actingId !== guest.id && <Check size={14} weight="bold" />}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={actingId === guest.id}
                      onClick={() => startDeny(guest.id)}
                      className="inline-flex items-center gap-1.5"
                    >
                      <X size={14} weight="bold" />
                      Deny
                    </Button>
                  </>
                )}
              </div>
            </div>

            {denyingId === guest.id && (
              <div className="flex items-center gap-2 rounded-[var(--radius-field)] bg-neutral-50 dark:bg-neutral-800/50 p-2.5">
                <Input
                  autoFocus
                  placeholder="Reason (optional)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="h-8 flex-1"
                />
                <Button
                  size="sm"
                  variant="danger"
                  loading={actingId === guest.id}
                  onClick={() => confirmDeny(guest.id)}
                  className="shrink-0 whitespace-nowrap"
                >
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={actingId === guest.id}
                  onClick={() => setDenyingId(null)}
                  className="shrink-0 whitespace-nowrap"
                >
                  Cancel
                </Button>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
