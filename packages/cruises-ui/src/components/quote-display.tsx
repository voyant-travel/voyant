"use client"

import type { Quote } from "@voyantjs/cruises-react"
import { Card, CardContent, CardHeader } from "@voyantjs/voyant-ui/components/card"
import { cn } from "@voyantjs/voyant-ui/lib/utils"
import type * as React from "react"

type QuoteComponent = Quote["components"][number]

export interface QuoteDisplayProps extends React.ComponentPropsWithoutRef<typeof Card> {
  quote: Quote
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

const COMPONENT_KIND_LABEL: Record<QuoteComponent["kind"], string> = {
  gratuity: "Gratuity",
  onboard_credit: "Onboard credit",
  port_charge: "Port charges",
  tax: "Tax",
  ncf: "Non-comm fees",
  airfare: "Airfare",
  transfer: "Transfer",
  insurance: "Insurance",
}

/**
 * Renders an itemised cruise quote: base per person, components grouped by
 * direction (additions / inclusions / credits), and totals. Mirrors what the
 * server's composeQuote returns; pure presentational.
 */
export function QuoteDisplay({
  quote,
  formatPrice = defaultFormatPrice,
  className,
  ...props
}: QuoteDisplayProps) {
  const additions = quote.components.filter((c) => c.direction === "addition")
  const inclusions = quote.components.filter((c) => c.direction === "inclusion")
  const credits = quote.components.filter((c) => c.direction === "credit")

  return (
    <Card data-slot="quote-display" className={cn(className)} {...props}>
      <CardHeader>
        <div className="flex items-baseline justify-between">
          <div>
            <h3 className="text-base font-semibold">Your quote</h3>
            {quote.fareCodeName ? (
              <p className="text-sm text-muted-foreground">
                {quote.fareCodeName}
                {quote.fareCode ? ` (${quote.fareCode})` : ""}
              </p>
            ) : null}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">
              {formatPrice(quote.totalForCabin, quote.currency)}
            </div>
            <div className="text-xs text-muted-foreground">
              for {quote.guestCount} guest{quote.guestCount === 1 ? "" : "s"} ({quote.occupancy}
              -occupancy cabin)
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <Row
          label={`Base · ${formatPrice(quote.basePerPerson, quote.currency)} pp × ${quote.guestCount}`}
        />
        {additions.length > 0 ? (
          <Section title="Additions">
            {additions.map((c) => (
              <Row
                key={`add-${c.kind}-${c.label ?? ""}-${c.amount}`}
                label={`${c.label ?? COMPONENT_KIND_LABEL[c.kind]}${c.perPerson ? " (per person)" : " (per cabin)"}`}
                amount={`+ ${formatPrice(c.amount, c.currency)}`}
              />
            ))}
          </Section>
        ) : null}
        {credits.length > 0 ? (
          <Section title="Credits">
            {credits.map((c) => (
              <Row
                key={`cred-${c.kind}-${c.label ?? ""}-${c.amount}`}
                label={`${c.label ?? COMPONENT_KIND_LABEL[c.kind]}${c.perPerson ? " (per person)" : " (per cabin)"}`}
                amount={`− ${formatPrice(c.amount, c.currency)}`}
                amountClassName="text-emerald-600"
              />
            ))}
          </Section>
        ) : null}
        {inclusions.length > 0 ? (
          <Section title="Included">
            {inclusions.map((c) => (
              <Row
                key={`inc-${c.kind}-${c.label ?? ""}`}
                label={c.label ?? COMPONENT_KIND_LABEL[c.kind]}
                amount="Included"
              />
            ))}
          </Section>
        ) : null}
        <div className="border-t pt-3">
          <Row
            label="Per person"
            amount={formatPrice(quote.totalPerPerson, quote.currency)}
            amountClassName="font-semibold"
          />
          <Row
            label="Total for cabin"
            amount={formatPrice(quote.totalForCabin, quote.currency)}
            amountClassName="font-bold text-base"
          />
        </div>
      </CardContent>
    </Card>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      {children}
    </div>
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
