"use client"

import type { CatalogSearchHit } from "@voyantjs/catalog-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { Card, CardContent } from "@voyantjs/ui/components/card"
import { cn } from "@voyantjs/ui/lib/utils"
import { useHospitalityUiI18nOrDefault } from "../i18n/index.js"

export interface HotelCatalogCardProps {
  hit: CatalogSearchHit
  onClick?: (hit: CatalogSearchHit) => void
  className?: string
}

/**
 * Search-result card for a hospitality (hotel / room type) hit. Reads:
 * `name`, `propertyName`, `city`, `country`, `starRating`,
 * `roomCapacity`, `nightlyRateFromCents`, `currency`, `tags`.
 */
export function HotelCatalogCard({ hit, onClick, className }: HotelCatalogCardProps) {
  const i18n = useHospitalityUiI18nOrDefault()
  const messages = i18n.messages.catalogCard
  const f = hit.document.fields
  const name = stringOr(f.name, messages.untitled)
  const propertyName = stringOr(f.propertyName, null)
  const city = stringOr(f.city, null)
  const country = stringOr(f.country, null)
  const starRating = numberOr(f.starRating, null)
  const capacity = numberOr(f.roomCapacity, null)
  const status = stringOr(f.status, null)
  const tags = stringArray(f.tags)

  const rate = numberOr(f.nightlyRateFromCents, null)
  const currency = stringOr(f.currency ?? f.sellCurrency, null)
  const rateLabel =
    rate != null && currency
      ? formatTemplate(messages.ratePerNight, {
          amount: i18n.formatCurrency(rate / 100, currency, {
            maximumFractionDigits: 0,
          }),
        })
      : null

  const location = [city, country].filter(Boolean).join(", ")

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
          <div className="min-w-0">
            <h3 className="line-clamp-2 font-medium text-sm">{name}</h3>
            {propertyName && <p className="text-muted-foreground text-xs">{propertyName}</p>}
          </div>
          {status && (
            <Badge variant={status === "active" ? "default" : "secondary"} className="shrink-0">
              {status}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
          {starRating != null && <span>{"★".repeat(Math.round(starRating))}</span>}
          {location && <span>{location}</span>}
          {capacity != null && (
            <span>· {formatTemplate(messages.sleeps, { count: capacity })}</span>
          )}
          {rateLabel && <span className="ml-auto font-medium text-foreground">{rateLabel}</span>}
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
