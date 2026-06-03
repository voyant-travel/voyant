import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@voyantjs/ui/components"
import { useProductDetailMessages } from "./host.js"

import { DepartureForm, type DepartureSlot } from "./product-departure-form"

export type { DepartureSlot }

type DepartureDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  slot?: DepartureSlot
  onSuccess: () => void
}

export function DepartureDialog({
  open,
  onOpenChange,
  productId,
  slot,
  onSuccess,
}: DepartureDialogProps) {
  const messages = useProductDetailMessages()
  const departureMessages = messages.products.operations.departures
  const isEditing = !!slot

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? departureMessages.editTitle : departureMessages.newTitle}
          </SheetTitle>
        </SheetHeader>
        <SheetBody>
          <DepartureForm
            productId={productId}
            slot={slot}
            onSuccess={onSuccess}
            onCancel={() => onOpenChange(false)}
          />
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
