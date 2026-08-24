import { WarningCircle, CheckCircle, XCircle, Info } from '@phosphor-icons/react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

const icons = { warning: WarningCircle, success: CheckCircle, danger: XCircle, info: Info }
const tones = {
  warning: 'bg-status-warning-bg text-status-warning border-coral-300',
  success: 'bg-status-success-bg text-status-success border-status-success/30',
  danger: 'bg-status-danger-bg text-status-danger border-status-danger/30',
  info: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700',
}

export function Banner({ tone = 'info', title, children, className }) {
  const Icon = icons[tone]
  const reduce = useReducedMotion()

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.97, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 450, damping: 24 }}
      className={cn('flex gap-3 rounded-[var(--radius-card)] border px-4 py-3 text-sm', tones[tone], className)}
    >
      <Icon size={18} weight="fill" className="mt-0.5 shrink-0" />
      <div className="flex flex-col gap-0.5">
        {title && <p className="font-medium">{title}</p>}
        {children && <p className="text-[13px] opacity-90">{children}</p>}
      </div>
    </motion.div>
  )
}
