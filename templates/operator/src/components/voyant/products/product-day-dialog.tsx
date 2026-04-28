import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@voyantjs/ui/components"
import { useAdminMessages } from "@/lib/admin-i18n"

import { type DayData, DayForm } from "./product-day-form"

export type { DayData }

type DayDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  itineraryId: string
  day?: DayData
  nextDayNumber?: number
  onSuccess: () => void
}

export function DayDialog({
  open,
  onOpenChange,
  productId,
  itineraryId,
  day,
  nextDayNumber,
  onSuccess,
}: DayDialogProps) {
  const messages = useAdminMessages()
  const dayMessages = messages.products.operations.days
  const isEditing = !!day

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{isEditing ? dayMessages.editTitle : dayMessages.newTitle}</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <DayForm
            productId={productId}
            itineraryId={itineraryId}
            day={day}
            nextDayNumber={nextDayNumber}
            onSuccess={onSuccess}
            onCancel={() => onOpenChange(false)}
          />
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
