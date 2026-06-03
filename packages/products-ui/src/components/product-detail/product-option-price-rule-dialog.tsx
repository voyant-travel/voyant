import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@voyantjs/ui/components"
import { useProductDetailMessages } from "./host.js"

import { type OptionPriceRuleData, OptionPriceRuleForm } from "./product-option-price-rule-form"

export type { OptionPriceRuleData }

type OptionPriceRuleDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  optionId: string
  rule?: OptionPriceRuleData
  onSuccess: () => void
}

export function OptionPriceRuleDialog({
  open,
  onOpenChange,
  productId,
  optionId,
  rule,
  onSuccess,
}: OptionPriceRuleDialogProps) {
  const messages = useProductDetailMessages()
  const priceRuleMessages = messages.products.operations.priceRules
  const isEditing = !!rule

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? priceRuleMessages.editTitle : priceRuleMessages.newTitle}
          </SheetTitle>
        </SheetHeader>
        <SheetBody>
          <OptionPriceRuleForm
            productId={productId}
            optionId={optionId}
            rule={rule}
            onSuccess={onSuccess}
            onCancel={() => onOpenChange(false)}
          />
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
