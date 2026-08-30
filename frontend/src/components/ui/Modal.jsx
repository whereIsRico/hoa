import { createContext, useContext, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const ModalContext = createContext(null)

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Centered dialog on desktop, bottom sheet on small viewports — responsive
// via breakpoints alone, no device-detection JS (matches how the rest of
// the app handles layout). Portals to document.body so it stacks above
// everything regardless of where it's rendered from.
export function Modal({ open, onClose, children, className }) {
  const reduce = useReducedMotion()
  const panelRef = useRef(null)
  const previouslyFocused = useRef(null)
  const titleId = useId()

  // Focus management: remember what had focus before opening, move focus
  // into the panel on open, restore it on close.
  useEffect(() => {
    if (!open) return undefined

    previouslyFocused.current = document.activeElement

    const focusables = panelRef.current?.querySelectorAll(FOCUSABLE_SELECTOR)
    const first = focusables?.[0]
    ;(first ?? panelRef.current)?.focus()

    return () => {
      if (previouslyFocused.current instanceof HTMLElement) {
        previouslyFocused.current.focus()
      }
    }
  }, [open])

  // Escape-to-close, plus a basic Tab trap so focus can't wander behind
  // the panel while it's open.
  useEffect(() => {
    if (!open) return undefined

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        onClose?.()
        return
      }
      if (e.key !== 'Tab') return

      const focusables = Array.from(panelRef.current?.querySelectorAll(FOCUSABLE_SELECTOR) ?? [])
      if (focusables.length === 0) return

      const first = focusables[0]
      const last = focusables[focusables.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  // Lock background scroll while a modal is open.
  useEffect(() => {
    if (!open) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/40 p-0 sm:items-center sm:p-4"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={cn(
              'flex max-h-[85vh] w-full flex-col overflow-y-auto rounded-t-[var(--radius-card)] rounded-b-none border ' +
                'border-neutral-200 bg-neutral-0 dark:border-neutral-800 dark:bg-neutral-900 ' +
                'sm:max-w-md sm:rounded-[var(--radius-card)]',
              className
            )}
            initial={reduce ? false : { opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
          >
            <ModalContext.Provider value={{ titleId, onClose }}>{children}</ModalContext.Provider>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

export function ModalHeader({ className, children, showClose = true, ...props }) {
  const ctx = useContext(ModalContext)

  return (
    <div className={cn('flex items-start justify-between gap-3 p-5 pb-0', className)} {...props}>
      <div className="flex flex-col gap-1">{children}</div>
      {showClose && ctx?.onClose && (
        <Button
          variant="ghost"
          size="sm"
          className="-mr-2 -mt-2 shrink-0 px-2"
          onClick={ctx.onClose}
          aria-label="Close"
        >
          <X size={17} />
        </Button>
      )}
    </div>
  )
}

export function ModalTitle({ className, ...props }) {
  const ctx = useContext(ModalContext)

  return (
    <h2
      id={ctx?.titleId}
      className={cn('text-base font-semibold text-neutral-900 dark:text-neutral-100', className)}
      {...props}
    />
  )
}

export function ModalBody({ className, ...props }) {
  return <div className={cn('p-5', className)} {...props} />
}
