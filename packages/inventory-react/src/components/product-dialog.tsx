"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@voyant-travel/ui/components/dialog"
import { useProductsUiMessagesOrDefault } from "../i18n/index.js"
import type { ProductRecord } from "../index.js"
import { ProductForm } from "./product-form.js"

export interface ProductDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: ProductRecord
  onSuccess?: (product: ProductRecord) => void
}

export function ProductDialog({ open, onOpenChange, product, onSuccess }: ProductDialogProps) {
  const productMessages = useProductsUiMessagesOrDefault().productDialog
  const isEdit = Boolean(product)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="product-dialog" className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? productMessages.titles.edit : productMessages.titles.create}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? productMessages.descriptions.edit : productMessages.descriptions.create}
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
