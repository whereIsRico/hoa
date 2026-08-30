import { Phone } from '@phosphor-icons/react'
import { Modal, ModalHeader, ModalTitle, ModalBody } from '@/components/ui/Modal'
import { buttonVariants } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

// Shared click-through profile for Admin/Gate Staff's directories — reused
// across every "person with a phone number" this app has: residents, gate
// staff, the HOA office, and manual (off-platform) contacts. `unitNumber`
// omitted entirely renders no unit row (how the pinned HOA-office row, not
// a resident, reuses this without a fake "no unit" placeholder). `fields`
// is an optional list of extra `{ label, value }` rows (email, shift,
// address, ...) rendered between the unit line and the phone block — a row
// is skipped entirely when `value` is falsy, so callers can pass fields
// that don't apply to every profile type without extra conditionals.
export function DirectoryDetailModal({ open, onClose, name, unitNumber, phone, fields = [], badge }) {
  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader>
        <ModalTitle>{name}</ModalTitle>
        {unitNumber && <p className="text-sm text-neutral-500 dark:text-neutral-400">Unit {unitNumber}</p>}
        {badge}
      </ModalHeader>
      <ModalBody className="flex flex-col gap-4">
        {fields
          .filter((f) => f.value)
          .map((f) => (
            <div key={f.label} className="flex flex-col gap-1">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {f.label}
              </p>
              <p className="text-sm text-neutral-900 dark:text-neutral-100">{f.value}</p>
            </div>
          ))}

        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Phone
          </p>
          <p className="text-sm text-neutral-900 dark:text-neutral-100">{phone || 'No phone on file'}</p>
        </div>

        {phone && (
          // Always rendered, no device detection — tel: degrades gracefully
          // on desktop, per the redesign plan.
          <a href={`tel:${phone}`} className={cn(buttonVariants({ variant: 'primary' }), 'w-full')}>
            <Phone size={16} weight="bold" />
            Call {phone}
          </a>
        )}
      </ModalBody>
    </Modal>
  )
}
