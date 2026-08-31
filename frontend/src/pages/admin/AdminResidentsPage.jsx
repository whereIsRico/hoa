import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { UserCircle, MagnifyingGlass, Buildings, Plus, PencilSimple } from '@phosphor-icons/react'
import { useAuth } from '@/context/AuthContext'
import { adminApi, ApiError } from '@/lib/api'
import { useDirectorySearch, STATUS_FILTERS } from '@/lib/useDirectorySearch'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'
import { Banner } from '@/components/ui/Banner'
import { EmptyState } from '@/components/ui/EmptyState'
import { GuestRowSkeleton } from '@/components/ui/Skeleton'
import { Avatar } from '@/components/ui/Avatar'
import { DirectoryDetailModal } from '@/components/DirectoryDetailModal'
import { ContactFormModal } from '@/components/ContactFormModal'
import { cn } from '@/lib/utils'

const SEARCH_FIELDS = ['first_name', 'last_name', 'unit_number', 'phone']

const chipClass = (active) =>
  cn(
    'rounded-[var(--radius-field)] border px-3 py-1.5 text-sm font-medium transition-colors',
    active
      ? 'border-accent2-500 bg-accent2-100 text-accent2-700 dark:border-accent2-400 dark:bg-accent2-900/40 dark:text-accent2-300'
      : 'border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800'
  )

