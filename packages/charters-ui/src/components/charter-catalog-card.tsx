"use client"

import type { CatalogSearchHit } from "@voyantjs/catalog-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { Card, CardContent } from "@voyantjs/ui/components/card"
import { cn } from "@voyantjs/ui/lib/utils"

export interface CharterCatalogCardProps {
  hit: CatalogSearchHit
  onClick?: (hit: CatalogSearchHit) => void
  className?: string
}

/**
 * Search-result card for a charter (yacht) hit. Reads:
 * `name`, `yachtName`, `lengthMeters`, `cabins`, `weeklyRateFromCents`,
 * `currency`, `homePort`, `tags`.
 */
export function CharterCatalogCard({ hit, onClick, className }: CharterCatalogCardProps) {
  const f = hit.document.fields
  const name = stringOr(f.name, "Untitled charter")
  const yachtName = stringOr(f.yachtName, null)
  const lengthMeters = numberOr(f.lengthMeters, null)
  const cabins = numberOr(f.cabins, null)
  const homePort = stringOr(f.homePort, null)
  const status = stringOr(f.status, null)
  const tags = stringArray(f.tags)

  const rate = numberOr(f.weeklyRateFromCents, null)
  const currency = stringOr(f.currency ?? f.sellCurrency, null)
  const rateLabel =
    rate != null && currency
      ? `${new Intl.NumberFormat(undefined, {
          style: "currency",
          currency,
          maximumFractionDigits: 0,
        }).format(rate / 100)} / week`
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
          <div className="min-w-0">
            <h3 className="line-clamp-2 font-medium text-sm">{name}</h3>
            {yachtName && <p className="text-muted-foreground text-xs">{yachtName}</p>}
          </div>
          {status && (
            <Badge variant={status === "active" ? "default" : "secondary"} className="shrink-0">
              {status}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
          {lengthMeters != null && <span>{lengthMeters} m</span>}
          {cabins != null && (
            <span>
              · {cabins} cabin{cabins === 1 ? "" : "s"}
            </span>
          )}
          {homePort && <span>· {homePort}</span>}
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
