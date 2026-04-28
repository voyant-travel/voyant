import { Link } from "@tanstack/react-router"
import { Badge, DropdownMenuItem, DropdownMenuSeparator } from "@voyantjs/ui/components"
import { CalendarPlus, ChevronRight, Pencil, Trash2 } from "lucide-react"
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
  return (
    <>
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/products" className="transition-colors hover:text-foreground">
          {productMessages.breadcrumbProducts}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-normal text-foreground">{product.name}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
          <Badge variant={statusVariant[product.status] ?? "secondary"}>
            {getProductStatusLabel(product.status, messages)}
          </Badge>
        </div>
        <ActionMenu>
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            {productMessages.edit}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onAddBooking}>
            <CalendarPlus className="h-4 w-4" />
            {productMessages.addBooking}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={isDeleting} onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            {productMessages.delete}
          </DropdownMenuItem>
        </ActionMenu>
      </div>
    </>
  )
}
