import { NavLink, Outlet } from 'react-router-dom'
import { UsersThree, UserCircle, IdentificationBadge, SlidersHorizontal } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

const tabClass = ({ isActive }) =>
  cn(
    'flex items-center gap-1.5 rounded-[var(--radius-field)] px-3 py-1.5 text-sm font-medium transition-colors',
    isActive
      ? 'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300'
      : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
  )

export function AdminLayout() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Admin</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Manage guests, residents, and gate staff</p>
      </div>

      <nav className="flex items-center gap-1 border-b border-neutral-200 dark:border-neutral-800 pb-3">
        <NavLink to="/dashboard/admin/guests" className={tabClass}>
          <UsersThree size={16} />
          Guests
        </NavLink>
        <NavLink to="/dashboard/admin/residents" className={tabClass}>
          <UserCircle size={16} />
          Residents
        </NavLink>
        <NavLink to="/dashboard/admin/staff" className={tabClass}>
          <IdentificationBadge size={16} />
          Gate Staff
        </NavLink>
        <NavLink to="/dashboard/admin/policies" className={tabClass}>
          <SlidersHorizontal size={16} />
          Policies
        </NavLink>
      </nav>

      <Outlet />
    </div>
  )
}
