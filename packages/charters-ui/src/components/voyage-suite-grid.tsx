"use client"

import type { CharterSuiteRecord } from "@voyantjs/charters-react"
import { Badge } from "@voyantjs/voyant-ui/components/badge"
import { Button } from "@voyantjs/voyant-ui/components/button"
import { Card, CardContent, CardHeader } from "@voyantjs/voyant-ui/components/card"
import { cn } from "@voyantjs/voyant-ui/lib/utils"
import type * as React from "react"

export interface VoyageSuiteGridProps extends React.HTMLAttributes<HTMLDivElement> {
  suites: CharterSuiteRecord[]
  currency: "USD" | "EUR" | "GBP" | "AUD"
  /**
   * Render the price in the requested currency. If the suite hasn't published
   * that currency, the row shows "Price on request".
   */
  formatPrice?: (amount: string, currency: string) => string
  /** Fired when an operator clicks "Quote suite" / "Book suite". */
  onSelectSuite?: (suite: CharterSuiteRecord) => void
  selectLabel?: string
}

const AVAILABILITY_LABEL: Record<CharterSuiteRecord["availability"], string> = {
  available: "Available",
  limited: "Limited",
  on_request: "On request",
  wait_list: "Wait list",
  sold_out: "Sold out",
}

const AVAILABILITY_VARIANT: Record<
  CharterSuiteRecord["availability"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  available: "default",
  limited: "secondary",
  on_request: "outline",
  wait_list: "outline",
  sold_out: "destructive",
}

const CATEGORY_LABEL: Record<NonNullable<CharterSuiteRecord["suiteCategory"]>, string> = {
  standard: "Standard",
  deluxe: "Deluxe",
  suite: "Suite",
  penthouse: "Penthouse",
  owners: "Owners",
  signature: "Signature",
}

function defaultFormatPrice(amount: string, currency: string): string {
  const n = Number(amount)
  if (!Number.isFinite(n)) return `${currency} ${amount}`
  return `${currency} ${n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`
}

function priceForCurrency(suite: CharterSuiteRecord, currency: string): string | null {
  switch (currency) {
    case "USD":
      return suite.priceUSD
    case "EUR":
      return suite.priceEUR
    case "GBP":
      return suite.priceGBP
    case "AUD":
      return suite.priceAUD
    default:
      return null
  }
}

/**
 * Per-suite pricing grid for a charter voyage. Renders one card per suite with
 * category, square-footage, max-guests, availability, and the price in the
 * caller's preferred currency. Click-through fires `onSelectSuite` so the
 * parent can open a booking flow / quote dialog.
 *
 * Pure presentational — fetch the suites via `useCharterVoyage(id, { include: ['suites'] })`
 * and pass `data?.suites ?? []` here.
 */
export function VoyageSuiteGrid({
  suites,
  currency,
  formatPrice = defaultFormatPrice,
  onSelectSuite,
  selectLabel = "Quote suite",
  className,
  ...props
}: VoyageSuiteGridProps) {
  if (suites.length === 0) {
    return (
      <div
        data-slot="voyage-suite-grid-empty"
        className={cn(
          "rounded-md border border-dashed p-8 text-center text-muted-foreground",
          className,
        )}
        {...props}
      >
        No suites published for this voyage yet.
      </div>
    )
  }

  return (
    <div
      data-slot="voyage-suite-grid"
      className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}
      {...props}
    >
      {suites.map((suite) => {
        const price = priceForCurrency(suite, currency)
        const isBookable = suite.availability !== "sold_out"
        return (
          <Card
            key={suite.id}
            data-slot="voyage-suite-card"
            className="flex flex-col overflow-hidden"
          >
            {suite.images && suite.images.length > 0 && suite.images[0] ? (
              <div
                data-slot="voyage-suite-card-hero"
                className="aspect-[4/3] w-full bg-muted bg-cover bg-center"
                style={{ backgroundImage: `url(${suite.images[0]})` }}
                role="img"
                aria-label={suite.suiteName}
              />
            ) : null}
            <CardHeader className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {suite.suiteCategory ? (
                  <Badge variant="secondary">{CATEGORY_LABEL[suite.suiteCategory]}</Badge>
                ) : null}
                <Badge variant={AVAILABILITY_VARIANT[suite.availability]}>
                  {AVAILABILITY_LABEL[suite.availability]}
                </Badge>
              </div>
              <h4 className="text-base font-semibold leading-tight">{suite.suiteName}</h4>
              <p className="text-xs text-muted-foreground">
                {suite.suiteCode}
                {suite.squareFeet ? ` · ${suite.squareFeet} sq ft` : ""}
                {suite.maxGuests ? ` · up to ${suite.maxGuests} guests` : ""}
              </p>
            </CardHeader>
            <CardContent className="mt-auto space-y-3 text-sm">
              {suite.description ? (
                <p className="line-clamp-2 text-muted-foreground">{suite.description}</p>
              ) : null}
              <div className="flex items-baseline justify-between border-t pt-2">
                <div>
                  <div className="text-lg font-semibold">
                    {price ? formatPrice(price, currency) : "Price on request"}
                  </div>
                  {price ? (
                    <div className="text-xs text-muted-foreground">per suite, all-in</div>
                  ) : null}
                </div>
                {onSelectSuite ? (
                  <Button
                    data-slot="voyage-suite-select"
                    size="sm"
                    disabled={!isBookable}
                    onClick={() => onSelectSuite(suite)}
                  >
                    {selectLabel}
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
