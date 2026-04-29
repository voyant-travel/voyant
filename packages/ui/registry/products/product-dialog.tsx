"use client"

import type { ProductRecord } from "@voyantjs/products-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { useRegistryProductsMessagesOrDefault } from "./i18n/provider"
import { ProductForm } from "./product-form"

export interface ProductDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: ProductRecord
  onSuccess?: (product: ProductRecord) => void
}

export function ProductDialog({ open, onOpenChange, product, onSuccess }: ProductDialogProps) {
  const isEdit = Boolean(product)
  const messages = useRegistryProductsMessagesOrDefault()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="product-dialog" className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? messages.productDialog.titles.edit : messages.productDialog.titles.create}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? messages.productDialog.descriptions.edit
              : messages.productDialog.descriptions.create}
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
