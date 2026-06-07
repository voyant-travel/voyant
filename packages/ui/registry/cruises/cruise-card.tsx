"use client"

import type { SearchIndexEntry } from "@voyantjs/cruises-react"
import { formatMessage } from "@voyantjs/i18n"
import { Anchor, Calendar, Ship } from "lucide-react"
import type * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ExternalCruiseBadge } from "./external-badge"
import { useRegistryCruisesI18nOrDefault } from "./i18n"

export interface CruiseCardProps extends React.ComponentPropsWithoutRef<typeof Card> {
  cruise: SearchIndexEntry
  onSelect?: (cruise: SearchIndexEntry) => void
}

/**
 * Display card for a cruise summary — works for both self-managed and
 * external (adapter-sourced) entries. The provenance badge appears for
 * `source: "external"` so operators (and storefront shoppers, if surfaced)
 * can tell at a glance.
 */
export function CruiseCard({ cruise, onSelect, className, ...props }: CruiseCardProps) {
  const i18n = useRegistryCruisesI18nOrDefault()
  const m = i18n.messages.cruiseCard
  const isExternal = cruise.source === "external"
  return (
    <Card
      data-slot="cruise-card"
      className={cn("overflow-hidden transition-shadow hover:shadow-md", className)}
      onClick={onSelect ? () => onSelect(cruise) : undefined}
      {...props}
    >
      {cruise.heroImageUrl ? (
        <div
          data-slot="cruise-card-hero"
          className="aspect-[16/9] w-full bg-muted bg-cover bg-center"
          style={{ backgroundImage: `url(${cruise.heroImageUrl})` }}
          role="img"
          aria-label={cruise.name}
        />
      ) : null}
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge data-slot="cruise-card-type" variant="secondary">
            {m.cruiseTypeLabels[cruise.cruiseType]}
          </Badge>
          {isExternal && cruise.sourceProvider ? (
            <ExternalCruiseBadge sourceProvider={cruise.sourceProvider} />
          ) : null}
        </div>
        <h3 className="text-lg font-semibold leading-tight">{cruise.name}</h3>
        <p className="text-sm text-muted-foreground">
          {cruise.lineName} · {cruise.shipName}
        </p>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Ship aria-hidden="true" className="size-4 shrink-0" />
          <span>{formatMessage(m.nights, { count: cruise.nights })}</span>
        </div>
        {cruise.embarkPortName ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Anchor aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">
              {cruise.embarkPortName}
              {cruise.disembarkPortName && cruise.disembarkPortName !== cruise.embarkPortName
                ? ` → ${cruise.disembarkPortName}`
                : ` (${m.roundTrip})`}
            </span>
          </div>
        ) : null}
        {cruise.earliestDeparture ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar aria-hidden="true" className="size-4 shrink-0" />
            <span>{formatMessage(m.departurePrefix, { date: cruise.earliestDeparture })}</span>
          </div>
        ) : null}
        <div className="pt-2 text-base font-semibold">
          {formatCruisePrice(cruise.lowestPriceCents, cruise.lowestPriceCurrency, {
            pricingOnRequest: m.pricingOnRequest,
            formatCurrency: i18n.formatCurrency,
          })}
          {cruise.lowestPriceCents != null ? (
            <span className="text-xs font-normal text-muted-foreground"> {m.priceFromSuffix}</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function formatCruisePrice(
  amountCents: number | null,
  currency: string | null,
  options: {
    pricingOnRequest: string
    formatCurrency: (
      value: number | string | bigint,
      currency: string,
      options?: Omit<Intl.NumberFormatOptions, "currency" | "style">,
    ) => string
  },
) {
  if (amountCents == null || !currency) return options.pricingOnRequest
  return options.formatCurrency(amountCents / 100, currency, { maximumFractionDigits: 0 })
}
