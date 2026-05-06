"use client"

import type { PricingCategoryRecord } from "@voyantjs/pricing-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/ui/components/dialog"

import { usePricingUiMessagesOrDefault } from "../i18n/provider.js"
import { PricingCategoryForm } from "./pricing-category-form.js"

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
  const messages = usePricingUiMessagesOrDefault()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="pricing-category-dialog" className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? messages.pricingCategoryDialog.titles.edit
              : messages.pricingCategoryDialog.titles.create}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? messages.pricingCategoryDialog.descriptions.edit
              : messages.pricingCategoryDialog.descriptions.create}
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
