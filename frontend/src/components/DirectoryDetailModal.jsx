import { Phone } from '@phosphor-icons/react'
import { Modal, ModalHeader, ModalTitle, ModalBody } from '@/components/ui/Modal'
import { buttonVariants } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

// Shared click-through detail for both Admin's residents page and Gate
// Staff's directory — same shape (name, optional unit, phone + call button),
// just fed different data. `unitNumber` omitted entirely renders no unit
// row, which is how the pinned HOA-office row (not a resident) reuses this
// without a fake "no unit" placeholder.
export function DirectoryDetailModal({ open, onClose, name, unitNumber, phone }) {
  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader>
        <ModalTitle>{name}</ModalTitle>
        {unitNumber && <p className="text-sm text-neutral-500 dark:text-neutral-400">Unit {unitNumber}</p>}
      </ModalHeader>
      <ModalBody className="flex flex-col gap-4">
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
