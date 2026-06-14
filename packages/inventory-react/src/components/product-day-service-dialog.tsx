"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/ui/components/dialog"
import { useProductsUiMessagesOrDefault } from "../i18n/provider.js"
import type { ProductDayServiceRecord } from "../index.js"
import {
  ProductDayServiceForm,
  type ProductDayServiceFormProps,
} from "./product-day-service-form.js"

export interface ProductDayServiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  dayId: string
  service?: ProductDayServiceRecord
  onSuccess?: (service: ProductDayServiceRecord) => void
  renderSupplierServiceField?: ProductDayServiceFormProps["renderSupplierServiceField"]
  onSupplierServiceSelected?: ProductDayServiceFormProps["onSupplierServiceSelected"]
}

export function ProductDayServiceDialog({
  open,
  onOpenChange,
  productId,
  dayId,
  service,
  onSuccess,
  renderSupplierServiceField,
  onSupplierServiceSelected,
}: ProductDayServiceDialogProps) {
  const isEdit = Boolean(service)
  const messages = useProductsUiMessagesOrDefault()

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
          renderSupplierServiceField={renderSupplierServiceField}
          onSupplierServiceSelected={onSupplierServiceSelected}
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
