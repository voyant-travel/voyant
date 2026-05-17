import { useAdminBreadcrumbs } from "@voyantjs/admin"
import { Badge, Button, DropdownMenuItem } from "@voyantjs/ui/components"
import { CalendarPlus, Pencil, Trash2 } from "lucide-react"
import { useAdminMessages } from "@/lib/admin-i18n"

import { ActionMenu } from "./product-detail-sections"
import type { ProductRecord } from "./product-detail-shared"
import { getProductStatusLabel, statusVariant } from "./product-detail-shared"

export interface ProductDetailHeaderProps {
  product: ProductRecord
  isDeleting: boolean
  onEdit: () => void
  onAddBooking: () => void
  onDelete: () => void
}

export function ProductDetailHeader({
  product,
  isDeleting,
  onEdit,
  onAddBooking,
  onDelete,
}: ProductDetailHeaderProps) {
  const messages = useAdminMessages()
  const productMessages = messages.products.core
  useAdminBreadcrumbs([
    { label: productMessages.breadcrumbProducts, href: "/products" },
    { label: product.name },
  ])
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
          <DropdownMenuItem variant="destructive" disabled={isDeleting} onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            {productMessages.delete}
          </DropdownMenuItem>
        </ActionMenu>
      </div>
    </div>
  )
}
