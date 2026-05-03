"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components/card"
import { Skeleton } from "@voyantjs/ui/components/skeleton"

import type { SidePanelState } from "../types.js"

export function PriceSidePanel({
  pricing,
  isQuoting,
  invalidReason,
  className,
}: SidePanelState & { className?: string }): React.ReactElement {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Price</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isQuoting && !pricing ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
        ) : null}
        {invalidReason ? <p className="text-destructive text-sm">{invalidReason}</p> : null}
        {pricing ? (
          <>
            <ul className="space-y-1 text-sm">
              {pricing.lines.map((line) => (
                <li
                  key={`${line.kind}-${line.label}-${line.totalAmount}`}
                  className="flex justify-between"
                >
                  <span>
                    {line.label}
                    {line.quantity ? (
                      <span className="text-muted-foreground"> × {line.quantity}</span>
                    ) : null}
                  </span>
                  <span>{formatMoney(line.totalAmount, pricing.currency)}</span>
                </li>
              ))}
            </ul>
            {pricing.taxes.length > 0 ? (
              <ul className="space-y-1 border-t pt-2 text-sm text-muted-foreground">
                {pricing.taxes.map((tax) => (
                  <li key={tax.code} className="flex justify-between">
                    <span>{tax.label}</span>
                    <span>{formatMoney(tax.amount, pricing.currency)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex justify-between border-t pt-2 font-medium">
              <span>Total</span>
              <span>{formatMoney(pricing.total, pricing.currency)}</span>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}
