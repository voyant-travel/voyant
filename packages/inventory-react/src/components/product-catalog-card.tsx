"use client"

import type { CatalogSearchHit } from "@voyant-travel/catalog-react"
import { Badge } from "@voyant-travel/ui/components/badge"
import { Card, CardContent } from "@voyant-travel/ui/components/card"
import { cn } from "@voyant-travel/ui/lib/utils"
import { useProductsUiI18nOrDefault } from "../i18n/index.js"

export interface ProductCatalogCardProps {
  hit: CatalogSearchHit
  /** Click handler — usually a router push to the product detail page. */
  onClick?: (hit: CatalogSearchHit) => void
  className?: string
}

/**
 * Search-result card for a product hit. Reads `name`, `status`,
 * `productTypeId`, `bookingMode`, `sellAmountCents`, `sellCurrency`,
 * `tags` from the resolved indexer document.
 */
export function ProductCatalogCard({ hit, onClick, className }: ProductCatalogCardProps) {
  const i18n = useProductsUiI18nOrDefault()
  const fields = hit.document.fields
  const name = stringOr(fields.name, i18n.messages.catalogCard.untitled)
  const status = stringOr(fields.status, null)
  const bookingMode = stringOr(fields.bookingMode, null)
  const sellAmount = numberOr(fields.sellAmountCents, null)
  const sellCurrency = stringOr(fields.sellCurrency, null)
  const tags = stringArray(fields.tags)

  const price =
    sellAmount != null && sellCurrency
      ? i18n.formatCurrency(sellAmount / 100, sellCurrency, {
          maximumFractionDigits: 0,
        })
      : null

  return (
    <Card
      className={cn(
        "h-full cursor-pointer transition-colors hover:border-primary/40",
        onClick == null && "cursor-default",
        className,
      )}
      onClick={onClick ? () => onClick(hit) : undefined}
    >
      <CardContent className="flex h-full flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-medium text-sm">{name}</h3>
          {status && (
            <Badge variant={status === "active" ? "default" : "secondary"} className="shrink-0">
              {status}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          {bookingMode && <span>{bookingMode}</span>}
          {price && <span className="ml-auto font-medium text-foreground">{price}</span>}
        </div>
        {tags.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1">
            {tags.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function stringOr<T>(value: unknown, fallback: T): string | T {
  return typeof value === "string" && value.length > 0 ? value : fallback
}

function numberOr<T>(value: unknown, fallback: T): number | T {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === "string" && v.length > 0)
}
