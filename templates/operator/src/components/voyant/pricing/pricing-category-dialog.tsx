"use client"

import type { PricingCategoryRecord } from "@voyantjs/commerce-react/pricing"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/ui/components/dialog"
import { useAdminMessages } from "@/lib/admin-i18n"

import { PricingCategoryForm } from "./pricing-category-form"

export interface PricingCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category?: PricingCategoryRecord
  onSuccess?: (category: PricingCategoryRecord) => void
}

export function PricingCategoryDialog({
  open,
  onOpenChange,
  category,
  onSuccess,
}: PricingCategoryDialogProps) {
  const messages = useAdminMessages()
  const isEdit = Boolean(category)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="pricing-category-dialog" className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? messages.pricing.categories.dialogEditTitle
              : messages.pricing.categories.dialogNewTitle}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? messages.pricing.categories.dialogEditDescription
              : messages.pricing.categories.dialogNewDescription}
          </DialogDescription>
        </DialogHeader>
        <PricingCategoryForm
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
