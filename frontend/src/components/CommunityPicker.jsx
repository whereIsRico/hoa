import { useEffect, useState } from 'react'
import { communitiesApi } from '@/lib/api'
import { Select } from '@/components/ui/Field'

export function CommunityPicker({ value, onChange, id, ...props }) {
  const [communities, setCommunities] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    communitiesApi
      .list()
      .then(({ communities }) => setCommunities(communities))
      .catch(() => setError('Could not load communities'))
  }, [])

  if (error) {
    return <p className="text-sm text-status-danger">{error}</p>
  }

  return (
    <Select
      id={id}
      value={value}
      onChange={onChange}
      disabled={!communities}
      {...props}
    >
      <option value="" disabled>
        {communities ? 'Select your community' : 'Loading communities…'}
      </option>
      {communities?.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </Select>
  )
}
