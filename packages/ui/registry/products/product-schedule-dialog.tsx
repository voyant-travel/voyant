"use client"

import type { AvailabilityRuleRecord } from "@voyantjs/availability-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { useRegistryProductsMessagesOrDefault } from "./i18n/provider"
import { ProductScheduleForm } from "./product-schedule-form"

export interface ProductScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  rule?: AvailabilityRuleRecord
  onSuccess?: (rule: AvailabilityRuleRecord) => void
}

export function ProductScheduleDialog({
  open,
  onOpenChange,
  productId,
  rule,
  onSuccess,
}: ProductScheduleDialogProps) {
  const isEdit = Boolean(rule)
  const messages = useRegistryProductsMessagesOrDefault()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="product-schedule-dialog" className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? messages.productScheduleDialog.titles.edit
              : messages.productScheduleDialog.titles.create}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? messages.productScheduleDialog.descriptions.edit
              : messages.productScheduleDialog.descriptions.create}
          </DialogDescription>
        </DialogHeader>
        <ProductScheduleForm
          mode={rule ? { kind: "edit", rule } : { kind: "create", productId }}
          onSuccess={(savedRule) => {
            onSuccess?.(savedRule)
            onOpenChange(false)
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
