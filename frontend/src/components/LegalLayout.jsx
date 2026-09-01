import { Link } from 'react-router-dom'
import { ArgusMark } from '@/components/ArgusMark'

export function LegalLayout({ title, updated, children }) {
  return (
    <div className="min-h-dvh bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-0/90 dark:bg-neutral-900/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <ArgusMark className="h-6 w-auto" />
            <span className="font-display text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
              Palisade
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/terms" className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
              Terms
            </Link>
            <Link to="/privacy" className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
              Privacy
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">{title}</h1>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Last updated {updated}</p>
        <div className="prose-legal mt-8 flex flex-col gap-6 text-[15px] leading-relaxed text-neutral-700 dark:text-neutral-300">
          {children}
        </div>
      </main>
    </div>
  )
}

export function LegalSection({ heading, children }) {
  return (
    <section>
      <h2 className="font-display text-lg font-semibold text-neutral-900 dark:text-neutral-100">{heading}</h2>
      <div className="mt-2 flex flex-col gap-3">{children}</div>
    </section>
  )
}
