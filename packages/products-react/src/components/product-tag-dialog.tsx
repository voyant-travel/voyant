"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/ui/components/dialog"
import { useProductsUiMessagesOrDefault } from "../i18n/provider.js"
import type { ProductTagRecord } from "../index.js"
import { ProductTagForm } from "./product-tag-form.js"

export interface ProductTagDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tag?: ProductTagRecord
  onSuccess?: (tag: ProductTagRecord) => void
}

export function ProductTagDialog({ open, onOpenChange, tag, onSuccess }: ProductTagDialogProps) {
  const isEdit = Boolean(tag)
  const messages = useProductsUiMessagesOrDefault()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="product-tag-dialog" className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? messages.productTagDialog.titles.edit
              : messages.productTagDialog.titles.create}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? messages.productTagDialog.descriptions.edit
              : messages.productTagDialog.descriptions.create}
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
