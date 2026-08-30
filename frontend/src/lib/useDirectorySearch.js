import { useMemo, useState } from 'react'

// Shared between Admin's residents page and Gate Staff's directory — both
// need the same search-box + status-chip filtering over a community-scoped
// resident list. No backend search endpoint exists for this (or anything
// else in the app — see REDESIGN_IMPLEMENTATION_PLAN.md), so this stays a
// client-side substring filter over whatever list the caller already fetched.
export const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'approved', label: 'On Palisade' },
  { value: 'pending', label: 'Pending' },
]

export function useDirectorySearch(items, { searchFields = [] } = {}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = useMemo(() => {
    const list = items ?? []
    const term = search.trim().toLowerCase()

    return list.filter((item) => {
      if (statusFilter === 'approved' && !item.is_approved) return false
      if (statusFilter === 'pending' && item.is_approved) return false
      if (!term) return true

      // Joined rather than matched field-by-field so a query spanning two
      // fields (e.g. "jane 12b") still hits, not just single-field substrings.
      const haystack = searchFields.map((field) => item[field] ?? '').join(' ').toLowerCase()
      return haystack.includes(term)
    })
  }, [items, search, statusFilter, searchFields])

  return { search, setSearch, statusFilter, setStatusFilter, filtered }
}
