import { cn } from '@/lib/utils'

export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] border border-neutral-200 dark:border-neutral-800 bg-neutral-0 dark:bg-neutral-900',
        className
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('flex flex-col gap-1 p-5 pb-0', className)} {...props} />
}

export function CardTitle({ className, ...props }) {
  return <h2 className={cn('text-base font-semibold text-neutral-900 dark:text-neutral-100', className)} {...props} />
}

export function CardDescription({ className, ...props }) {
  return <p className={cn('text-sm text-neutral-500 dark:text-neutral-400', className)} {...props} />
}

export function CardContent({ className, ...props }) {
  return <div className={cn('p-5', className)} {...props} />
}
