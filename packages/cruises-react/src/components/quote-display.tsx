"use client"

import { formatMessage } from "@voyant-travel/i18n"
import { Card, CardContent, CardHeader } from "@voyant-travel/ui/components/card"
import { cn } from "@voyant-travel/ui/lib/utils"
import type * as React from "react"
import { useCruisesUiI18nOrDefault } from "../i18n/index.js"
import type { Quote } from "../index.js"

type QuoteComponent = Quote["components"][number]

export interface QuoteDisplayProps extends React.ComponentPropsWithoutRef<typeof Card> {
  quote: Quote
  formatPrice?: (amount: string, currency: string) => string
}

/**
 * Renders an itemised cruise quote: base per person, components grouped by
 * direction (additions / inclusions / credits), and totals. Mirrors what the
 * server's composeQuote returns; pure presentational.
 */
export function QuoteDisplay({ quote, formatPrice, className, ...props }: QuoteDisplayProps) {
  const i18n = useCruisesUiI18nOrDefault()
  const m = i18n.messages.quoteDisplay
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
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        },
      ))

  const additions = quote.components.filter((c) => c.direction === "addition")
  const inclusions = quote.components.filter((c) => c.direction === "inclusion")
  const credits = quote.components.filter((c) => c.direction === "credit")
  const guestLabel = quote.guestCount === 1 ? m.guestLabelSingular : m.guestLabelPlural
  const occupancyLabel = formatMessage(m.occupancyCabin, { count: quote.occupancy })

  return (
    <Card data-slot="quote-display" className={cn(className)} {...props}>
      <CardHeader>
        <div className="flex items-baseline justify-between">
          <div>
            <h3 className="text-base font-semibold">{m.heading}</h3>
            {quote.fareCodeName ? (
              <p className="text-sm text-muted-foreground">
                {quote.fareCodeName}
                {quote.fareCode ? ` (${quote.fareCode})` : ""}
              </p>
            ) : null}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">
              {formatResolvedPrice(quote.totalForCabin, quote.currency)}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatMessage(m.guestSummary, {
                guestCount: quote.guestCount,
                guestLabel,
                occupancyLabel,
              })}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <Row
          label={formatMessage(m.baseLine, {
            price: formatResolvedPrice(quote.basePerPerson, quote.currency),
            guestCount: quote.guestCount,
          })}
        />
        {additions.length > 0 ? (
          <Section title={m.sections.additions}>
            {additions.map((c) => (
              <Row
                key={`add-${c.kind}-${c.label ?? ""}-${c.amount}`}
                label={componentLabel(c, m)}
                amount={`+ ${formatResolvedPrice(c.amount, c.currency)}`}
              />
            ))}
          </Section>
        ) : null}
        {credits.length > 0 ? (
          <Section title={m.sections.credits}>
            {credits.map((c) => (
              <Row
                key={`cred-${c.kind}-${c.label ?? ""}-${c.amount}`}
                label={componentLabel(c, m)}
                amount={`− ${formatResolvedPrice(c.amount, c.currency)}`}
                amountClassName="text-emerald-600"
              />
            ))}
          </Section>
        ) : null}
        {inclusions.length > 0 ? (
          <Section title={m.sections.included}>
            {inclusions.map((c) => (
              <Row
                key={`inc-${c.kind}-${c.label ?? ""}`}
                label={c.label ?? m.componentKindLabels[c.kind]}
                amount={m.includedAmount}
              />
            ))}
          </Section>
        ) : null}
        <div className="border-t pt-3">
          <Row
            label={m.totals.perPerson}
            amount={formatResolvedPrice(quote.totalPerPerson, quote.currency)}
            amountClassName="font-semibold"
          />
          <Row
            label={m.totals.totalForCabin}
            amount={formatResolvedPrice(quote.totalForCabin, quote.currency)}
            amountClassName="font-bold text-base"
          />
        </div>
      </CardContent>
    </Card>
  )
}

function componentLabel(
  component: QuoteComponent,
  messages: {
    componentKindLabels: Record<QuoteComponent["kind"], string>
    componentScope: {
      perPerson: string
      perCabin: string
    }
  },
) {
  const baseLabel = component.label ?? messages.componentKindLabels[component.kind]
  const scope = component.perPerson
    ? messages.componentScope.perPerson
    : messages.componentScope.perCabin
  return `${baseLabel} (${scope})`
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
