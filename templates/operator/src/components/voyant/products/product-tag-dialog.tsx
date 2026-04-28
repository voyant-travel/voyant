"use client"

import type { ProductTagRecord } from "@voyantjs/products-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/ui/components/dialog"
import { useAdminMessages } from "@/lib/admin-i18n"

import { ProductTagForm } from "./product-tag-form"

export interface ProductTagDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tag?: ProductTagRecord
  onSuccess?: (tag: ProductTagRecord) => void
}

export function ProductTagDialog({ open, onOpenChange, tag, onSuccess }: ProductTagDialogProps) {
  const messages = useAdminMessages()
  const tagMessages = messages.products.taxonomy.tags
  const isEdit = Boolean(tag)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="product-tag-dialog" className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? tagMessages.dialogEditTitle : tagMessages.dialogNewTitle}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? tagMessages.dialogEditDescription : tagMessages.dialogNewDescription}
          </DialogDescription>
        </DialogHeader>
        <ProductTagForm
          mode={tag ? { kind: "edit", tag } : { kind: "create" }}
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
