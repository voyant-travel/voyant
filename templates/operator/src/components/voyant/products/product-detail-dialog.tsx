import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@voyantjs/ui/components"
import { useAdminMessages } from "@/lib/admin-i18n"

import { type ProductData, ProductDetailForm } from "./product-detail-form"

export type { ProductData }

type ProductDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: ProductData
  onSuccess: (id?: string) => void
}

export function ProductDialog({ open, onOpenChange, product, onSuccess }: ProductDialogProps) {
  const messages = useAdminMessages()
  const productMessages = messages.products.core
  const isEditing = !!product

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? productMessages.detailSheetEditTitle : productMessages.detailSheetNewTitle}
          </SheetTitle>
        </SheetHeader>
        <SheetBody>
          <ProductDetailForm
            product={product}
            onSuccess={onSuccess}
            onCancel={() => onOpenChange(false)}
          />
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
