"use client"

import {
  type BookingPaymentScheduleRecord,
  type InvoiceRecord,
  type PublicFinanceBookingPaymentRecord,
  useAdminBookingPayments,
  useBookingPaymentSchedules,
  useInvoices,
} from "@voyantjs/finance-react"
import { Badge } from "@voyantjs/ui/components"
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"

import { useBookingsUiI18nOrDefault, useBookingsUiMessagesOrDefault } from "../i18n/provider.js"

export interface BookingPaymentReconciliationBannerProps {
  bookingId: string
}

type MoneyTotals = Map<string, number>

export function BookingPaymentReconciliationBanner({
  bookingId,
}: BookingPaymentReconciliationBannerProps) {
  const invoicesQuery = useInvoices({ bookingId, limit: 50 })
  const paymentsQuery = useAdminBookingPayments(bookingId)
  const schedulesQuery = useBookingPaymentSchedules(bookingId)
  const { formatCurrency } = useBookingsUiI18nOrDefault()
  const messages = useBookingsUiMessagesOrDefault().bookingPaymentReconciliationBanner

  const invoices = invoicesQuery.data?.data ?? []
  const payments = paymentsQuery.data?.data?.payments ?? []
  const schedules = schedulesQuery.data?.data ?? []
  const isLoading = invoicesQuery.isLoading || paymentsQuery.isLoading || schedulesQuery.isLoading

  const billedTotals = sumInvoiceTotals(invoices, "totalCents")
  const invoicePaidTotals = sumInvoiceTotals(invoices, "paidCents")
  const completedPaymentTotals = sumCompletedPayments(payments)
  const paidScheduleTotals = sumPaidSchedules(schedules)
  const driftTotals = calculateDriftTotals([
    invoicePaidTotals,
    completedPaymentTotals,
    paidScheduleTotals,
  ])
  const hasRecords = invoices.length > 0 || payments.length > 0 || schedules.length > 0
  const hasDrift = Array.from(driftTotals.values()).some((cents) => cents > 0)

  if (isLoading && !hasRecords) {
    return (
      <section className="rounded-md border bg-muted/30 p-4" aria-live="polite">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {messages.loading}
        </div>
      </section>
    )
  }

  return (
    <section
      className={
        hasDrift
          ? "rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
          : "rounded-md border bg-muted/30 p-4"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {hasDrift ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          )}
          <div>
            <h3 className="font-medium text-sm">{messages.title}</h3>
            <p className="mt-1 max-w-3xl text-sm opacity-80">
              {!hasRecords
                ? messages.empty
                : hasDrift
                  ? messages.driftDescription
                  : messages.reconciledDescription}
            </p>
          </div>
        </div>
        <Badge variant={hasDrift ? "destructive" : "outline"}>
          {hasDrift ? messages.driftBadge : messages.reconciledBadge}
        </Badge>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <ReconciliationMetric
          label={messages.billed}
          value={formatMoneyTotals(billedTotals, formatCurrency, messages.emptyValue)}
        />
        <ReconciliationMetric
          label={messages.invoicePaid}
          value={formatMoneyTotals(invoicePaidTotals, formatCurrency, messages.emptyValue)}
        />
        <ReconciliationMetric
          label={messages.recordedPayments}
          value={formatMoneyTotals(completedPaymentTotals, formatCurrency, messages.emptyValue)}
        />
        <ReconciliationMetric
          label={messages.schedulePaid}
          value={formatMoneyTotals(paidScheduleTotals, formatCurrency, messages.emptyValue)}
        />
        <ReconciliationMetric
          label={messages.drift}
          value={formatMoneyTotals(driftTotals, formatCurrency, messages.emptyValue)}
          emphasis={hasDrift}
        />
      </dl>
    </section>
  )
}

function ReconciliationMetric({
  label,
  value,
  emphasis = false,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={emphasis ? "mt-1 font-mono font-semibold text-sm" : "mt-1 font-mono text-sm"}>
        {value}
      </dd>
    </div>
  )
}

function sumInvoiceTotals(invoices: InvoiceRecord[], field: "paidCents" | "totalCents") {
  const totals: MoneyTotals = new Map()
  for (const invoice of invoices) {
    if (invoice.status === "void" || invoice.invoiceType === "credit_note") continue
    addMoney(totals, invoice.currency, invoice[field])
  }
  return totals
}

function sumCompletedPayments(payments: PublicFinanceBookingPaymentRecord[]) {
  const totals: MoneyTotals = new Map()
  for (const payment of payments) {
    if (payment.status !== "completed") continue
    addMoney(totals, payment.currency, payment.amountCents)
  }
  return totals
}

function sumPaidSchedules(schedules: BookingPaymentScheduleRecord[]) {
  const totals: MoneyTotals = new Map()
  for (const schedule of schedules) {
    if (schedule.status !== "paid") continue
    addMoney(totals, schedule.currency, schedule.amountCents)
  }
  return totals
}

function calculateDriftTotals(sources: MoneyTotals[]) {
  const currencies = new Set(sources.flatMap((source) => Array.from(source.keys())))
  const drift: MoneyTotals = new Map()
  for (const currency of currencies) {
    const amounts = sources.map((source) => source.get(currency) ?? 0)
    drift.set(currency, Math.max(...amounts) - Math.min(...amounts))
  }
  return drift
}

function addMoney(totals: MoneyTotals, currency: string, cents: number) {
  if (cents === 0) return
  totals.set(currency, (totals.get(currency) ?? 0) + cents)
}

function formatMoneyTotals(
  totals: MoneyTotals,
  formatCurrency: (amount: number, currency: string) => string,
  emptyValue: string,
) {
  const entries = Array.from(totals.entries()).filter(([, cents]) => cents > 0)
  if (entries.length === 0) return emptyValue
  return entries
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, cents]) => formatCurrency(cents / 100, currency))
    .join(" / ")
}
