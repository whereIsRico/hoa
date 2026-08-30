import { cn } from '@/lib/utils'

export function Badge({ className, tone = 'neutral', children }) {
  const tones = {
    neutral: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
    approved: 'bg-status-approved-bg text-status-approved',
    success: 'bg-status-success-bg text-status-success',
    warning: 'bg-status-warning-bg text-status-warning',
    danger: 'bg-status-danger-bg text-status-danger',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
