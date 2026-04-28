import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@voyantjs/ui/components"
import { useAdminMessages } from "@/lib/admin-i18n"

import { OptionForm, type ProductOptionData } from "./product-option-form"

export type { ProductOptionData }

type OptionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  option?: ProductOptionData
  nextSortOrder?: number
  onSuccess: () => void
}

export function OptionDialog({
  open,
  onOpenChange,
  productId,
  option,
  nextSortOrder,
  onSuccess,
}: OptionDialogProps) {
  const messages = useAdminMessages()
  const optionMessages = messages.products.operations.options
  const isEditing = !!option

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>{isEditing ? optionMessages.editTitle : optionMessages.newTitle}</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <OptionForm
            productId={productId}
            option={option}
            nextSortOrder={nextSortOrder}
            onSuccess={onSuccess}
            onCancel={() => onOpenChange(false)}
          />
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
