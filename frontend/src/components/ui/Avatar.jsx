import { cn } from '@/lib/utils'

// Deterministic color per name (not random) so the same person always gets
// the same color across renders/lists. Rotates through the existing palette
// rather than introducing new hues, so it stays "coastal," not confetti.
const PALETTE = [
  'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300',
  'bg-coral-100 text-coral-700 dark:bg-coral-700/25 dark:text-coral-300',
  'bg-status-success-bg text-status-success',
  'bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200',
]

function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function Avatar({ name, size = 'md', className }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?'

  const palette = PALETTE[hashString(name) % PALETTE.length]
  const sizeClass = size === 'sm' ? 'size-8 text-xs' : 'size-10 text-sm'

  return (
    <div className={cn('flex shrink-0 items-center justify-center rounded-full font-semibold', sizeClass, palette, className)}>
      {initials}
    </div>
  )
}
