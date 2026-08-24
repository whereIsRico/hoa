import { forwardRef, useId } from 'react'
import { cn } from '@/lib/utils'

const fieldBase =
  'h-10 w-full rounded-[var(--radius-field)] border border-neutral-300 dark:border-neutral-700 ' +
  'bg-neutral-0 dark:bg-neutral-900 px-3 text-sm text-neutral-900 dark:text-neutral-100 ' +
  'placeholder:text-neutral-400 dark:placeholder:text-neutral-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed'

export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(fieldBase, className)} {...props} />
})

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(fieldBase, 'pr-8', className)} {...props}>
      {children}
    </select>
  )
})

export const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(fieldBase, 'h-auto min-h-20 py-2', className)} {...props} />
})

// Label + input + optional helper/error text, wired together via a shared id.
export function FormField({ label, helper, error, required, children }) {
  const id = useId()
  const child = children({ id, 'aria-invalid': !!error, 'aria-describedby': error ? `${id}-error` : undefined })

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {label}
        {required && <span className="text-status-danger"> *</span>}
      </label>
      {child}
      {helper && !error && <p className="text-xs text-neutral-500 dark:text-neutral-400">{helper}</p>}
      {error && (
        <p id={`${id}-error`} className="text-xs text-status-danger">
          {error}
        </p>
      )}
    </div>
  )
}
