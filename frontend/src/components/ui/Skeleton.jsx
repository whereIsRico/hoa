import { cn } from '@/lib/utils'

export function Skeleton({ className }) {
  return <div className={cn('skeleton-shimmer rounded-md', className)} />
}

// Matches the shape of a guest row so the loading state doesn't jump when
// real data arrives.
export function GuestRowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 px-4 py-3.5">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-5 w-20 rounded-full" />
    </div>
  )
}