export function AdminResidentsPage() {
  const { token, resident: self } = useAuth()
  const reduce = useReducedMotion()
  const [residents, setResidents] = useState(null)
  const [contacts, setContacts] = useState(null)
  const [community, setCommunity] = useState(null)
  const [error, setError] = useState(null)
  const [actingId, setActingId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [contactModal, setContactModal] = useState(null) // { contact: null | object } while open
  const [deletingId, setDeletingId] = useState(null)

  const people = useMemo(() => {
    if (residents === null || contacts === null) return null
    return [
      ...residents.map((r) => ({ ...r, kind: 'resident' })),
      ...contacts.map((c) => ({ ...c, kind: 'contact' })),
    ]
  }, [residents, contacts])

  const { search, setSearch, statusFilter, setStatusFilter, filtered } = useDirectorySearch(people, {
    searchFields: SEARCH_FIELDS,
  })

  const load = useCallback(async () => {
    setError(null)
    try {
      const [{ residents }, { contacts }, { community }] = await Promise.all([
        adminApi.listResidents(token),
        adminApi.listContacts(token),
        adminApi.getCommunity(token),
      ])
      setResidents(residents)
      setContacts(contacts)
      setCommunity(community)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load residents')
    }
  }, [token])

  useEffect(() => {
    setResidents(null)
    setContacts(null)
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

  const onContactSaved = () => {
    setContactModal(null)
    load()
  }

  const confirmDeleteContact = async (contact) => {
    setActingId(contact.id)
    try {
      await adminApi.deleteContact(token, contact.id)
      setDeletingId(null)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete contact')
    } finally {
      setActingId(null)
    }
  }

  const confirmRejectResident = async (resident) => {
    setActingId(resident.id)
    try {
      await adminApi.rejectResident(token, resident.id)
      setDeletingId(null)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reject resident')
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
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

        <div className="flex flex-wrap items-center gap-2">
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

      <div className="flex items-center justify-end">
        <Button size="sm" onClick={() => setContactModal({ contact: null })} className="inline-flex items-center gap-1.5">
          <Plus size={15} weight="bold" />
          Add contact
        </Button>
      </div>

      {error && <Banner tone="danger">{error}</Banner>}

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-neutral-200 dark:border-neutral-800">
        {people === null && !error && (
          <>
            <GuestRowSkeleton />
            <GuestRowSkeleton />
          </>
        )}

        {community && (
          <button
            type="button"
            onClick={() =>
              setDetail({
                name: community.name,
                phone: community.phone,
                fields: [
                  { label: 'Email', value: community.email },
                  { label: 'Address', value: community.address },
                ],
              })
            }
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

        {people?.length === 0 && <EmptyState icon={UserCircle} title="No residents found" />}

        {people?.length > 0 && filtered.length === 0 && (
          <EmptyState icon={UserCircle} title="No residents match your search" />
        )}

        {filtered.map((person, i) => (
          <motion.div
            key={`${person.kind}-${person.id}`}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 26, delay: reduce ? 0 : i * 0.04 }}
            className={
              'flex flex-col gap-3 px-4 py-3.5 ' +
              (i > 0 || community ? 'border-t border-neutral-200 dark:border-neutral-800' : '')
            }
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <button
                type="button"
                onClick={() =>
                  person.kind === 'contact'
                    ? setDetail({
                        name: `${person.first_name} ${person.last_name}`,
                        unitNumber: person.unit_number,
                        phone: person.phone,
                        fields: [{ label: 'Notes', value: person.notes }],
                        badge: <Badge tone="neutral">Not on Palisade</Badge>,
                      })
                    : setDetail({
                        name: `${person.first_name} ${person.last_name}`,
                        unitNumber: person.unit_number,
                        phone: person.phone,
                      })
                }
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <Avatar name={`${person.first_name} ${person.last_name}`} size="sm" />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {person.first_name} {person.last_name}
                    {person.kind === 'resident' && person.id === self.id && (
                      <span className="text-neutral-400 dark:text-neutral-500"> (you)</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                    {person.kind === 'resident' ? person.email : person.phone || 'No phone on file'}
                    {person.unit_number && ` · Unit ${person.unit_number}`}
                  </p>
                </div>
              </button>
              <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                {person.kind === 'resident' ? (
                  deletingId === person.id ? null : (
                    <>
                      {person.role === 'admin' && <Badge tone="approved">Admin</Badge>}
                      <Badge tone={person.is_approved ? 'success' : person.email_verified ? 'neutral' : 'warning'}>
                        {person.is_approved ? 'On Palisade' : person.email_verified ? 'Pending' : 'Unverified'}
                      </Badge>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={actingId === person.id}
                        onClick={() => toggleApproval(person)}
                      >
                        {person.is_approved ? 'Revoke' : 'Approve'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={actingId === person.id}
                        onClick={() => toggleRole(person)}
                      >
                        {person.role === 'admin' ? 'Demote' : 'Make admin'}
                      </Button>
                      {!person.is_approved && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={actingId === person.id}
                          onClick={() => setDeletingId(person.id)}
                        >
                          Reject
                        </Button>
                      )}
                    </>
                  )
                ) : (
                  <>
                    <Badge tone="neutral">Not on Palisade</Badge>
                    {deletingId !== person.id && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setContactModal({ contact: person })}
                          aria-label={`Edit ${person.first_name} ${person.last_name}`}
                        >
                          <PencilSimple size={15} />
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setDeletingId(person.id)}>
                          Delete
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {deletingId === person.id && (
              <div className="flex items-center justify-end gap-2 rounded-[var(--radius-field)] bg-neutral-50 dark:bg-neutral-800/50 p-2.5">
                <p className="mr-auto text-sm text-neutral-600 dark:text-neutral-400">
                  {person.kind === 'contact'
                    ? `Delete ${person.first_name} ${person.last_name}?`
                    : `Reject ${person.first_name} ${person.last_name}'s registration?`}
                </p>
                <Button
                  size="sm"
                  variant="danger"
                  loading={actingId === person.id}
                  onClick={() => (person.kind === 'contact' ? confirmDeleteContact(person) : confirmRejectResident(person))}
                  className="shrink-0 whitespace-nowrap"
                >
                  {person.kind === 'contact' ? 'Confirm delete' : 'Confirm reject'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={actingId === person.id}
                  onClick={() => setDeletingId(null)}
                  className="shrink-0 whitespace-nowrap"
                >
                  Cancel
                </Button>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <DirectoryDetailModal
        open={detail !== null}
        onClose={() => setDetail(null)}
        name={detail?.name}
        unitNumber={detail?.unitNumber}
        phone={detail?.phone}
        fields={detail?.fields}
        badge={detail?.badge}
      />

      <ContactFormModal
        open={contactModal !== null}
        onClose={() => setContactModal(null)}
        token={token}
        contact={contactModal?.contact}
        onSaved={onContactSaved}
      />
    </div>
  )
}
