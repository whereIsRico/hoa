import { motion, useReducedMotion } from 'motion/react'
import { ArgusMark } from '@/components/ArgusMark'

export function AuthLayout({ title, subtitle, children, footer }) {
  const reduce = useReducedMotion()

  return (
    <div className="flex min-h-dvh items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4 py-12">
      <motion.div
        className="w-full max-w-sm"
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <ArgusMark className="mb-3 h-11 w-auto" />
          <p className="font-display text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">Palisade</p>
          <h1 className="mt-3 text-xl font-semibold text-neutral-900 dark:text-neutral-100">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{subtitle}</p>}
        </div>
        <div className="rounded-[var(--radius-card)] border border-neutral-200 dark:border-neutral-800 bg-neutral-0 dark:bg-neutral-900 p-6">
          {children}
        </div>
        {footer && <div className="mt-5 text-center text-sm text-neutral-500 dark:text-neutral-400">{footer}</div>}
      </motion.div>
    </div>
  )
}
