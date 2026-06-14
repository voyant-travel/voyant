"use client"

import type { PricingCategoryDependencyRecord } from "@voyantjs/commerce-react/pricing"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/ui/components/dialog"
import { useAdminMessages } from "@/lib/admin-i18n"

import { PricingCategoryDependencyForm } from "./pricing-category-dependency-form"

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
  const messages = useAdminMessages()
  const isEdit = Boolean(dependency)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="pricing-category-dependency-dialog" className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? messages.pricing.dependencies.dialogEditTitle
              : messages.pricing.dependencies.dialogNewTitle}
          </DialogTitle>
          <DialogDescription>{messages.pricing.dependencies.dialogDescription}</DialogDescription>
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
