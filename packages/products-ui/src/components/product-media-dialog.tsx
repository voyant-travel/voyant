"use client"

import type { ProductMediaRecord } from "@voyantjs/products-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/ui/components/dialog"

import { useProductsUiMessagesOrDefault } from "../i18n/provider.js"
import { ProductMediaForm } from "./product-media-form.js"

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
  const messages = useProductsUiMessagesOrDefault()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="product-media-dialog" className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? messages.productMediaDialog.titles.edit
              : messages.productMediaDialog.titles.create}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? messages.productMediaDialog.descriptions.edit
              : messages.productMediaDialog.descriptions.create}
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
