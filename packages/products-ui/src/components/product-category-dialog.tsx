"use client"

import type { ProductCategoryRecord } from "@voyantjs/products-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/ui/components/dialog"

import { useProductsUiMessagesOrDefault } from "../i18n/provider"
import { ProductCategoryForm } from "./product-category-form"

export interface ProductCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category?: ProductCategoryRecord
  onSuccess?: (category: ProductCategoryRecord) => void
}

export function ProductCategoryDialog({
  open,
  onOpenChange,
  category,
  onSuccess,
}: ProductCategoryDialogProps) {
  const isEdit = Boolean(category)
  const messages = useProductsUiMessagesOrDefault()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="product-category-dialog" className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? messages.productCategoryDialog.titles.edit
              : messages.productCategoryDialog.titles.create}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? messages.productCategoryDialog.descriptions.edit
              : messages.productCategoryDialog.descriptions.create}
          </DialogDescription>
        </DialogHeader>
        <ProductCategoryForm
          mode={category ? { kind: "edit", category } : { kind: "create" }}
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
