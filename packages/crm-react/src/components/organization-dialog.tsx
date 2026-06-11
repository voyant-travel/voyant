"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/ui/components/dialog"
import { useCrmUiMessagesOrDefault } from "../i18n/index.js"
import type { OrganizationRecord } from "../index.js"
import { OrganizationForm } from "./organization-form.js"

export interface OrganizationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organization?: OrganizationRecord
  onSuccess?: (organization: OrganizationRecord) => void
}

export function OrganizationDialog({
  open,
  onOpenChange,
  organization,
  onSuccess,
}: OrganizationDialogProps) {
  const isEdit = Boolean(organization)
  const messages = useCrmUiMessagesOrDefault()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="organization-dialog" className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? messages.organizationDialog.titles.edit
              : messages.organizationDialog.titles.create}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? messages.organizationDialog.descriptions.edit
              : messages.organizationDialog.descriptions.create}
          </DialogDescription>
        </DialogHeader>
        <OrganizationForm
          mode={organization ? { kind: "edit", organization } : { kind: "create" }}
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
