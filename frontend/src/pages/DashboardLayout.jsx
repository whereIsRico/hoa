import { NavLink } from 'react-router-dom'
import { UsersThree, UserCircle, SignOut, ShieldCheck } from '@phosphor-icons/react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Banner } from '@/components/ui/Banner'
import { AnimatedOutlet } from '@/components/AnimatedOutlet'
import { cn } from '@/lib/utils'

const navLinkClass = ({ isActive }) =>
  cn(
    'flex items-center gap-1.5 rounded-[var(--radius-field)] px-3 py-1.5 text-sm font-medium transition-colors',
    isActive
      ? 'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300'
      : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
  )

export function DashboardLayout() {
  const { resident, logout } = useAuth()

  return (
    <div className="min-h-dvh bg-neutral-50 dark:bg-neutral-950">
      <header className="sticky top-0 z-10 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-0/90 dark:bg-neutral-900/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <span className="font-display text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Passage
          </span>
          <nav className="flex items-center gap-1">
            <NavLink to="/dashboard/guests" className={navLinkClass}>
              <UsersThree size={16} />
              Guests
            </NavLink>
            <NavLink to="/dashboard/profile" className={navLinkClass}>
              <UserCircle size={16} />
              Profile
            </NavLink>
            {resident?.role === 'admin' && (
              <NavLink to="/dashboard/admin" className={navLinkClass}>
                <ShieldCheck size={16} />
                Admin
              </NavLink>
            )}
          </nav>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={logout} aria-label="Sign out">
              <SignOut size={17} />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {resident && !resident.is_approved && (
          <Banner tone="warning" title="Your account is pending HOA approval" className="mb-6">
            You'll be able to invite guests once an administrator approves your account.
          </Banner>
        )}
        <AnimatedOutlet />
      </main>
    </div>
  )
}
