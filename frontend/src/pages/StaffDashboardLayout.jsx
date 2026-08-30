import { NavLink } from 'react-router-dom'
import { SignOut, UsersThree, IdentificationBadge } from '@phosphor-icons/react'
import { useStaffAuth } from '@/context/StaffAuthContext'
import { Button } from '@/components/ui/Button'
import { AnimatedOutlet } from '@/components/AnimatedOutlet'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ArgusMark } from '@/components/ArgusMark'
import { cn } from '@/lib/utils'

const tabClass = ({ isActive }) =>
  cn(
    'flex items-center gap-1.5 rounded-[var(--radius-field)] px-3 py-1.5 text-sm font-medium transition-colors',
    isActive
      ? 'bg-accent2-100 text-accent2-700 dark:bg-accent2-900/40 dark:text-accent2-300'
      : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
  )

export function StaffDashboardLayout() {
  const { staff, logout } = useStaffAuth()

  return (
    <div className="min-h-dvh bg-neutral-50 dark:bg-neutral-950">
      <header className="sticky top-0 z-10 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-0/90 dark:bg-neutral-900/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <div className="flex items-baseline gap-2">
            <span className="flex items-center gap-2">
              <ArgusMark className="h-6 w-auto" />
              <span className="font-display text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                Palisade
              </span>
            </span>
            <span className="text-sm text-neutral-400 dark:text-neutral-500">Gate</span>
          </div>
          <div className="flex items-center gap-3">
            {staff && (
              <span className="hidden text-sm text-neutral-500 dark:text-neutral-400 sm:inline">
                {staff.first_name} {staff.last_name}
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
        <nav className="mb-6 flex items-center gap-1 border-b border-neutral-200 dark:border-neutral-800 pb-3">
          <NavLink to="/staff/dashboard/guests" className={tabClass}>
            <UsersThree size={16} />
            Guests
          </NavLink>
          <NavLink to="/staff/dashboard/directory" className={tabClass}>
            <IdentificationBadge size={16} />
            Directory
          </NavLink>
        </nav>

        <AnimatedOutlet />
      </main>
    </div>
  )
}
