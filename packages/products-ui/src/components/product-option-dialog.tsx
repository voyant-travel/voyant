"use client"

import type { ProductOptionRecord } from "@voyantjs/products-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/ui/components/dialog"

import { useProductsUiMessagesOrDefault } from "../i18n/provider.js"
import { ProductOptionForm } from "./product-option-form.js"

export interface ProductOptionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  option?: ProductOptionRecord
  sortOrder?: number
  onSuccess?: (option: ProductOptionRecord) => void
}

export function ProductOptionDialog({
  open,
  onOpenChange,
  productId,
  option,
  sortOrder,
  onSuccess,
}: ProductOptionDialogProps) {
  const isEdit = Boolean(option)
  const messages = useProductsUiMessagesOrDefault()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="product-option-dialog" className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? messages.productOptionDialog.titles.edit
              : messages.productOptionDialog.titles.create}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? messages.productOptionDialog.descriptions.edit
              : messages.productOptionDialog.descriptions.create}
          </DialogDescription>
        </DialogHeader>
        <ProductOptionForm
          mode={option ? { kind: "edit", option } : { kind: "create", productId, sortOrder }}
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
