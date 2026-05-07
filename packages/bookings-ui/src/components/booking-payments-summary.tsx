"use client"

import { useAdminBookingPayments, usePublicBookingPayments } from "@voyantjs/finance-react"
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { Banknote, CreditCard, Receipt, Ticket, Wallet } from "lucide-react"

import { useBookingsUiI18nOrDefault, useBookingsUiMessagesOrDefault } from "../i18n/provider.js"

/**
 * Map payment status to a badge variant — completed/pending visible
 * positively, failed/refunded surface destructive coloring so an
 * operator scanning the row can spot a chargeback or failure
 * without reading the label.
 */
const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  completed: "default",
  failed: "destructive",
  refunded: "destructive",
}

/**
 * Inline icon for the payment method column. Pure cosmetic — the
 * label still reads alongside, but operators trained on the icons
 * scan rows much faster than a method-string column.
 */
const methodIcon: Record<string, typeof CreditCard> = {
  card: CreditCard,
  credit_card: CreditCard,
  bank_transfer: Banknote,
  cash: Wallet,
  voucher: Ticket,
}

export interface BookingPaymentsSummaryProps {
  bookingId: string
  /**
   * Which API surface to fetch from. The customer-portal uses
   * `"public"` (default — hits `/v1/public/finance/bookings/:id/payments`).
   * The operator dashboard must pass `"admin"` because the
   * `/v1/public/*` middleware enforces a non-staff actor guard, so
   * staff sessions get blocked from the public endpoint.
   */
  variant?: "admin" | "public"
}

/**
 * Payment-centric view of the money movements recorded against a
 * booking's invoices. Sister card to `BookingInvoicesCard` (operator
 * template) which is invoice-centric — payments and invoices are
 * different concepts, so each gets its own table with its own lead
 * column.
 *
 * Column order here is operator-tested:
 *   1. **Suma** — what came in. Largest, bold, currency-formatted.
 *   2. **Metoda** — how (icon + label).
 *   3. **Status** — completed/pending/failed/refunded badge.
 *   4. **Data** — when.
 *   5. **Referinta** — provider tx id, capture id, etc.
 *   6. **Pentru** — which invoice this paid (secondary; shown last).
 *
 * The invoice number deliberately appears last as a "for" link, not
 * first as the primary identifier — that's the difference between
 * "list of payments" and "list of invoice line-items".
 */
export function BookingPaymentsSummary({
  bookingId,
  variant = "public",
}: BookingPaymentsSummaryProps) {
  const publicQuery = usePublicBookingPayments(bookingId, { enabled: variant === "public" })
  const adminQuery = useAdminBookingPayments(bookingId, { enabled: variant === "admin" })
  const data = variant === "admin" ? adminQuery.data : publicQuery.data
  const { formatDate } = useBookingsUiI18nOrDefault()
  const messages = useBookingsUiMessagesOrDefault()

  const payments = data?.data?.payments ?? []

  // Empty-state polish: completed totals across all visible rows so
  // the card carries useful summary information even when there are
  // many small partial payments to scan.
  const totalCompleted = payments
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + p.amountCents, 0)
  const currency = payments[0]?.currency ?? null

  return (
    <Card data-slot="booking-payments-summary">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          {messages.bookingPaymentsSummary.title}
          {payments.length > 0 ? (
            <Badge variant="outline" className="text-[10px]">
              {payments.length}
            </Badge>
          ) : null}
          {totalCompleted > 0 ? (
            <span className="ml-auto text-muted-foreground text-xs">
              Total received{" "}
              <span className="font-medium text-foreground">
                {formatMoney(totalCompleted, currency)}
              </span>
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-hidden p-0">
        {payments.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground text-sm">
            {messages.bookingPaymentsSummary.empty}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-4 py-2 text-right font-medium">
                    {messages.bookingPaymentsSummary.columns.amount}
                  </th>
                  <th className="px-4 py-2 text-left font-medium">
                    {messages.bookingPaymentsSummary.columns.method}
                  </th>
                  <th className="px-4 py-2 text-left font-medium">
                    {messages.bookingPaymentsSummary.columns.status}
                  </th>
                  <th className="px-4 py-2 text-left font-medium">
                    {messages.bookingPaymentsSummary.columns.date}
                  </th>
                  <th className="px-4 py-2 text-left font-medium">
                    {messages.bookingPaymentsSummary.columns.reference}
                  </th>
                  <th className="px-4 py-2 text-left font-medium">
                    {messages.bookingPaymentsSummary.columns.invoice}
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const MethodIcon = methodIcon[payment.paymentMethod] ?? Receipt
                  const methodLabel =
                    messages.bookingPaymentsSummary.paymentMethodLabels[
                      payment.paymentMethod as keyof typeof messages.bookingPaymentsSummary.paymentMethodLabels
                    ] ?? payment.paymentMethod
                  return (
                    <tr key={payment.id} className="border-b last:border-b-0">
                      <td className="px-4 py-2.5 text-right font-mono font-medium">
                        {formatMoney(payment.amountCents, payment.currency)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1.5">
                          <MethodIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          {methodLabel}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={statusVariant[payment.status] ?? "secondary"}>
                          {messages.bookingPaymentsSummary.paymentStatusLabels[
                            payment.status as keyof typeof messages.bookingPaymentsSummary.paymentStatusLabels
                          ] ?? payment.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">
                        {formatDate(payment.paymentDate)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          title={payment.referenceNumber ?? undefined}
                          className="inline-block max-w-[180px] truncate font-mono text-muted-foreground text-xs"
                        >
                          {payment.referenceNumber ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">{payment.invoiceNumber}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function formatMoney(cents: number, currency: string | null | undefined): string {
  if (!currency) {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cents / 100)
  }
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}
