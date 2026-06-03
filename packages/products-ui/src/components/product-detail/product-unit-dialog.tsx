import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@voyantjs/ui/components"
import { useProductDetailMessages } from "./host.js"

import { type OptionUnitData, UnitForm } from "./product-unit-form"

export type { OptionUnitData }

type UnitDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  optionId: string
  unit?: OptionUnitData
  nextSortOrder?: number
  onSuccess: () => void
}

export function UnitDialog({
  open,
  onOpenChange,
  optionId,
  unit,
  nextSortOrder,
  onSuccess,
}: UnitDialogProps) {
  const messages = useProductDetailMessages()
  const unitMessages = messages.products.operations.units
  const isEditing = !!unit

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>{isEditing ? unitMessages.editTitle : unitMessages.newTitle}</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <UnitForm
            optionId={optionId}
            unit={unit}
            nextSortOrder={nextSortOrder}
            onSuccess={onSuccess}
            onCancel={() => onOpenChange(false)}
          />
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
