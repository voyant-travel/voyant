import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@voyantjs/ui/components"
import { useAdminMessages } from "@/lib/admin-i18n"

import { type DayServiceData, ServiceForm } from "./product-service-form"

export type { DayServiceData }

type ServiceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  dayId: string
  service?: DayServiceData
  onSuccess: () => void
}

export function ServiceDialog({
  open,
  onOpenChange,
  productId,
  dayId,
  service,
  onSuccess,
}: ServiceDialogProps) {
  const messages = useAdminMessages()
  const serviceMessages = messages.products.operations.services
  const isEditing = !!service

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? serviceMessages.editTitle : serviceMessages.newTitle}
          </SheetTitle>
        </SheetHeader>
        <SheetBody>
          <ServiceForm
            productId={productId}
            dayId={dayId}
            service={service}
            onSuccess={onSuccess}
            onCancel={() => onOpenChange(false)}
          />
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
