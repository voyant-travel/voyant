"use client"

import type { PricingCategoryRecord } from "@voyantjs/pricing-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/voyant-ui/components/dialog"

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
  const isEdit = Boolean(category)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="pricing-category-dialog" className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit pricing category" : "New pricing category"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update reusable pricing category rules and eligibility."
              : "Create a reusable pricing category for products and options."}
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
