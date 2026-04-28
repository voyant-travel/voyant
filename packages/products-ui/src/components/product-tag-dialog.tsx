"use client"

import type { ProductTagRecord } from "@voyantjs/products-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/voyant-ui/components/dialog"

import { ProductTagForm } from "./product-tag-form"

export interface ProductTagDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tag?: ProductTagRecord
  onSuccess?: (tag: ProductTagRecord) => void
}

export function ProductTagDialog({ open, onOpenChange, tag, onSuccess }: ProductTagDialogProps) {
  const isEdit = Boolean(tag)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="product-tag-dialog" className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit product tag" : "New product tag"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the tag used to label and filter products."
              : "Create a reusable tag for filtering and classification."}
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
