"use client"

import type { PerSuiteQuote, WholeYachtQuote } from "@voyantjs/charters-react"
import { Card, CardContent, CardHeader } from "@voyantjs/voyant-ui/components/card"
import { cn } from "@voyantjs/voyant-ui/lib/utils"
import type * as React from "react"

export interface WholeYachtQuoteCardProps extends React.ComponentPropsWithoutRef<typeof Card> {
  quote: WholeYachtQuote
  formatPrice?: (amount: string, currency: string) => string
}

export interface PerSuiteQuoteCardProps extends React.ComponentPropsWithoutRef<typeof Card> {
  quote: PerSuiteQuote
  formatPrice?: (amount: string, currency: string) => string
}

function defaultFormatPrice(amount: string, currency: string): string {
  const negative = amount.startsWith("-")
  const abs = negative ? amount.slice(1) : amount
  const n = Number(abs)
  if (!Number.isFinite(n)) return `${currency} ${amount}`
  return `${negative ? "-" : ""}${currency} ${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Itemised display of a whole-yacht charter quote: charter fee + APA
 * (% of fee, computed amount) + total. APA explanatory copy is intentional —
 * even seasoned brokers occasionally have charterers who don't know what an
 * APA is. Mirrors what `composeWholeYachtQuote` returns server-side.
 */
export function WholeYachtQuoteCard({
  quote,
  formatPrice = defaultFormatPrice,
  className,
  ...props
}: WholeYachtQuoteCardProps) {
  return (
    <Card data-slot="whole-yacht-quote-card" className={cn(className)} {...props}>
      <CardHeader>
        <div className="flex items-baseline justify-between">
          <div>
            <h3 className="text-base font-semibold">Whole-yacht charter quote</h3>
            <p className="text-sm text-muted-foreground">
              Charter fee + APA collected up front; APA reconciled post-charter
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{formatPrice(quote.total, quote.currency)}</div>
            <div className="text-xs text-muted-foreground">due before embarkation</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Row label="Charter fee" amount={formatPrice(quote.charterFee, quote.currency)} />
        <Row
          label={`APA (Advance Provisioning Allowance, ${quote.apaPercent}% of charter fee)`}
          amount={formatPrice(quote.apaAmount, quote.currency)}
        />
        <div className="border-t pt-3">
          <Row
            label="Total due"
            amount={formatPrice(quote.total, quote.currency)}
            amountClassName="font-bold text-base"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          The APA covers fuel, food, beverages, port charges, and other operational expenses during
          the charter. The actual spend is reconciled at the end of the charter and any surplus is
          refunded to the charterer.
        </p>
      </CardContent>
    </Card>
  )
}

/** Sibling component: simpler per-suite quote (suite price + optional port fee). */
export function PerSuiteQuoteCard({
  quote,
  formatPrice = defaultFormatPrice,
  className,
  ...props
}: PerSuiteQuoteCardProps) {
  return (
    <Card data-slot="per-suite-quote-card" className={cn(className)} {...props}>
      <CardHeader>
        <div className="flex items-baseline justify-between">
          <div>
            <h3 className="text-base font-semibold">{quote.suiteName}</h3>
            <p className="text-sm text-muted-foreground">Per-suite charter quote</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{formatPrice(quote.total, quote.currency)}</div>
            <div className="text-xs text-muted-foreground">all-in for this suite</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Row label="Suite price" amount={formatPrice(quote.suitePrice, quote.currency)} />
        {quote.portFee ? (
          <Row label="Port fee" amount={formatPrice(quote.portFee, quote.currency)} />
        ) : null}
        <div className="border-t pt-3">
          <Row
            label="Total"
            amount={formatPrice(quote.total, quote.currency)}
            amountClassName="font-bold text-base"
          />
        </div>
      </CardContent>
    </Card>
  )
}

function Row({
  label,
  amount,
  amountClassName,
}: {
  label: string
  amount?: string
  amountClassName?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      {amount ? <span className={cn("tabular-nums", amountClassName)}>{amount}</span> : null}
    </div>
  )
}
