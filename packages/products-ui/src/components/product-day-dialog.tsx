"use client"

import type { ProductDayRecord } from "@voyantjs/products-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/ui/components/dialog"

import { useProductsUiMessagesOrDefault } from "../i18n/provider"
import { ProductDayForm } from "./product-day-form"

export interface ProductDayDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  day?: ProductDayRecord
  nextDayNumber?: number
  onSuccess?: (day: ProductDayRecord) => void
}

export function ProductDayDialog({
  open,
  onOpenChange,
  productId,
  day,
  nextDayNumber,
  onSuccess,
}: ProductDayDialogProps) {
  const isEdit = Boolean(day)
  const messages = useProductsUiMessagesOrDefault()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="product-day-dialog" className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? messages.productDayDialog.titles.edit
              : messages.productDayDialog.titles.create}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? messages.productDayDialog.descriptions.edit
              : messages.productDayDialog.descriptions.create}
          </DialogDescription>
        </DialogHeader>
        <ProductDayForm
          mode={
            day ? { kind: "edit", productId, day } : { kind: "create", productId, nextDayNumber }
          }
          onSuccess={(savedDay) => {
            onSuccess?.(savedDay)
            onOpenChange(false)
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
