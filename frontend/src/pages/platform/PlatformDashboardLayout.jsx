import { SignOut } from '@phosphor-icons/react'
import { usePlatformAuth } from '@/context/PlatformAuthContext'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ThemeToggle'
import { AnimatedOutlet } from '@/components/AnimatedOutlet'

export function PlatformDashboardLayout() {
  const { platformAdmin, logout } = usePlatformAuth()

  return (
    <div className="min-h-dvh bg-neutral-50 dark:bg-neutral-950">
      <header className="sticky top-0 z-10 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-0/90 dark:bg-neutral-900/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
              Passage
            </span>
            <span className="text-sm text-neutral-400 dark:text-neutral-500">Platform</span>
          </div>
          <div className="flex items-center gap-3">
            {platformAdmin && (
              <span className="hidden text-sm text-neutral-500 dark:text-neutral-400 sm:inline">
                {platformAdmin.first_name} {platformAdmin.last_name}
              </span>
            )}
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={logout} aria-label="Sign out">
              <SignOut size={17} />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <AnimatedOutlet />
      </main>
    </div>
  )
}
