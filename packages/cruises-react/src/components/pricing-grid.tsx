"use client"

import { formatMessage } from "@voyant-travel/i18n"
import { Badge } from "@voyant-travel/ui/components/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyant-travel/ui/components/table"
import { cn } from "@voyant-travel/ui/lib/utils"
import type * as React from "react"
import { useCruisesUiI18nOrDefault } from "../i18n/index.js"
import type { PriceRecord } from "../index.js"

export interface PricingGridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Flat list of prices for a single sailing (typically from useSailing(...,{include:["pricing"]})). */
  prices: PriceRecord[]
  /** Optional cabin-category id → display name resolver for nicer row labels. */
  categoryLabel?: (categoryId: string) => string
  /** Currency formatter; defaults to `${currency} ${amount}`. */
  formatPrice?: (amount: string, currency: string) => string
  /** Click handler for a (category, occupancy, fareCode) cell — typically opens the booking flow. */
  onCellSelect?: (price: PriceRecord) => void
}

const AVAILABILITY_VARIANT: Record<
  PriceRecord["availability"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  available: "default",
  limited: "secondary",
  on_request: "outline",
  wait_list: "outline",
  sold_out: "destructive",
}

/**
 * The cabin × occupancy pricing matrix that's the heart of any cruise booking
 * flow. Rows = cabin categories; columns = occupancy variants present in the
 * data; cells = lowest available fare per (category, occupancy). Cells render
 * an availability badge and the price; clicking surfaces the underlying row
 * for the booking flow to consume.
 */
export function PricingGrid({
  prices,
  categoryLabel,
  formatPrice,
  onCellSelect,
  className,
  ...props
}: PricingGridProps) {
  const i18n = useCruisesUiI18nOrDefault()
  const m = i18n.messages.pricingGrid
  const formatResolvedPrice =
    formatPrice ??
    ((amount: string, currency: string) =>
      formatCruiseMoney(
        amount,
        currency,
        {
          fallbackCurrencyAmount: i18n.messages.common.fallbackCurrencyAmount,
          formatCurrency: i18n.formatCurrency,
        },
        { maximumFractionDigits: 0 },
      ))

  if (prices.length === 0) {
    return (
      <div data-slot="pricing-grid-empty" className={cn("py-8 text-center", className)} {...props}>
        <p className="text-muted-foreground">{m.empty}</p>
      </div>
    )
  }

  // Pivot the flat list into a (categoryId × occupancy) → cheapest price row.
  const occupancies = Array.from(new Set(prices.map((p) => p.occupancy))).sort((a, b) => a - b)
  const grouped = new Map<string, Map<number, PriceRecord>>()
  for (const p of prices) {
    let row = grouped.get(p.cabinCategoryId)
    if (!row) {
      row = new Map()
      grouped.set(p.cabinCategoryId, row)
    }
    const existing = row.get(p.occupancy)
    if (!existing || Number(p.pricePerPerson) < Number(existing.pricePerPerson)) {
      row.set(p.occupancy, p)
    }
  }

  return (
    <div data-slot="pricing-grid" className={cn("overflow-x-auto", className)} {...props}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[220px]">{m.cabinCategory}</TableHead>
            {occupancies.map((occ) => (
              <TableHead key={occ} className="text-center">
                {occupancyLabel(occ, i18n.messages.common.occupancyTableLabels)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from(grouped.entries()).map(([categoryId, row]) => (
            <TableRow key={categoryId}>
              <TableCell className="font-medium">
                {categoryLabel?.(categoryId) ?? categoryId}
              </TableCell>
              {occupancies.map((occ) => {
                const price = row.get(occ)
                if (!price) {
                  return (
                    <TableCell key={occ} className="text-center text-muted-foreground">
                      —
                    </TableCell>
                  )
                }
                return (
                  <TableCell
                    key={occ}
                    className={cn(
                      "text-center align-top",
                      onCellSelect &&
                        price.availability !== "sold_out" &&
                        "cursor-pointer hover:bg-accent",
                    )}
                    onClick={
                      onCellSelect && price.availability !== "sold_out"
                        ? () => onCellSelect(price)
                        : undefined
                    }
                    data-slot="pricing-grid-cell"
                  >
                    <div className="font-semibold">
                      {formatResolvedPrice(price.pricePerPerson, price.currency)}
                    </div>
                    <div className="text-xs text-muted-foreground">{m.perPerson}</div>
                    <Badge
                      variant={AVAILABILITY_VARIANT[price.availability]}
                      className="mt-2 font-normal"
                    >
                      {m.availabilityLabels[price.availability]}
                    </Badge>
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function occupancyLabel(
  occupancy: number,
  labels: {
    single: string
    double: string
    triple: string
    quad: string
    fallback: string
  },
) {
  if (occupancy === 1) return labels.single
  if (occupancy === 2) return labels.double
  if (occupancy === 3) return labels.triple
  if (occupancy === 4) return labels.quad
  return formatMessage(labels.fallback, { count: occupancy })
}

function formatCruiseMoney(
  amount: string,
  currency: string,
  i18n: {
    fallbackCurrencyAmount: string
    formatCurrency: (
      value: number | string | bigint,
      currency: string,
      options?: Omit<Intl.NumberFormatOptions, "currency" | "style">,
    ) => string
  },
  options?: Omit<Intl.NumberFormatOptions, "currency" | "style">,
) {
  const n = Number(amount)
  if (!Number.isFinite(n)) {
    return formatMessage(i18n.fallbackCurrencyAmount, { currency, amount })
  }

  try {
    return i18n.formatCurrency(n, currency, options)
  } catch {
    return formatMessage(i18n.fallbackCurrencyAmount, { currency, amount })
  }
}
