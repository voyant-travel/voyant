"use client"

import type { AvailabilitySlotRecord } from "@voyantjs/availability-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { useRegistryProductsMessagesOrDefault } from "./i18n/provider"
import { ProductDepartureForm } from "./product-departure-form"

export interface ProductDepartureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  slot?: AvailabilitySlotRecord
  onSuccess?: (slot: AvailabilitySlotRecord) => void
}

export function ProductDepartureDialog({
  open,
  onOpenChange,
  productId,
  slot,
  onSuccess,
}: ProductDepartureDialogProps) {
  const isEdit = Boolean(slot)
  const messages = useRegistryProductsMessagesOrDefault()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="product-departure-dialog" className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? messages.productDepartureDialog.titles.edit
              : messages.productDepartureDialog.titles.create}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? messages.productDepartureDialog.descriptions.edit
              : messages.productDepartureDialog.descriptions.create}
          </DialogDescription>
        </DialogHeader>
        <ProductDepartureForm
          mode={slot ? { kind: "edit", slot } : { kind: "create", productId }}
          onSuccess={(savedSlot) => {
            onSuccess?.(savedSlot)
            onOpenChange(false)
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
