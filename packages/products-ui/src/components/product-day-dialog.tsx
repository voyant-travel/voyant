"use client"

import type { ProductDayRecord } from "@voyantjs/products-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/ui/components/dialog"

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="product-day-dialog" className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit itinerary day" : "Add itinerary day"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the title, location, and overview for this day."
              : "Create a structured day in the product itinerary."}
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
