"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  type PaymentMethod,
  type PaymentStatus,
  useAdminBookingPayments,
  usePublicBookingPayments,
} from "@voyant-travel/finance-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@voyant-travel/ui/components"
import { DataTable } from "@voyant-travel/ui/components/data-table"
import { ArrowUpRight, CreditCard, Eye, Pencil, Trash2 } from "lucide-react"
import * as React from "react"
import { useBookingsUiI18nOrDefault, useBookingsUiMessagesOrDefault } from "../i18n/provider.js"
import { IconActionButton } from "./icon-action-button.js"
import { StatusBadge } from "./status-badge.js"

export interface BookingPaymentSummaryPaymentRow {
  id: string
  source: "payment"
  invoiceId: string
  invoiceNumber: string
  invoiceType?: "invoice" | "proforma" | "credit_note"
  amountCents: number
  currency: string
  /** When the customer paid in a different currency than the invoice. */
  baseCurrency?: string | null
  baseAmountCents?: number | null
  status: PaymentStatus
  paymentMethod: PaymentMethod
  paymentDate: string
  referenceNumber: string | null
  notes: string | null
}

export interface BookingPaymentSummaryTravelCreditRedemptionRow
  extends Omit<
    BookingPaymentSummaryPaymentRow,
    "source" | "invoiceId" | "invoiceNumber" | "invoiceType"
  > {
  source: "travel_credit_redemption"
  invoiceId: null
  invoiceNumber: null
  invoiceType: null
}

export type BookingPaymentsSummaryRow =
  | BookingPaymentSummaryPaymentRow
  | BookingPaymentSummaryTravelCreditRedemptionRow

