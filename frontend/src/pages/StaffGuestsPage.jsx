import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { UsersThree, CalendarBlank, ArrowCounterClockwise, SignIn, SignOut as SignOutIcon, Check } from '@phosphor-icons/react'
import { useStaffAuth } from '@/context/StaffAuthContext'
import { guestsApi, ApiError } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { Banner } from '@/components/ui/Banner'
import { EmptyState } from '@/components/ui/EmptyState'
import { GuestRowSkeleton } from '@/components/ui/Skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { Avatar } from '@/components/ui/Avatar'

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'invited', label: 'Invited' },
  { value: 'approved', label: 'Approved' },
  { value: 'checked_in', label: 'Checked in' },
  { value: 'checked_out', label: 'Checked out' },
  { value: 'denied', label: 'Denied' },
  { value: 'cancelled', label: 'Cancelled' },
]

const CHECK_OUT_FROM = ['checked_in']

// Approximates "real-time" via polling rather than a websocket layer, which
// would be a much bigger lift than this pass calls for.
const POLL_INTERVAL_MS = 20000

export function StaffGuestsPage() {
  const { token } = useStaffAuth()
  const reduce = useReducedMotion()
  const [guests, setGuests] = useState(null)
  const [policy, setPolicy] = useState(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState(null)
  const [actingId, setActingId] = useState(null)
  const [verifyingId, setVerifyingId] = useState(null)
  const pollRef = useRef(null)

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setError(null)
      try {
        const { guests, policy } = await guestsApi.listGate(token, status || undefined)
        setGuests(guests)
        setPolicy(policy)
      } catch (err) {
        if (!silent) setError(err instanceof ApiError ? err.message : 'Could not load guests')
      }
    },
    [token, status]
  )

  useEffect(() => {
    setGuests(null)
    load()

    clearInterval(pollRef.current)
    pollRef.current = setInterval(() => load({ silent: true }), POLL_INTERVAL_MS)
    return () => clearInterval(pollRef.current)
  }, [load])

  // A guest can only be checked in from a state that means "expected but not
  // here yet." Which statuses qualify depends on whether this community
  // requires admin approval first — matches the backend's own rule exactly.
  const checkInFromStatuses = policy?.auto_approval_enabled ? ['invited', 'approved'] : ['approved']

  const startCheckIn = (guestId) => {
    if (policy?.require_id_verification) {
      setVerifyingId(guestId)
      return
    }
    doCheckIn(guestId)
  }

  const doCheckIn = async (guestId, idVerified) => {
    setActingId(guestId)
    try {
      await guestsApi.checkIn(token, guestId, idVerified)
      setVerifyingId(null)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not check in guest')
    } finally {
      setActingId(null)
    }
  }

  const onCheckOut = async (guestId) => {
    setActingId(guestId)
    try {
      await guestsApi.checkOut(token, guestId)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not check out guest')
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Guests</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Everyone expected at the gate</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => load()} className="inline-flex items-center gap-1.5">
          <ArrowCounterClockwise size={15} />
          Refresh
        </Button>
      </div>

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
            <GuestRowSkeleton />
          </>
        )}

        {guests?.length === 0 && (
          <EmptyState
            icon={UsersThree}
            title={status ? `No guests with status "${status.replace('_', ' ')}"` : 'No guests expected'}
          />
        )}

        {guests?.map((guest, i) => {
          const canCheckIn = checkInFromStatuses.includes(guest.status)
          const canCheckOut = CHECK_OUT_FROM.includes(guest.status)
          const acting = actingId === guest.id
          const verifying = verifyingId === guest.id

          return (
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
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={`${guest.first_name} ${guest.last_name}`} size="sm" />
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {guest.first_name} {guest.last_name}
                    </p>
                    <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                      Invited by {guest.resident_first_name} {guest.resident_last_name}
                      {guest.resident_unit_number && ` · Unit ${guest.resident_unit_number}`}
                    </p>
                    {guest.scheduled_arrival && (
                      <p className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                        <CalendarBlank size={12} />
                        {formatDateTime(guest.scheduled_arrival)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={guest.status} />
                  {canCheckIn && !verifying && (
                    <Button size="sm" loading={acting} onClick={() => startCheckIn(guest.id)} className="inline-flex items-center gap-1.5">
                      {!acting && <SignIn size={14} weight="bold" />}
                      Check in
                    </Button>
                  )}
                  {canCheckOut && (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={acting}
                      onClick={() => onCheckOut(guest.id)}
                      className="inline-flex items-center gap-1.5"
                    >
                      {!acting && <SignOutIcon size={14} weight="bold" />}
                      Check out
                    </Button>
                  )}
                </div>
              </div>

              {verifying && (
                <div className="flex items-center justify-between gap-3 rounded-[var(--radius-field)] bg-neutral-50 dark:bg-neutral-800/50 p-2.5">
                  <p className="text-xs text-neutral-600 dark:text-neutral-300">
                    This community requires ID verification at check-in
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      loading={acting}
                      onClick={() => doCheckIn(guest.id, true)}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      {!acting && <Check size={14} weight="bold" />}
                      ID verified
                    </Button>
                    <Button size="sm" variant="ghost" disabled={acting} onClick={() => setVerifyingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
