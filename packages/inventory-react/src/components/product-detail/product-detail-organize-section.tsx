import { useQuery } from "@tanstack/react-query"
import { Badge, DropdownMenuItem } from "@voyant-travel/ui/components"
import { Pencil } from "lucide-react"
import { useProductDetailApi, useProductDetailMessages } from "./host.js"
import { ActionMenu, DetailRow, Section } from "./product-detail-section-shell.js"
import { getProductBookingModeLabel, type ProductRecord } from "./product-detail-shared.js"

type TaxClassSummary = {
  id: string
  label: string
}

export function ProductOrganizeSection({
  product,
  onEdit,
}: {
  product: ProductRecord
  onEdit: () => void
}) {
  const api = useProductDetailApi()
  const messages = useProductDetailMessages()
  const productMessages = messages.products.core
  const taxClassQuery = useQuery({
    queryKey: ["tax-class", product.taxClassId],
    enabled: !!product.taxClassId,
    queryFn: () =>
      api.get<{ data: TaxClassSummary }>(`/v1/admin/finance/tax-classes/${product.taxClassId}`),
  })
  return (
    <Section
      title={productMessages.organizeTitle}
      actions={
        <ActionMenu label={`${productMessages.organizeTitle}: ${productMessages.edit}`}>
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            {productMessages.edit}
          </DropdownMenuItem>
        </ActionMenu>
      }
    >
      <DetailRow
        label={productMessages.tagsLabel}
        value={
          product.tags.length > 0 ? (
            <div className="flex flex-wrap justify-end gap-1">
              {product.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">{productMessages.noValue}</span>
          )
        }
      />
      <DetailRow
        label={productMessages.typeLabel}
        value={<span>{getProductBookingModeLabel(product.bookingMode, messages)}</span>}
      />
      <DetailRow
        label={productMessages.taxClassLabel}
        value={
          taxClassQuery.data?.data.label ? (
            <span>{taxClassQuery.data.data.label}</span>
          ) : (
            <span className="text-muted-foreground">{productMessages.taxClassNone}</span>
          )
        }
      />
    </Section>
  )
}
