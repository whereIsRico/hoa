import { useMemo, useState } from 'react'

// Shared between Admin's residents page and Gate Staff's directory — both
// need the same search-box + status-chip filtering over a community-scoped,
// merged list of residents (kind: 'resident') and manual contacts
// (kind: 'contact' — people the HOA has a phone number for who never
// created a Palisade account). No backend search endpoint exists for this
// (or anything else in the app — see REDESIGN_IMPLEMENTATION_PLAN.md), so
// this stays a client-side substring filter over whatever list the caller
// already fetched.
export const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'approved', label: 'On Palisade' },
  { value: 'pending', label: 'Pending' },
  { value: 'not_on_platform', label: 'Not on Palisade' },
]

function matchesStatus(item, statusFilter) {
  if (statusFilter === 'all') return true
  if (statusFilter === 'not_on_platform') return item.kind === 'contact'
  // approved/pending are resident-only states — a manual contact never has
  // an account to approve, so it never matches either chip.
  if (item.kind === 'contact') return false
  if (statusFilter === 'approved') return !!item.is_approved
  if (statusFilter === 'pending') return !item.is_approved
  return true
}

export function useDirectorySearch(items, { searchFields = [] } = {}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = useMemo(() => {
    const list = items ?? []
    const term = search.trim().toLowerCase()

    return list.filter((item) => {
      if (!matchesStatus(item, statusFilter)) return false
      if (!term) return true

      // Joined rather than matched field-by-field so a query spanning two
      // fields (e.g. "jane 12b") still hits, not just single-field substrings.
      const haystack = searchFields.map((field) => item[field] ?? '').join(' ').toLowerCase()
      return haystack.includes(term)
    })
  }, [items, search, statusFilter, searchFields])

  return { search, setSearch, statusFilter, setStatusFilter, filtered }
}
