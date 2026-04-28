"use client"

import type { PricingCategoryDependencyRecord } from "@voyantjs/pricing-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/voyant-ui/components/dialog"

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
  const isEdit = Boolean(dependency)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="pricing-category-dependency-dialog" className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit category dependency" : "Add category dependency"}
          </DialogTitle>
          <DialogDescription>
            Rules between pricing categories such as requires, excludes, and quantity limits.
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
