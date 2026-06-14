import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@voyant-travel/ui/components"
import { useProductDetailMessages } from "./host.js"

import { type OptionUnitData, UnitForm } from "./product-unit-form.js"

export type { OptionUnitData }

type UnitDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  optionId: string
  unit?: OptionUnitData
  defaultUnitType?: OptionUnitData["unitType"]
  lockUnitType?: boolean
  nextSortOrder?: number
  onSuccess: () => void
}

export function UnitDialog({
  open,
  onOpenChange,
  optionId,
  unit,
  defaultUnitType,
  lockUnitType,
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
            defaultUnitType={defaultUnitType}
            lockUnitType={lockUnitType}
            nextSortOrder={nextSortOrder}
            onSuccess={onSuccess}
            onCancel={() => onOpenChange(false)}
          />
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
