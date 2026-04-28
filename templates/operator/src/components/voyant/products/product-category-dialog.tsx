"use client"

import type { ProductCategoryRecord } from "@voyantjs/products-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/ui/components/dialog"
import { useAdminMessages } from "@/lib/admin-i18n"

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
  const messages = useAdminMessages()
  const categoryMessages = messages.products.taxonomy.categories
  const isEdit = Boolean(category)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="product-category-dialog" className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? categoryMessages.dialogEditTitle : categoryMessages.dialogNewTitle}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? categoryMessages.dialogEditDescription
              : categoryMessages.dialogNewDescription}
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
