"use client"

import type { ProductDayServiceRecord } from "@voyantjs/products-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { useRegistryProductsMessagesOrDefault } from "./i18n/provider"
import {
  ProductDayServiceForm,
  type ProductDayServiceSupplierPickerRenderer,
} from "./product-day-service-form"

export interface ProductDayServiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  dayId: string
  service?: ProductDayServiceRecord
  onSuccess?: (service: ProductDayServiceRecord) => void
  renderSupplierServicePicker?: ProductDayServiceSupplierPickerRenderer
}

export function ProductDayServiceDialog({
  open,
  onOpenChange,
  productId,
  dayId,
  service,
  onSuccess,
  renderSupplierServicePicker,
}: ProductDayServiceDialogProps) {
  const isEdit = Boolean(service)
  const messages = useRegistryProductsMessagesOrDefault()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="product-day-service-dialog" className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? messages.productDayServiceDialog.titles.edit
              : messages.productDayServiceDialog.titles.create}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? messages.productDayServiceDialog.descriptions.edit
              : messages.productDayServiceDialog.descriptions.create}
          </DialogDescription>
        </DialogHeader>
        <ProductDayServiceForm
          mode={
            service
              ? { kind: "edit", productId, dayId, service }
              : { kind: "create", productId, dayId }
          }
          renderSupplierServicePicker={renderSupplierServicePicker}
          onSuccess={(savedService) => {
            onSuccess?.(savedService)
            onOpenChange(false)
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
