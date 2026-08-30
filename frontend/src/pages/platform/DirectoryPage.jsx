import { useEffect, useMemo, useState } from 'react'
import { Buildings, MagnifyingGlass, Phone } from '@phosphor-icons/react'
import { usePlatformAuth } from '@/context/PlatformAuthContext'
import { platformApi, ApiError } from '@/lib/api'
import { TIER_LABELS } from '@/lib/constants'
import { Badge } from '@/components/ui/Badge'
import { Banner } from '@/components/ui/Banner'
import { EmptyState } from '@/components/ui/EmptyState'
import { GuestRowSkeleton } from '@/components/ui/Skeleton'
import { Avatar } from '@/components/ui/Avatar'
import { Input } from '@/components/ui/Field'
import { buttonVariants, Button } from '@/components/ui/Button'
import { Modal, ModalHeader, ModalTitle, ModalBody } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'

const TIER_FILTERS = [
  { value: '', label: 'All tiers' },
  { value: 'starter', label: TIER_LABELS.starter },
  { value: 'professional', label: TIER_LABELS.professional },
  { value: 'enterprise', label: TIER_LABELS.enterprise },
]

export function DirectoryPage() {
  const { token } = usePlatformAuth()
  const [communities, setCommunities] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [tier, setTier] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    platformApi
      .listCommunities(token)
      .then(({ communities }) => setCommunities(communities))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load directory'))
  }, [token])

  const filtered = useMemo(() => {
    if (!communities) return null
    const q = search.trim().toLowerCase()
    return communities.filter((c) => {
      if (tier && c.subscription_tier !== tier) return false
      if (!q) return true
      return (
        c.name.toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q)
      )
    })
  }, [communities, search, tier])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Directory</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Office contact for every HOA on the platform</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <MagnifyingGlass
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or phone"
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {TIER_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setTier(f.value)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                tier === f.value
                  ? 'bg-accent2-100 text-accent2-700 dark:bg-accent2-900/40 dark:text-accent2-300'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <Banner tone="danger">{error}</Banner>}

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-neutral-200 dark:border-neutral-800">
        {filtered === null && !error && (
          <>
            <GuestRowSkeleton />
            <GuestRowSkeleton />
          </>
        )}

        {filtered?.length === 0 && (
          <EmptyState icon={Buildings} title="No matches" description="Try a different search or filter" />
        )}

        {filtered?.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelected(c)}
            className={cn(
              'flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50',
              i > 0 && 'border-t border-neutral-200 dark:border-neutral-800'
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Avatar name={c.name} size="sm" />
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">{c.name}</p>
                <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                  {c.email || 'No contact email on file'}
                  {c.phone && ` · ${c.phone}`}
                </p>
              </div>
            </div>
            <Badge tone="approved" className="shrink-0">
              {TIER_LABELS[c.subscription_tier] || c.subscription_tier}
            </Badge>
          </button>
        ))}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)}>
        <ModalHeader>
          <ModalTitle>{selected?.name}</ModalTitle>
        </ModalHeader>
        <ModalBody className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
              Office contact
            </p>
            <p className="text-sm text-neutral-900 dark:text-neutral-100">
              {selected?.email || 'No contact email on file'}
            </p>
            <p className="text-sm text-neutral-900 dark:text-neutral-100">{selected?.phone || 'No phone on file'}</p>
          </div>
          {selected?.phone ? (
            <a
              href={`tel:${selected.phone}`}
              className={cn(buttonVariants({ size: 'md' }), 'inline-flex items-center justify-center gap-2')}
            >
              <Phone size={16} weight="bold" />
              Call office
            </a>
          ) : (
            <Button size="md" disabled className="inline-flex items-center justify-center gap-2">
              <Phone size={16} weight="bold" />
              No phone on file
            </Button>
          )}
        </ModalBody>
      </Modal>
    </div>
  )
}
