import { motion, useReducedMotion } from 'motion/react'
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
  const reduce = useReducedMotion()
  const config = STATUS_CONFIG[status] || { label: status, tone: 'neutral' }

  return (
    <motion.span
      key={status}
      initial={reduce ? false : { scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 18 }}
      className="inline-flex"
    >
      <Badge tone={config.tone}>{config.label}</Badge>
    </motion.span>
  )
}