type BookingPaymentsSummaryInputRow = {
  id: string
  source?: BookingPaymentsSummaryRow["source"]
  invoiceId: string | null
  invoiceNumber: string | null
  invoiceType?: BookingPaymentSummaryPaymentRow["invoiceType"] | null
  amountCents: number
  currency: string
  baseCurrency?: string | null
  baseAmountCents?: number | null
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
   * Open the linked invoice in-place (typically a Sheet that renders
   * the invoice detail page). When omitted, the invoice number cell
   * renders as plain text.
   */
  onInvoiceOpen?: (invoiceId: string, row: BookingPaymentsSummaryRow) => void
  /**
   * Optional invoice href for hosts that navigate with route links
   * instead of an in-place invoice panel.
   */
  getInvoiceHref?: (row: BookingPaymentsSummaryRow) => string
  /**
   * Optional handler for the "View" action in the row menu. Consumers
   * typically call their router's navigate(). Middle-click isn't useful
   * on menu items, so this is a click handler rather than an href.
   */
  onViewPayment?: (row: BookingPaymentsSummaryRow) => void
  /** Convert a proforma invoice attached to the payment into a final invoice. */
  onConvertProforma?: (row: BookingPaymentsSummaryRow) => Promise<unknown> | unknown
  /** Edit handler — typically opens a dialog pre-filled with the row. */
  onEditPayment?: (row: BookingPaymentsSummaryRow) => void
  /**
   * Delete handler. Must resolve when the deletion is complete (the
   * card closes the confirm dialog on resolve). Throw or reject to
   * keep the dialog open with an error.
   */
  onDeletePayment?: (row: BookingPaymentsSummaryRow) => Promise<void> | void
  /**
   * Extra content rendered on the right of the card header (e.g. a
   * `Record payment` button). Keeps section-level actions co-located
   * with the section instead of floating at the top of the tab.
   */
  headerAction?: React.ReactNode
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
  onInvoiceOpen,
  getInvoiceHref,
  onViewPayment,
  onConvertProforma,
  onEditPayment,
  onDeletePayment,
  headerAction,
}: BookingPaymentsSummaryProps) {
  const publicQuery = usePublicBookingPayments(bookingId, { enabled: variant === "public" })
  const adminQuery = useAdminBookingPayments(bookingId, { enabled: variant === "admin" })
  const data = variant === "admin" ? adminQuery.data : publicQuery.data
  const { formatDateTime } = useBookingsUiI18nOrDefault()
  const messages = useBookingsUiMessagesOrDefault()
  const card = messages.bookingPaymentsSummary

  const payments = data?.data?.payments ?? []
  const showActionsColumn = Boolean(
    onViewPayment || onConvertProforma || onEditPayment || onDeletePayment,
  )
  const [deleteTarget, setDeleteTarget] = React.useState<BookingPaymentsSummaryRow | null>(null)
  const [deletePending, setDeletePending] = React.useState(false)

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

  const paymentRows = React.useMemo<BookingPaymentsSummaryRow[]>(
    () =>
      payments.map((payment: BookingPaymentsSummaryInputRow) => {
        const base = {
          id: payment.id,
          amountCents: payment.amountCents,
          currency: payment.currency,
          baseCurrency: payment.baseCurrency ?? null,
          baseAmountCents: payment.baseAmountCents ?? null,
          status: payment.status,
          paymentMethod: payment.paymentMethod,
          paymentDate: payment.paymentDate,
          referenceNumber: payment.referenceNumber,
          notes: payment.notes,
        }

        const source = payment.source ?? "payment"

        if (source === "travel_credit_redemption") {
          return {
            ...base,
            source: "travel_credit_redemption" as const,
            invoiceId: null,
            invoiceNumber: null,
            invoiceType: null,
          }
        }

        return {
          ...base,
          source: "payment" as const,
          invoiceId: payment.invoiceId ?? "",
          invoiceNumber: payment.invoiceNumber ?? "",
          invoiceType: payment.invoiceType ?? undefined,
        }
      }),
    [payments],
  )

  const columns = React.useMemo<ColumnDef<BookingPaymentsSummaryRow>[]>(() => {
    const cols: ColumnDef<BookingPaymentsSummaryRow>[] = [
      {
        accessorKey: "paymentDate",
        header: card.columns.date,
        cell: ({ row }) => formatDateTime(row.original.paymentDate),
      },
      {
        accessorKey: "amountCents",
        header: card.columns.amount,
        cell: ({ row }) => (
          <span className="font-mono font-medium">
            {formatMoney(row.original.amountCents, row.original.currency)}
          </span>
        ),
      },
      {
        id: "fx",
        header: card.columns.fx,
        cell: ({ row }) => {
          const { baseCurrency, baseAmountCents, currency } = row.original
          if (
            !baseCurrency ||
            baseAmountCents == null ||
            baseCurrency.toUpperCase() === currency.toUpperCase()
          ) {
            return <span className="text-muted-foreground">—</span>
          }
          return (
            <span className="font-mono text-xs">
              ≈ {formatMoney(baseAmountCents, baseCurrency)}
            </span>
          )
        },
      },
      {
        accessorKey: "paymentMethod",
        header: card.columns.method,
        cell: ({ row }) =>
          card.paymentMethodLabels[
            row.original.paymentMethod as keyof typeof card.paymentMethodLabels
          ] ?? row.original.paymentMethod,
      },
      {
        accessorKey: "status",
        header: card.columns.status,
        cell: ({ row }) => (
          <StatusBadge status={row.original.status}>
            {card.paymentStatusLabels[
              row.original.status as keyof typeof card.paymentStatusLabels
            ] ?? row.original.status}
          </StatusBadge>
        ),
      },
      {
        accessorKey: "referenceNumber",
        header: card.columns.reference,
        cell: ({ row }) => (
          <span
            title={row.original.referenceNumber ?? undefined}
            className="inline-block max-w-[180px] truncate font-mono text-muted-foreground text-xs"
          >
            {row.original.referenceNumber ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "invoiceNumber",
        header: card.columns.invoice,
        cell: ({ row }) => {
          const payment = row.original
          if (payment.source !== "payment") {
            return <span className="text-muted-foreground">—</span>
          }
          if (onInvoiceOpen) {
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onInvoiceOpen(payment.invoiceId, payment)
                }}
                className="inline-flex items-center gap-1 font-mono text-primary text-xs hover:underline"
              >
                {payment.invoiceNumber}
                <ArrowUpRight className="h-3 w-3" />
              </button>
            )
          }
          if (getInvoiceHref) {
            return (
              <a
                href={getInvoiceHref(payment)}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 font-mono text-primary text-xs hover:underline"
              >
                {payment.invoiceNumber}
                <ArrowUpRight className="h-3 w-3" />
              </a>
            )
          }
          return <span className="font-mono text-xs">{payment.invoiceNumber}</span>
        },
      },
    ]

    if (showActionsColumn) {
      cols.push({
        id: "actions",
        header: () => <span className="sr-only">{card.columns.actions}</span>,
        cell: ({ row }) => {
          if (row.original.source !== "payment") {
            return null
          }

          return (
            <div className="flex items-center justify-end gap-1">
              {onViewPayment ? (
                <IconActionButton
                  label={card.actions.view}
                  icon={<Eye className="h-3.5 w-3.5" />}
                  onClick={(e) => {
                    e.stopPropagation()
                    onViewPayment(row.original)
                  }}
                />
              ) : null}
              {onConvertProforma && row.original.invoiceType === "proforma" ? (
                <IconActionButton
                  label={card.actions.convertToInvoice}
                  icon={<ArrowUpRight className="h-3.5 w-3.5" />}
                  onClick={(e) => {
                    e.stopPropagation()
                    void onConvertProforma(row.original)
                  }}
                />
              ) : null}
              {onEditPayment ? (
                <IconActionButton
                  label={card.actions.edit}
                  icon={<Pencil className="h-3.5 w-3.5" />}
                  onClick={(e) => {
                    e.stopPropagation()
                    onEditPayment(row.original)
                  }}
                />
              ) : null}
              {onDeletePayment ? (
                <IconActionButton
                  label={card.actions.delete}
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteTarget(row.original)
                  }}
                />
              ) : null}
            </div>
          )
        },
      })
    }

    return cols
  }, [
    card,
    formatDateTime,
    getInvoiceHref,
    onInvoiceOpen,
    onConvertProforma,
    onDeletePayment,
    onEditPayment,
    onViewPayment,
    showActionsColumn,
  ])

  return (
    <div data-slot="booking-payments-summary" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          {messages.bookingPaymentsSummary.title}
        </h2>
        {headerAction}
      </div>
      <DataTable
        columns={columns}
        data={paymentRows}
        emptyMessage={messages.bookingPaymentsSummary.empty}
        showPagination={false}
      />
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
    </div>
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
