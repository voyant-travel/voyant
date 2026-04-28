"use client"

import type { PersonRecord } from "@voyantjs/crm-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/ui/components/dialog"

import { PersonForm } from "./person-form"

export interface PersonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  person?: PersonRecord
  onSuccess?: (person: PersonRecord) => void
}

/**
 * Dialog wrapper for `<PersonForm />`. Determines create vs edit mode from
 * the presence of `person`. Closes the dialog on successful save.
 */
export function PersonDialog({ open, onOpenChange, person, onSuccess }: PersonDialogProps) {
  const isEdit = Boolean(person)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="person-dialog" className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit person" : "New person"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update contact details and reference information."
              : "Add a new person to your CRM."}
          </DialogDescription>
        </DialogHeader>
        <PersonForm
          mode={person ? { kind: "edit", person } : { kind: "create" }}
          onSuccess={(saved) => {
            onSuccess?.(saved)
            onOpenChange(false)
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
