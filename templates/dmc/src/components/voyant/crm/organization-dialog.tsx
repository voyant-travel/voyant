"use client"

import type { OrganizationRecord } from "@voyantjs/crm-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/ui/components/dialog"
import { useAdminMessages } from "@/lib/admin-i18n"

import { OrganizationForm } from "./organization-form"

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
  const messages = useAdminMessages().organizationsModule

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="organization-dialog" className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? messages.dialogEditTitle : messages.dialogNewTitle}</DialogTitle>
          <DialogDescription>
            {isEdit ? messages.dialogEditDescription : messages.dialogNewDescription}
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
