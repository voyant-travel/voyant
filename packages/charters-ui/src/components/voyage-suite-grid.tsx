"use client"

import type { CharterSuiteRecord } from "@voyantjs/charters-react"
import { formatMessage } from "@voyantjs/i18n"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import { Card, CardContent, CardHeader } from "@voyantjs/ui/components/card"
import { cn } from "@voyantjs/ui/lib/utils"
import type * as React from "react"

import { useChartersUiI18nOrDefault } from "../i18n"

export interface VoyageSuiteGridProps extends React.HTMLAttributes<HTMLDivElement> {
  suites: CharterSuiteRecord[]
  /** ISO-4217 currency code. Resolved against each suite's `pricesByCurrency` map. */
  currency: string
  /**
   * Render the price in the requested currency. If the suite hasn't published
   * that currency, the row shows "Price on request".
   */
  formatPrice?: (amount: string, currency: string) => string
  /** Fired when an operator clicks "Quote suite" / "Book suite". */
  onSelectSuite?: (suite: CharterSuiteRecord) => void
  selectLabel?: string
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

function priceForCurrency(suite: CharterSuiteRecord, currency: string): string | null {
  // Per-currency suite price lives in a `Record<currency, amount>` map. Adding
  // a new currency is a content change at the data layer — the UI doesn't
  // need a code update.
  return suite.pricesByCurrency?.[currency] ?? null
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
  formatPrice,
  onSelectSuite,
  selectLabel,
  className,
  ...props
}: VoyageSuiteGridProps) {
  const i18n = useChartersUiI18nOrDefault()
  const m = i18n.messages.voyageSuiteGrid
  const formatPriceValue =
    formatPrice ??
    ((amount: string, currencyCode: string) =>
      formatSuitePrice(amount, currencyCode, {
        fallbackCurrencyAmount: i18n.messages.common.fallbackCurrencyAmount,
        formatCurrency: i18n.formatCurrency,
      }))
  const resolvedSelectLabel = selectLabel ?? m.defaultSelectLabel

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
        {m.empty}
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
                  <Badge variant="secondary">{m.categoryLabels[suite.suiteCategory]}</Badge>
                ) : null}
                <Badge variant={AVAILABILITY_VARIANT[suite.availability]}>
                  {m.availabilityLabels[suite.availability]}
                </Badge>
              </div>
              <h4 className="text-base font-semibold leading-tight">{suite.suiteName}</h4>
              <p className="text-xs text-muted-foreground">
                {formatSuiteMetadata(suite, {
                  suiteCode: suite.suiteCode,
                  squareFeetLabel: m.metadata.squareFeet,
                  maxGuestsLabel: m.metadata.maxGuests,
                  formatNumber: i18n.formatNumber,
                })}
              </p>
            </CardHeader>
            <CardContent className="mt-auto space-y-3 text-sm">
              {suite.description ? (
                <p className="line-clamp-2 text-muted-foreground">{suite.description}</p>
              ) : null}
              <div className="flex items-baseline justify-between border-t pt-2">
                <div>
                  <div className="text-lg font-semibold">
                    {price ? formatPriceValue(price, currency) : m.priceOnRequest}
                  </div>
                  {price ? (
                    <div className="text-xs text-muted-foreground">{m.perSuiteAllIn}</div>
                  ) : null}
                </div>
                {onSelectSuite ? (
                  <Button
                    data-slot="voyage-suite-select"
                    size="sm"
                    disabled={!isBookable}
                    onClick={() => onSelectSuite(suite)}
                  >
                    {resolvedSelectLabel}
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

function formatSuiteMetadata(
  suite: Pick<CharterSuiteRecord, "squareFeet" | "maxGuests">,
  options: {
    suiteCode: string
    squareFeetLabel: string
    maxGuestsLabel: string
    formatNumber: (
      value: number | string | bigint,
      formatOptions?: Intl.NumberFormatOptions,
    ) => string
  },
) {
  const parts = [options.suiteCode]

  if (suite.squareFeet) {
    parts.push(
      formatMessage(options.squareFeetLabel, {
        value: options.formatNumber(suite.squareFeet, { maximumFractionDigits: 0 }),
      }),
    )
  }

  if (suite.maxGuests) {
    parts.push(
      formatMessage(options.maxGuestsLabel, {
        count: options.formatNumber(suite.maxGuests, { maximumFractionDigits: 0 }),
      }),
    )
  }

  return parts.join(" · ")
}

function formatSuitePrice(
  amount: string,
  currency: string,
  options: {
    fallbackCurrencyAmount: string
    formatCurrency: (
      value: number | string | bigint,
      currency: string,
      formatOptions?: Omit<Intl.NumberFormatOptions, "currency" | "style">,
    ) => string
  },
) {
  const value = Number(amount)
  if (!Number.isFinite(value)) {
    return formatMessage(options.fallbackCurrencyAmount, { amount, currency })
  }

  return options.formatCurrency(value, currency, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}
