"use client"

import type { CatalogSearchHit } from "@voyantjs/catalog-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { Card, CardContent } from "@voyantjs/ui/components/card"
import { cn } from "@voyantjs/ui/lib/utils"
import { useExtrasUiI18nOrDefault } from "../i18n/index.js"

export interface ExtraCatalogCardProps {
  hit: CatalogSearchHit
  onClick?: (hit: CatalogSearchHit) => void
  className?: string
}

/**
 * Search-result card for an extras hit (sub-line-item add-ons attached
 * to bookings). Reads: `name`, `category`, `priceCents`, `currency`,
 * `unit` (per_person | per_booking | per_night), `tags`.
 */
export function ExtraCatalogCard({ hit, onClick, className }: ExtraCatalogCardProps) {
  const i18n = useExtrasUiI18nOrDefault()
  const messages = i18n.messages.catalogCard
  const f = hit.document.fields
  const name = stringOr(f.name, messages.untitled)
  const category = stringOr(f.category, null)
  const unit = stringOr(f.unit, null)
  const status = stringOr(f.status, null)
  const tags = stringArray(f.tags)

  const price = numberOr(f.priceCents, null)
  const currency = stringOr(f.currency ?? f.sellCurrency, null)
  const priceLabel =
    price != null && currency
      ? i18n.formatCurrency(price / 100, currency, {
          maximumFractionDigits: 2,
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
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
          {category && <span>{category}</span>}
          {priceLabel && (
            <span className="ml-auto font-medium text-foreground">
              {priceLabel}
              {unit && (
                <span className="ml-1 text-muted-foreground">
                  {formatTemplate(messages.unitPrefix, { unit: unit.replace(/_/g, " ") })}
                </span>
              )}
            </span>
          )}
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

function formatTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key]
    return value === undefined ? "" : String(value)
  })
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
