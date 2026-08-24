import { cn } from '@/lib/utils'

export function Switch({ checked, onChange, label, description, disabled }) {
  return (
    <label className={cn('flex items-start justify-between gap-4 py-1', disabled ? 'opacity-50' : 'cursor-pointer')}>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{label}</span>
        {description && <span className="text-xs text-neutral-500 dark:text-neutral-400">{description}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 ring-offset-neutral-0 dark:ring-offset-neutral-950',
          checked ? 'bg-accent-600' : 'bg-neutral-300 dark:bg-neutral-700'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          )}
        />
      </button>
    </label>
  )
}
