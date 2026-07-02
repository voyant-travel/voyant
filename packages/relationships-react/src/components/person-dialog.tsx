"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@voyant-travel/ui/components/dialog"
import { useCrmUiMessagesOrDefault } from "../i18n/index.js"
import type { PersonRecord } from "../index.js"
import { PersonForm } from "./person-form.js"

export interface PersonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  person?: PersonRecord
  initialOrganizationId?: string
  onSuccess?: (person: PersonRecord) => void
}

/**
 * Dialog wrapper for `<PersonForm />`. Determines create vs edit mode from
 * the presence of `person`. Closes the dialog on successful save.
 */
export function PersonDialog({
  open,
  onOpenChange,
  person,
  initialOrganizationId,
  onSuccess,
}: PersonDialogProps) {
  const isEdit = Boolean(person)
  const messages = useCrmUiMessagesOrDefault()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="person-dialog" className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? messages.personDialog.titles.edit : messages.personDialog.titles.create}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? messages.personDialog.descriptions.edit
              : messages.personDialog.descriptions.create}
          </DialogDescription>
        </DialogHeader>
        <PersonForm
          mode={person ? { kind: "edit", person } : { kind: "create" }}
          initialOrganizationId={initialOrganizationId}
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
