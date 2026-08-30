import { forwardRef } from 'react'
import { cva } from 'class-variance-authority'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-field)] text-sm font-medium transition-colors ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 ' +
    'ring-offset-neutral-0 dark:ring-offset-neutral-950 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-accent-600 text-accent-contrast hover:bg-accent-700',
        secondary:
          'bg-neutral-100 text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700',
        ghost: 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300',
        danger: 'bg-status-danger text-white hover:opacity-90',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4',
        lg: 'h-11 px-5',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
)

// Press/hover feedback is Motion-driven here (spring physics, slight
// overshoot) rather than CSS active:scale — the two would fight over the
// same transform if both applied to this element. Plain buttonVariants
// (used directly on non-Button elements like CTA Links) still gets a CSS
// fallback where it's applied.
export const Button = forwardRef(function Button(
  { className, variant, size, loading, children, disabled, ...props },
  ref
) {
  const reduce = useReducedMotion()

  return (
    <motion.button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      whileHover={reduce || disabled || loading ? undefined : { scale: 1.02 }}
      whileTap={reduce || disabled || loading ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
      {...props}
    >
      {loading && (
        <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </motion.button>
  )
})
