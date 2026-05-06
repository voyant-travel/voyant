"use client"

import type { PricingCategoryDependencyRecord } from "@voyantjs/pricing-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/ui/components/dialog"

import { usePricingUiMessagesOrDefault } from "../i18n/provider.js"
import { PricingCategoryDependencyForm } from "./pricing-category-dependency-form.js"

export interface PricingCategoryDependencyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dependency?: PricingCategoryDependencyRecord
  onSuccess?: (dependency: PricingCategoryDependencyRecord) => void
}

export function PricingCategoryDependencyDialog({
  open,
  onOpenChange,
  dependency,
  onSuccess,
}: PricingCategoryDependencyDialogProps) {
  const isEdit = Boolean(dependency)
  const messages = usePricingUiMessagesOrDefault()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="pricing-category-dependency-dialog" className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? messages.pricingCategoryDependencyDialog.titles.edit
              : messages.pricingCategoryDependencyDialog.titles.create}
          </DialogTitle>
          <DialogDescription>
            {messages.pricingCategoryDependencyDialog.description}
          </DialogDescription>
        </DialogHeader>
        <PricingCategoryDependencyForm
          mode={dependency ? { kind: "edit", dependency } : { kind: "create" }}
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
