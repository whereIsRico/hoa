import { useEffect, useState, useCallback } from 'react'
import { UserCircle } from '@phosphor-icons/react'
import { useAuth } from '@/context/AuthContext'
import { adminApi, ApiError } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'
import { Banner } from '@/components/ui/Banner'
import { EmptyState } from '@/components/ui/EmptyState'
import { GuestRowSkeleton } from '@/components/ui/Skeleton'

const APPROVAL_FILTERS = [
  { value: '', label: 'All residents' },
  { value: 'false', label: 'Pending approval' },
  { value: 'true', label: 'Approved' },
]

export function AdminResidentsPage() {
  const { token, resident: self } = useAuth()
  const [residents, setResidents] = useState(null)
  const [approvedFilter, setApprovedFilter] = useState('')
  const [error, setError] = useState(null)
  const [actingId, setActingId] = useState(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const { residents } = await adminApi.listResidents(token, approvedFilter || undefined)
      setResidents(residents)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load residents')
    }
  }, [token, approvedFilter])

  useEffect(() => {
    setResidents(null)
    load()
  }, [load])

  const toggleApproval = async (resident) => {
    setActingId(resident.id)
    try {
      await adminApi.updateResidentApproval(token, resident.id, !resident.is_approved)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update approval')
    } finally {
      setActingId(null)
    }
  }

  const toggleRole = async (resident) => {
    const nextRole = resident.role === 'admin' ? 'resident' : 'admin'
    setActingId(resident.id)
    try {
      await adminApi.updateResidentRole(token, resident.id, nextRole)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update role')
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Select value={approvedFilter} onChange={(e) => setApprovedFilter(e.target.value)} className="w-48">
        {APPROVAL_FILTERS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </Select>

      {error && <Banner tone="danger">{error}</Banner>}

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-neutral-200 dark:border-neutral-800">
        {residents === null && !error && (
          <>
            <GuestRowSkeleton />
            <GuestRowSkeleton />
          </>
        )}

        {residents?.length === 0 && <EmptyState icon={UserCircle} title="No residents found" />}

        {residents?.map((resident, i) => (
          <div
            key={resident.id}
            className={
              'flex items-center justify-between gap-4 px-4 py-3.5 ' +
              (i > 0 ? 'border-t border-neutral-200 dark:border-neutral-800' : '')
            }
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {resident.first_name} {resident.last_name}
                {resident.id === self.id && <span className="text-neutral-400 dark:text-neutral-500"> (you)</span>}
              </p>
              <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                {resident.email}
                {resident.unit_number && ` · Unit ${resident.unit_number}`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {resident.role === 'admin' && <Badge tone="approved">Admin</Badge>}
              <Badge tone={resident.is_approved ? 'success' : 'neutral'}>
                {resident.is_approved ? 'Approved' : 'Pending'}
              </Badge>
              <Button
                size="sm"
                variant="secondary"
                loading={actingId === resident.id}
                onClick={() => toggleApproval(resident)}
              >
                {resident.is_approved ? 'Revoke' : 'Approve'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={actingId === resident.id}
                onClick={() => toggleRole(resident)}
              >
                {resident.role === 'admin' ? 'Demote' : 'Make admin'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
