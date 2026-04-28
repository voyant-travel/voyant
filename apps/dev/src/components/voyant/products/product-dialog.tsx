"use client"

import type { ProductRecord } from "@voyantjs/products-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/ui/components/dialog"

import { ProductForm } from "./product-form"

export interface ProductDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: ProductRecord
  onSuccess?: (product: ProductRecord) => void
}

export function ProductDialog({ open, onOpenChange, product, onSuccess }: ProductDialogProps) {
  const isEdit = Boolean(product)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="product-dialog" className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit product" : "New product"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update product details, pricing, and classification."
              : "Create a new product in your catalog."}
          </DialogDescription>
        </DialogHeader>
        <ProductForm
          mode={product ? { kind: "edit", product } : { kind: "create" }}
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
