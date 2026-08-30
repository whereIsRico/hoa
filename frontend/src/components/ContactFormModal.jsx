import { useEffect, useState } from 'react'
import { Modal, ModalHeader, ModalTitle, ModalBody } from '@/components/ui/Modal'
import { FormField, Input, Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'
import { adminApi, ApiError } from '@/lib/api'

const emptyForm = { first_name: '', last_name: '', unit_number: '', phone: '', notes: '' }

function toForm(contact) {
  if (!contact) return emptyForm
  return {
    first_name: contact.first_name || '',
    last_name: contact.last_name || '',
    unit_number: contact.unit_number || '',
    phone: contact.phone || '',
    notes: contact.notes || '',
  }
}

// Create/edit for manual (off-platform) contacts — one modal, reused for
// both by passing an existing `contact` to prefill and PUT instead of POST.
export function ContactFormModal({ open, onClose, token, contact, onSaved }) {
  const [form, setForm] = useState(() => toForm(contact))
  const [error, setError] = useState(null)
  const [details, setDetails] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Re-seed the form whenever a different contact (or "new") is opened —
  // the modal instance is shared, not remounted, between rows.
  useEffect(() => {
    if (open) {
      setForm(toForm(contact))
      setError(null)
      setDetails(null)
    }
  }, [open, contact])

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setDetails(null)
    setSubmitting(true)
    try {
      const payload = {}
      for (const [key, value] of Object.entries(form)) {
        if (value) payload[key] = value
      }
      const saved = contact
        ? await adminApi.updateContact(token, contact.id, payload)
        : await adminApi.createContact(token, payload)
      onSaved(saved.contact)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
        setDetails(err.details)
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader>
        <ModalTitle>{contact ? 'Edit contact' : 'Add contact'}</ModalTitle>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          For someone the HOA has on file who hasn't created a Palisade account
        </p>
      </ModalHeader>
      <ModalBody>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {error && (
            <Banner tone="danger" title={error}>
              {details && details.length > 0 && (
                <ul className="mt-1 list-disc pl-4">
                  {details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              )}
            </Banner>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormField label="First name" required>
              {(fieldProps) => (
                <Input {...fieldProps} autoComplete="given-name" value={form.first_name} onChange={update('first_name')} required />
              )}
            </FormField>
            <FormField label="Last name" required>
              {(fieldProps) => (
                <Input {...fieldProps} autoComplete="family-name" value={form.last_name} onChange={update('last_name')} required />
              )}
            </FormField>
          </div>

          <FormField label="Unit" helper="Optional">
            {(fieldProps) => <Input {...fieldProps} value={form.unit_number} onChange={update('unit_number')} />}
          </FormField>

          <FormField label="Phone" helper="Optional">
            {(fieldProps) => <Input {...fieldProps} type="tel" autoComplete="tel" value={form.phone} onChange={update('phone')} />}
          </FormField>

          <FormField label="Notes" helper="Optional">
            {(fieldProps) => <Textarea {...fieldProps} value={form.notes} onChange={update('notes')} />}
          </FormField>

          <div className="flex items-center gap-2">
            <Button type="submit" loading={submitting}>
              {contact ? 'Save changes' : 'Add contact'}
            </Button>
            <Button type="button" variant="ghost" disabled={submitting} onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </ModalBody>
    </Modal>
  )
}
