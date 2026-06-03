import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@voyantjs/ui/components"
import { useProductDetailMessages } from "./host.js"

import { type ProductData, ProductDetailForm } from "./product-detail-form.js"

export type { ProductData }

type ProductDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: ProductData
  onSuccess: (id?: string) => void
}

export function ProductDialog({ open, onOpenChange, product, onSuccess }: ProductDialogProps) {
  const messages = useProductDetailMessages()
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
