"use client"

import type { PriceRecord } from "@voyantjs/cruises-react"
import { Badge } from "@voyantjs/voyant-ui/components/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/voyant-ui/components/table"
import { cn } from "@voyantjs/voyant-ui/lib/utils"
import type * as React from "react"

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

const AVAILABILITY_LABEL: Record<PriceRecord["availability"], string> = {
  available: "Available",
  limited: "Limited",
  on_request: "On request",
  wait_list: "Wait list",
  sold_out: "Sold out",
}

function defaultFormatPrice(amount: string, currency: string): string {
  const n = Number(amount)
  if (!Number.isFinite(n)) return `${currency} ${amount}`
  return `${currency} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
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
  formatPrice = defaultFormatPrice,
  onCellSelect,
  className,
  ...props
}: PricingGridProps) {
  if (prices.length === 0) {
    return (
      <div data-slot="pricing-grid-empty" className={cn("py-8 text-center", className)} {...props}>
        <p className="text-muted-foreground">No pricing published for this sailing.</p>
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
            <TableHead className="w-[220px]">Cabin category</TableHead>
            {occupancies.map((occ) => (
              <TableHead key={occ} className="text-center">
                {occ === 1
                  ? "Single"
                  : occ === 2
                    ? "Double"
                    : occ === 3
                      ? "Triple"
                      : occ === 4
                        ? "Quad"
                        : `${occ}-occupancy`}
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
                      {formatPrice(price.pricePerPerson, price.currency)}
                    </div>
                    <div className="text-xs text-muted-foreground">per person</div>
                    <Badge
                      variant={AVAILABILITY_VARIANT[price.availability]}
                      className="mt-2 font-normal"
                    >
                      {AVAILABILITY_LABEL[price.availability]}
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
