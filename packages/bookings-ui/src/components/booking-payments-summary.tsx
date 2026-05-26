"use client"

import {
  type PaymentMethod,
  type PaymentStatus,
  useAdminBookingPayments,
  usePublicBookingPayments,
} from "@voyantjs/finance-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@voyantjs/ui/components"
import {
  ArrowRightLeft,
  Banknote,
  CreditCard,
  Eye,
  MoreHorizontal,
  Pencil,
  Receipt,
  Ticket,
  Trash2,
  Wallet,
} from "lucide-react"
import * as React from "react"

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

export interface BookingPaymentsSummaryRow {
  id: string
  invoiceId: string
  invoiceNumber: string
  invoiceType?: "invoice" | "proforma" | "credit_note"
  amountCents: number
  currency: string
  status: PaymentStatus
  paymentMethod: PaymentMethod
  paymentDate: string
  referenceNumber: string | null
  notes: string | null
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
  /**
   * Optional href builder for the invoice cell. When provided, the
   * invoice number renders as an anchor that the consumer can route
   * however it wants (TanStack Link, Next Link, raw <a>, etc.).
   */
  getInvoiceHref?: (row: BookingPaymentsSummaryRow) => string | null | undefined
  /**
   * Optional handler for the "View" action in the row menu. Consumers
   * typically call their router's navigate(). Middle-click isn't useful
   * on menu items, so this is a click handler rather than an href.
   */
  onViewPayment?: (row: BookingPaymentsSummaryRow) => void
  /** Convert the row's proforma invoice into a final invoice. */
  onConvertProforma?: (row: BookingPaymentsSummaryRow) => Promise<unknown> | unknown
  /** Edit handler — typically opens a dialog pre-filled with the row. */
  onEditPayment?: (row: BookingPaymentsSummaryRow) => void
  /**
   * Delete handler. Must resolve when the deletion is complete (the
   * card closes the confirm dialog on resolve). Throw or reject to
   * keep the dialog open with an error.
   */
  onDeletePayment?: (row: BookingPaymentsSummaryRow) => Promise<void> | void
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
  getInvoiceHref,
  onViewPayment,
  onConvertProforma,
  onEditPayment,
  onDeletePayment,
}: BookingPaymentsSummaryProps) {
  const publicQuery = usePublicBookingPayments(bookingId, { enabled: variant === "public" })
  const adminQuery = useAdminBookingPayments(bookingId, { enabled: variant === "admin" })
  const data = variant === "admin" ? adminQuery.data : publicQuery.data
  const { formatDate } = useBookingsUiI18nOrDefault()
  const messages = useBookingsUiMessagesOrDefault()
  const card = messages.bookingPaymentsSummary

  const payments = data?.data?.payments ?? []
  const hasConvertibleProformas = payments.some((payment) => payment.invoiceType === "proforma")
  const showActionsColumn = Boolean(
    onViewPayment ||
      (onConvertProforma && hasConvertibleProformas) ||
      onEditPayment ||
      onDeletePayment,
  )
  const [deleteTarget, setDeleteTarget] = React.useState<BookingPaymentsSummaryRow | null>(null)
  const [deletePending, setDeletePending] = React.useState(false)
  const [convertingInvoiceId, setConvertingInvoiceId] = React.useState<string | null>(null)

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || !onDeletePayment) return
    setDeletePending(true)
    try {
      await onDeletePayment(deleteTarget)
      setDeleteTarget(null)
    } finally {
      setDeletePending(false)
    }
  }

  const handleConvertProforma = async (row: BookingPaymentsSummaryRow) => {
    if (!onConvertProforma || row.invoiceType !== "proforma") return
    setConvertingInvoiceId(row.invoiceId)
    try {
      await onConvertProforma(row)
    } finally {
      setConvertingInvoiceId(null)
    }
  }

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
              {(() => {
                const parts = card.totalReceived.split("{amount}")
                return (
                  <>
                    {parts[0]}
                    <span className="font-medium text-foreground">
                      {formatMoney(totalCompleted, currency)}
                    </span>
                    {parts[1]}
                  </>
                )
              })()}
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
                  {showActionsColumn ? (
                    <th className="w-10 px-2 py-2 text-right font-medium">
                      <span className="sr-only">{card.columns.actions}</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const MethodIcon = methodIcon[payment.paymentMethod] ?? Receipt
                  const methodLabel =
                    messages.bookingPaymentsSummary.paymentMethodLabels[
                      payment.paymentMethod as keyof typeof messages.bookingPaymentsSummary.paymentMethodLabels
                    ] ?? payment.paymentMethod
                  const row: BookingPaymentsSummaryRow = {
                    id: payment.id,
                    invoiceId: payment.invoiceId,
                    invoiceNumber: payment.invoiceNumber,
                    invoiceType: payment.invoiceType,
                    amountCents: payment.amountCents,
                    currency: payment.currency,
                    status: payment.status,
                    paymentMethod: payment.paymentMethod,
                    paymentDate: payment.paymentDate,
                    referenceNumber: payment.referenceNumber,
                    notes: payment.notes,
                  }
                  const invoiceHref = getInvoiceHref?.(row) ?? null
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
                      <td className="px-4 py-2.5 font-mono text-xs">
                        {invoiceHref ? (
                          <a
                            href={invoiceHref}
                            className="text-foreground underline-offset-2 hover:underline"
                          >
                            {payment.invoiceNumber}
                          </a>
                        ) : (
                          payment.invoiceNumber
                        )}
                      </td>
                      {showActionsColumn ? (
                        <td className="px-2 py-2.5 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={card.actions.open}
                                />
                              }
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {onViewPayment ? (
                                <DropdownMenuItem onClick={() => onViewPayment(row)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  {card.actions.view}
                                </DropdownMenuItem>
                              ) : null}
                              {onConvertProforma && row.invoiceType === "proforma" ? (
                                <DropdownMenuItem
                                  disabled={convertingInvoiceId === row.invoiceId}
                                  onClick={() => void handleConvertProforma(row)}
                                >
                                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                                  {card.actions.convertToInvoice}
                                </DropdownMenuItem>
                              ) : null}
                              {onEditPayment ? (
                                <DropdownMenuItem onClick={() => onEditPayment(row)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  {card.actions.edit}
                                </DropdownMenuItem>
                              ) : null}
                              {onDeletePayment ? (
                                <>
                                  {onViewPayment || onEditPayment ? (
                                    <DropdownMenuSeparator />
                                  ) : null}
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => setDeleteTarget(row)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    {card.actions.delete}
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      {onDeletePayment ? (
        <AlertDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(next) => {
            if (!next && !deletePending) setDeleteTarget(null)
          }}
        >
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>{card.deleteConfirm.title}</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget
                  ? card.deleteConfirm.description.replace(
                      "{amount}",
                      formatMoney(deleteTarget.amountCents, deleteTarget.currency),
                    )
                  : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletePending}>
                {card.deleteConfirm.cancel}
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={deletePending}
                onClick={() => void handleDeleteConfirm()}
              >
                {card.deleteConfirm.confirm}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
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
