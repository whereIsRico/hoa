import { cn } from '@/lib/utils'

// Deterministic color per name (not random) so the same person always gets
// the same color across renders/lists. Rotates through the existing palette
// rather than introducing new hues. Skewed toward accent-2 (ink navy) per
// the redesign spec — amber and coral stay in the rotation for variety, but
// navy is now the dominant read rather than one entry among equals.
const PALETTE = [
  'bg-accent2-100 text-accent2-700 dark:bg-accent2-900/40 dark:text-accent2-300',
  'bg-accent2-500 text-accent2-contrast dark:bg-accent2-300 dark:text-accent2-900',
  'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300',
  'bg-coral-100 text-coral-700 dark:bg-coral-700/25 dark:text-coral-300',
]

// Organic "blob" shape, not a circle — the one hand-tuned asymmetric radius
// used across the redesign for avatars.
const BLOB_RADIUS = '30% 70% 65% 35% / 45% 35% 65% 55%'

function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function Avatar({ name, size = 'md', className, style }) {
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
    <div
      className={cn('flex shrink-0 items-center justify-center font-semibold', sizeClass, palette, className)}
      style={{ borderRadius: BLOB_RADIUS, ...style }}
    >
      {initials}
    </div>
  )
}
