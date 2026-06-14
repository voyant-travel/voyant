import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@voyant-travel/ui/components"
import { useProductDetailMessages } from "./host.js"

import type { OptionUnitData } from "./product-unit-form.js"
import { type OptionUnitPriceRuleData, UnitPriceRuleForm } from "./product-unit-price-rule-form.js"

export type { OptionUnitPriceRuleData }

type UnitPriceRuleDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  optionPriceRuleId: string
  optionId: string
  units: OptionUnitData[]
  productCurrency?: string
  preselectedUnitId?: string
  preselectedCategoryId?: string | null
  cell?: OptionUnitPriceRuleData
  onSuccess: () => void
}

export function UnitPriceRuleDialog({
  open,
  onOpenChange,
  optionPriceRuleId,
  optionId,
  units,
  productCurrency,
  preselectedUnitId,
  preselectedCategoryId,
  cell,
  onSuccess,
}: UnitPriceRuleDialogProps) {
  const messages = useProductDetailMessages()
  const unitPriceMessages = messages.products.operations.unitPrices
  const isEditing = !!cell

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? unitPriceMessages.editTitle : unitPriceMessages.newTitle}
          </SheetTitle>
        </SheetHeader>
        <SheetBody>
          <UnitPriceRuleForm
            optionPriceRuleId={optionPriceRuleId}
            optionId={optionId}
            units={units}
            productCurrency={productCurrency}
            preselectedUnitId={preselectedUnitId}
            preselectedCategoryId={preselectedCategoryId}
            cell={cell}
            onSuccess={onSuccess}
            onCancel={() => onOpenChange(false)}
          />
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
