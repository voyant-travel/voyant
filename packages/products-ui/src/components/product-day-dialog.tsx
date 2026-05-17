"use client"

import type { ProductDayRecord } from "@voyantjs/products-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/ui/components/dialog"

import { useProductsUiMessagesOrDefault } from "../i18n/provider.js"
import { ProductDayForm } from "./product-day-form.js"
import { ProductDayMediaTray } from "./product-day-media-tray.js"
import type { ProductMediaUploadHandler } from "./product-media-section.js"

export interface ProductDayDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  /** Optional. When set, new days are created against this itinerary. */
  itineraryId?: string
  day?: ProductDayRecord
  nextDayNumber?: number
  onSuccess?: (day: ProductDayRecord) => void
  /**
   * When provided, the dialog renders a media tray below the form (edit
   * mode only — new days don't have an id yet, so there's nothing to
   * attach media to until after first save).
   */
  uploadMedia?: ProductMediaUploadHandler
}

export function ProductDayDialog({
  open,
  onOpenChange,
  productId,
  itineraryId,
  day,
  nextDayNumber,
  onSuccess,
  uploadMedia,
}: ProductDayDialogProps) {
  const isEdit = Boolean(day)
  const messages = useProductsUiMessagesOrDefault()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-slot="product-day-dialog"
        className="flex max-h-[90vh] flex-col gap-4 sm:max-w-[640px]"
      >
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
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
          <ProductDayForm
            mode={
              day
                ? { kind: "edit", productId, day }
                : { kind: "create", productId, itineraryId, nextDayNumber }
            }
            onSuccess={(savedDay) => {
              onSuccess?.(savedDay)
              onOpenChange(false)
            }}
            onCancel={() => onOpenChange(false)}
          />
          {day ? (
            <div className="border-t pt-4">
              <ProductDayMediaTray productId={productId} dayId={day.id} uploadMedia={uploadMedia} />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
