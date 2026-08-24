import { Badge } from '@/components/ui/Badge'

const STATUS_CONFIG = {
  invited: { label: 'Invited', tone: 'neutral' },
  approved: { label: 'Approved', tone: 'approved' },
  denied: { label: 'Denied', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  checked_in: { label: 'Checked in', tone: 'success' },
  checked_out: { label: 'Checked out', tone: 'neutral' },
}

export function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || { label: status, tone: 'neutral' }
  return <Badge tone={config.tone}>{config.label}</Badge>
}
