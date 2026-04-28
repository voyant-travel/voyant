"use client"

import type { ProductMediaRecord } from "@voyantjs/products-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/voyant-ui/components/dialog"

import { ProductMediaForm } from "./product-media-form"

export interface ProductMediaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  dayId?: string
  media?: ProductMediaRecord
  onSuccess?: (media: ProductMediaRecord) => void
}

export function ProductMediaDialog({
  open,
  onOpenChange,
  productId,
  dayId,
  media,
  onSuccess,
}: ProductMediaDialogProps) {
  const isEdit = Boolean(media)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="product-media-dialog" className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit media" : "Add media"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update metadata, sorting, and cover behavior for this media item."
              : "Register a product or day-level media item by URL."}
          </DialogDescription>
        </DialogHeader>
        <ProductMediaForm
          mode={media ? { kind: "edit", media } : { kind: "create", productId, dayId }}
          onSuccess={(savedMedia) => {
            onSuccess?.(savedMedia)
            onOpenChange(false)
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
