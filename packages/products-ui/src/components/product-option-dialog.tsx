"use client"

import type { ProductOptionRecord } from "@voyantjs/products-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/ui/components/dialog"

import { ProductOptionForm } from "./product-option-form"

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="product-option-dialog" className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit option" : "New option"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update option availability, ordering, and default behavior."
              : "Create a reusable option under this product."}
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
