import { Badge, Button, DropdownMenuItem } from "@voyantjs/ui/components"
import { CalendarPlus, Copy, Pencil, Trash2 } from "lucide-react"
import { useEffect } from "react"
import { useProductDetailHost, useProductDetailMessages } from "./host.js"

import { ActionMenu } from "./product-detail-sections.js"
import type { ProductRecord } from "./product-detail-shared.js"
import { getProductStatusLabel, statusVariant } from "./product-detail-shared.js"

export interface ProductDetailHeaderProps {
  product: ProductRecord
  isDuplicating: boolean
  isDeleting: boolean
  onEdit: () => void
  onAddBooking: () => void
  onDuplicate: () => void
  onDelete: () => void
}

export function ProductDetailHeader({
  product,
  isDuplicating,
  isDeleting,
  onEdit,
  onAddBooking,
  onDuplicate,
  onDelete,
}: ProductDetailHeaderProps) {
  const messages = useProductDetailMessages()
  const productMessages = messages.products.core
  const { setBreadcrumbs } = useProductDetailHost()
  useEffect(() => {
    setBreadcrumbs?.([
      { label: productMessages.breadcrumbProducts, href: "/products" },
      { label: product.name },
    ])
  }, [setBreadcrumbs, productMessages.breadcrumbProducts, product.name])
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
        <Badge variant={statusVariant[product.status] ?? "secondary"}>
          {getProductStatusLabel(product.status, messages)}
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
          {productMessages.edit}
        </Button>
        <Button variant="outline" size="sm" onClick={onAddBooking}>
          <CalendarPlus className="h-4 w-4" />
          {productMessages.addBooking}
        </Button>
        <ActionMenu>
          <DropdownMenuItem disabled={isDuplicating} onClick={onDuplicate}>
            <Copy className="h-4 w-4" />
            {productMessages.duplicate}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" disabled={isDeleting} onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            {productMessages.delete}
          </DropdownMenuItem>
        </ActionMenu>
      </div>
    </div>
  )
}
