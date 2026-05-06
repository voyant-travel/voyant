"use client"

import type { PerSuiteQuote, WholeYachtQuote } from "@voyantjs/charters-react"
import { formatMessage } from "@voyantjs/i18n"
import { Card, CardContent, CardHeader } from "@voyantjs/ui/components/card"
import { cn } from "@voyantjs/ui/lib/utils"
import type * as React from "react"

import { useChartersUiI18nOrDefault } from "../i18n/index.js"

export interface WholeYachtQuoteCardProps extends React.ComponentPropsWithoutRef<typeof Card> {
  quote: WholeYachtQuote
  formatPrice?: (amount: string, currency: string) => string
}

export interface PerSuiteQuoteCardProps extends React.ComponentPropsWithoutRef<typeof Card> {
  quote: PerSuiteQuote
  formatPrice?: (amount: string, currency: string) => string
}

/**
 * Itemised display of a whole-yacht charter quote: charter fee + APA
 * (% of fee, computed amount) + total. APA explanatory copy is intentional —
 * even seasoned brokers occasionally have charterers who don't know what an
 * APA is. Mirrors what `composeWholeYachtQuote` returns server-side.
 */
export function WholeYachtQuoteCard({
  quote,
  formatPrice,
  className,
  ...props
}: WholeYachtQuoteCardProps) {
  const i18n = useChartersUiI18nOrDefault()
  const m = i18n.messages.wholeYachtQuoteCard.wholeYacht
  const formatPriceValue =
    formatPrice ??
    ((amount: string, currency: string) =>
      formatCharterPrice(amount, currency, {
        fallbackCurrencyAmount: i18n.messages.common.fallbackCurrencyAmount,
        formatCurrency: i18n.formatCurrency,
      }))

  return (
    <Card data-slot="whole-yacht-quote-card" className={cn(className)} {...props}>
      <CardHeader>
        <div className="flex items-baseline justify-between">
          <div>
            <h3 className="text-base font-semibold">{m.heading}</h3>
            <p className="text-sm text-muted-foreground">{m.summary}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">
              {formatPriceValue(quote.total, quote.currency)}
            </div>
            <div className="text-xs text-muted-foreground">{m.dueBeforeEmbarkation}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Row label={m.charterFee} amount={formatPriceValue(quote.charterFee, quote.currency)} />
        <Row
          label={formatMessage(m.apaLabel, { percent: quote.apaPercent })}
          amount={formatPriceValue(quote.apaAmount, quote.currency)}
        />
        <div className="border-t pt-3">
          <Row
            label={m.totalDue}
            amount={formatPriceValue(quote.total, quote.currency)}
            amountClassName="font-bold text-base"
          />
        </div>
        <p className="text-xs text-muted-foreground">{m.explanation}</p>
      </CardContent>
    </Card>
  )
}

/** Sibling component: simpler per-suite quote (suite price + optional port fee). */
export function PerSuiteQuoteCard({
  quote,
  formatPrice,
  className,
  ...props
}: PerSuiteQuoteCardProps) {
  const i18n = useChartersUiI18nOrDefault()
  const m = i18n.messages.wholeYachtQuoteCard.perSuite
  const formatPriceValue =
    formatPrice ??
    ((amount: string, currency: string) =>
      formatCharterPrice(amount, currency, {
        fallbackCurrencyAmount: i18n.messages.common.fallbackCurrencyAmount,
        formatCurrency: i18n.formatCurrency,
      }))

  return (
    <Card data-slot="per-suite-quote-card" className={cn(className)} {...props}>
      <CardHeader>
        <div className="flex items-baseline justify-between">
          <div>
            <h3 className="text-base font-semibold">{quote.suiteName}</h3>
            <p className="text-sm text-muted-foreground">{m.summary}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">
              {formatPriceValue(quote.total, quote.currency)}
            </div>
            <div className="text-xs text-muted-foreground">{m.allInForSuite}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Row label={m.suitePrice} amount={formatPriceValue(quote.suitePrice, quote.currency)} />
        {quote.portFee ? (
          <Row label={m.portFee} amount={formatPriceValue(quote.portFee, quote.currency)} />
        ) : null}
        <div className="border-t pt-3">
          <Row
            label={m.total}
            amount={formatPriceValue(quote.total, quote.currency)}
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

function formatCharterPrice(
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
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
