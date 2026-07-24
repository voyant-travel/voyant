"use client"

import { formatMessage } from "@voyant-travel/i18n"
import { Badge } from "@voyant-travel/ui/components/badge"
import { Card, CardContent, CardHeader } from "@voyant-travel/ui/components/card"
import { cn } from "@voyant-travel/ui/lib/utils"
import { CheckCircle2 } from "lucide-react"
import type * as React from "react"
import { useChartersUiI18nOrDefault } from "../i18n/index.js"
import type { BookingCharterDetailRecord } from "../index.js"

export interface ApaTrackerProps extends React.ComponentPropsWithoutRef<typeof Card> {
  detail: BookingCharterDetailRecord
  formatPrice?: (amount: string, currency: string) => string
}

function parseAmount(value: string | null): number {
  if (!value) return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * APA reconciliation panel for a whole-yacht charter booking. Renders the
 * snapshotted APA (charged to the charterer pre-charter), payments collected,
 * spend reported by the captain, and the refund balance owed back. Renders
 * nothing for per-suite bookings (APA only applies to whole-yacht).
 *
 * Pure presentational — wire actions (record payment, reconcile) at the
 * caller via `useRecordApaPayment` / `useReconcileApa`.
 */
export function ApaTracker({ detail, formatPrice, className, ...props }: ApaTrackerProps) {
  const i18n = useChartersUiI18nOrDefault()
  const m = i18n.messages.apaTracker
  const formatPriceValue =
    formatPrice ??
    ((amount: string, currency: string) =>
      formatCharterPrice(amount, currency, {
        fallbackCurrencyAmount: i18n.messages.common.fallbackCurrencyAmount,
        formatCurrency: i18n.formatCurrency,
      }))

  if (detail.bookingMode !== "whole_yacht") return null

  const currency = detail.quotedCurrency
  const apaQuoted = parseAmount(detail.apaAmount)
  const apaPaid = parseAmount(detail.apaPaidAmount)
  const apaSpent = parseAmount(detail.apaSpentAmount)
  const apaRefund = parseAmount(detail.apaRefundAmount)
  const balance = apaPaid - apaSpent - apaRefund
  const balanceLabel =
    balance > 0
      ? m.tiles.remainingToRefundOrSpend
      : balance < 0
        ? m.tiles.overspentTopUpRequired
        : m.tiles.fullyReconciled
  const isSettled = !!detail.apaSettledAt

  const collectionPct = apaQuoted > 0 ? Math.min(100, (apaPaid / apaQuoted) * 100) : 0
  const spendPct = apaPaid > 0 ? Math.min(100, (apaSpent / apaPaid) * 100) : 0

  return (
    <Card data-slot="apa-tracker" className={cn(className)} {...props}>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">{m.heading}</h3>
            <p className="text-sm text-muted-foreground">
              {formatMessage(m.subtitle, { percent: detail.apaPercent ?? "—" })}
            </p>
          </div>
          {isSettled ? (
            <Badge variant="default" data-slot="apa-tracker-settled">
              <CheckCircle2 aria-hidden="true" className="mr-1 size-3" />
              {m.status.settled}
            </Badge>
          ) : (
            <Badge variant="outline">{m.status.inProgress}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-3">
          <Bar
            label={m.bars.collectedFromCharterer}
            current={apaPaid}
            target={apaQuoted}
            currency={currency}
            pct={collectionPct}
            formatPrice={formatPriceValue}
            ofAmountLabel={m.bars.ofAmount}
          />
          <Bar
            label={m.bars.spentOnBoard}
            current={apaSpent}
            target={apaPaid || apaQuoted}
            currency={currency}
            pct={spendPct}
            formatPrice={formatPriceValue}
            ofAmountLabel={m.bars.ofAmount}
            tone="muted"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t pt-3">
          <Tile
            label={m.tiles.refundIssued}
            amount={formatPriceValue(detail.apaRefundAmount ?? "0.00", currency)}
          />
          <Tile
            label={balanceLabel}
            amount={formatPriceValue(Math.abs(balance).toFixed(2), currency)}
            highlight={balance !== 0}
          />
        </div>
        {detail.apaSettledAt ? (
          <p className="text-xs text-muted-foreground">
            {formatMessage(m.settledAt, {
              date: i18n.formatDateTime(detail.apaSettledAt),
            })}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function Bar({
  label,
  current,
  target,
  currency,
  pct,
  formatPrice,
  ofAmountLabel,
  tone = "default",
}: {
  label: string
  current: number
  target: number
  currency: string
  pct: number
  formatPrice: (amount: string, currency: string) => string
  ofAmountLabel: string
  tone?: "default" | "muted"
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium">
          {formatPrice(current.toFixed(2), currency)}{" "}
          <span className="text-xs font-normal text-muted-foreground">
            {formatMessage(ofAmountLabel, {
              amount: formatPrice(target.toFixed(2), currency),
            })}
          </span>
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all",
            tone === "muted" ? "bg-muted-foreground/40" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
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

function Tile({
  label,
  amount,
  highlight = false,
}: {
  label: string
  amount: string
  highlight?: boolean
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn("mt-1 text-base tabular-nums", highlight ? "font-semibold" : "font-medium")}
      >
        {amount}
      </div>
    </div>
  )
}
