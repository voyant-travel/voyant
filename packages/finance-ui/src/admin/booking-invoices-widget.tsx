"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { useLocale, useOperatorAdminMessages } from "@voyantjs/admin"
import { useBookingPrimaryProduct, useBookingTaxPreview } from "@voyantjs/bookings-react"
import { IconActionButton, StatusBadge } from "@voyantjs/bookings-ui"
import type { BookingDetailHostSlotContext } from "@voyantjs/bookings-ui/admin"
import { useInvoiceMutation, useInvoices, useVoyantFinanceContext } from "@voyantjs/finance-react"
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
} from "@voyantjs/ui/components"
import { DataTable } from "@voyantjs/ui/components/data-table"
import { ArrowRightLeft, ArrowUpRight, FileText, Loader2, Plus } from "lucide-react"
import { useMemo, useState } from "react"

import {
  BookingInvoiceDialog,
  type BookingInvoiceDialogUpload,
} from "../components/booking-invoice-dialog.js"

function clampScheduleInvoiceDueDate(input: { issueDate: string; dueDate: string }) {
  return input.dueDate < input.issueDate ? input.issueDate : input.dueDate
}

interface InvoiceRow {
  id: string
  invoiceNumber: string
  invoiceType: "invoice" | "proforma" | "credit_note"
  status: string
  issueDate: string
  dueDate: string
  currency: string
  totalCents: number
  paidCents: number
  balanceDueCents: number
  /** True when this proforma has already been converted to a final invoice. */
  isConvertedProforma: boolean
}

/**
 * Props of the booking invoices widget: exactly the slot context the
 * bookings detail host hands to `booking.details.invoices-tab` widget
 * contributions (see `bookingDetailInvoicesTabSlot` in
 * `@voyantjs/bookings-ui/admin`).
 */
export type BookingInvoicesWidgetProps = BookingDetailHostSlotContext

/**
 * Finance-owned invoices card for the booking detail page, delivered as a
 * widget contribution on `booking.details.invoices-tab` (packaged-admin RFC
 * §4.7 cycle resolution: this package depends on `@voyantjs/bookings-ui`, so
 * the bookings host cannot import the card — finance contributes it instead).
 *
 * Attachment uploads post to the template-level `/v1/uploads` route through
 * the shared finance provider context (`baseUrl` + credentialed fetcher).
 */
export function BookingInvoicesWidget({
  booking,
  openInvoiceSheet,
}: BookingInvoicesWidgetProps): React.ReactElement {
  const messages = useOperatorAdminMessages().finance
  const { resolvedLocale } = useLocale()
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const bookingId = booking.id
  const defaultCurrency = booking.sellCurrency
  const defaultAmountCents = booking.sellAmountCents ?? null
  const { data, isLoading } = useInvoices({ bookingId, limit: 50 })
  const { convertToInvoice } = useInvoiceMutation()
  const [addOpen, setAddOpen] = useState(false)
  const [convertTarget, setConvertTarget] = useState<InvoiceRow | null>(null)

  const uploadInvoiceAttachment = async (file: File): Promise<BookingInvoiceDialogUpload> => {
    const body = new FormData()
    body.append("file", file)
    const response = await fetcher(`${baseUrl}/v1/uploads`, { method: "POST", body })
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
    }
    const uploaded = (await response.json()) as { key: string; mimeType?: string; size?: number }
    return {
      storageKey: uploaded.key,
      mimeType: uploaded.mimeType ?? file.type,
      fileSize: uploaded.size ?? file.size,
    }
  }

  // Resolve the booking's primary product so the dialog can seed
  // schedule-derived line items with the product's configured tax rate.
  // The dialog only needs the *rate* (a percentage), but `useBookingTaxPreview`
  // requires a non-zero subtotal — passing 10000 (1 unit of currency) yields
  // the same rate as any other positive amount.
  const { productId: primaryProductId } = useBookingPrimaryProduct(bookingId, {
    enabled: addOpen,
  })
  const { data: taxPreview } = useBookingTaxPreview({
    productId: primaryProductId ?? "",
    subtotalCents: 10000,
    currency: defaultCurrency ?? "EUR",
    enabled: addOpen && Boolean(primaryProductId),
  })
  const scheduleTaxRatePercent =
    taxPreview?.data.taxRate?.rateBasisPoints != null
      ? taxPreview.data.taxRate.rateBasisPoints / 100
      : 0

  const invoices = data?.data ?? []
  const convertedProformaIds = useMemo(
    () =>
      new Set(
        invoices
          .map((inv) => (inv as { convertedFromInvoiceId?: string | null }).convertedFromInvoiceId)
          .filter((id): id is string => Boolean(id)),
      ),
    [invoices],
  )

  const typeLabels = useMemo<Record<string, string>>(
    () => ({
      invoice: messages.invoiceTypeInvoice,
      proforma: messages.invoiceTypeProforma,
      credit_note: messages.invoiceTypeCreditNote,
    }),
    [messages],
  )
  const statusLabels = useMemo<Record<string, string>>(
    () => ({
      draft: messages.invoiceStatusDraft,
      issued: messages.invoiceStatusIssued,
      partially_paid: messages.invoiceStatusPartiallyPaid,
      paid: messages.invoiceStatusPaid,
      overdue: messages.invoiceStatusOverdue,
      void: messages.invoiceStatusVoid,
    }),
    [messages],
  )

  const rows = useMemo<InvoiceRow[]>(
    () =>
      invoices
        // A proforma that's already been converted to a final invoice
        // is just history — the final invoice replaces it in the
        // operator's mental model, so hide the proforma row to keep
        // the table focused on what's still actionable. The link from
        // proforma → final invoice is preserved via the invoice sheet.
        .filter((invoice) => !convertedProformaIds.has(invoice.id))
        .map((invoice) => {
          const invoiceType =
            ((invoice as { invoiceType?: string }).invoiceType as InvoiceRow["invoiceType"]) ??
            "invoice"
          return {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            invoiceType,
            status: invoice.status,
            issueDate: invoice.issueDate,
            dueDate: invoice.dueDate,
            currency: invoice.currency,
            totalCents: invoice.totalCents,
            paidCents: invoice.paidCents,
            balanceDueCents: invoice.balanceDueCents,
            isConvertedProforma: convertedProformaIds.has(invoice.id),
          }
        }),
    [invoices, convertedProformaIds],
  )

  const columns = useMemo<ColumnDef<InvoiceRow>[]>(
    () => [
      {
        accessorKey: "issueDate",
        header: messages.issueDateColumn,
        cell: ({ row }) => formatDate(row.original.issueDate, resolvedLocale),
      },
      {
        accessorKey: "invoiceNumber",
        header: messages.invoiceNumberColumn,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              openInvoiceSheet(row.original.id)
            }}
            className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
          >
            {row.original.invoiceNumber}
            <ArrowUpRight className="h-3 w-3" />
          </button>
        ),
      },
      {
        accessorKey: "invoiceType",
        header: messages.invoiceTypeColumn,
        cell: ({ row }) => (
          <Badge variant="outline" className="text-[10px]">
            {typeLabels[row.original.invoiceType] ?? row.original.invoiceType}
          </Badge>
        ),
      },
      {
        accessorKey: "status",
        header: messages.statusColumn,
        cell: ({ row }) => (
          <StatusBadge status={row.original.status}>
            {statusLabels[row.original.status] ?? row.original.status.replace(/_/g, " ")}
          </StatusBadge>
        ),
      },
      {
        accessorKey: "dueDate",
        header: messages.dueDateColumn,
        cell: ({ row }) => formatDate(row.original.dueDate, resolvedLocale),
      },
      {
        accessorKey: "totalCents",
        header: messages.totalColumn,
        cell: ({ row }) => (
          <span className="font-mono font-medium">
            {formatMoney(row.original.totalCents, row.original.currency, resolvedLocale)}
          </span>
        ),
      },
      {
        accessorKey: "paidCents",
        header: messages.paidColumn,
        cell: ({ row }) =>
          row.original.paidCents > 0 ? (
            <span className="font-mono text-emerald-600 dark:text-emerald-300">
              {formatMoney(row.original.paidCents, row.original.currency, resolvedLocale)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "balanceDueCents",
        header: messages.balanceDueColumn,
        cell: ({ row }) =>
          row.original.balanceDueCents > 0 ? (
            <span className="font-mono text-amber-600 dark:text-amber-400">
              {formatMoney(row.original.balanceDueCents, row.original.currency, resolvedLocale)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{messages.statusColumn}</span>,
        cell: ({ row }) => {
          const canConvert =
            row.original.invoiceType === "proforma" &&
            row.original.status !== "void" &&
            !row.original.isConvertedProforma
          return (
            <div className="flex items-center justify-end gap-1">
              <IconActionButton
                label={messages.openInvoice}
                icon={<ArrowUpRight className="h-3.5 w-3.5" />}
                onClick={(e) => {
                  e.stopPropagation()
                  openInvoiceSheet(row.original.id)
                }}
              />
              {canConvert ? (
                <IconActionButton
                  label={messages.convertToInvoice}
                  icon={<ArrowRightLeft className="h-3.5 w-3.5" />}
                  disabled={convertToInvoice.isPending}
                  onClick={(e) => {
                    e.stopPropagation()
                    setConvertTarget(row.original)
                  }}
                />
              ) : null}
            </div>
          )
        },
      },
    ],
    [
      messages,
      resolvedLocale,
      openInvoiceSheet,
      convertToInvoice.isPending,
      statusLabels,
      typeLabels,
    ],
  )

  return (
    <div data-slot="booking-invoices-list" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <FileText className="h-4 w-4 text-muted-foreground" />
          {messages.invoicesPageTitle}
        </h2>
        <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          {messages.newInvoice}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground text-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          emptyMessage={messages.bookingInvoicesEmpty}
          showPagination={false}
        />
      )}

      <BookingInvoiceDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        bookingId={bookingId}
        defaultCurrency={defaultCurrency}
        defaultAmountCents={defaultAmountCents}
        defaultScheduleTaxRatePercent={scheduleTaxRatePercent}
        resolveScheduleDueDate={clampScheduleInvoiceDueDate}
        uploadFile={uploadInvoiceAttachment}
      />

      <AlertDialog
        open={Boolean(convertTarget)}
        onOpenChange={(next) => {
          if (!next && !convertToInvoice.isPending) setConvertTarget(null)
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{messages.convertToInvoice}</AlertDialogTitle>
            <AlertDialogDescription>{messages.convertConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={convertToInvoice.isPending}>
              {messages.detailPage.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={convertToInvoice.isPending}
              onClick={() => {
                if (!convertTarget) return
                convertToInvoice.mutate(
                  { id: convertTarget.id },
                  { onSuccess: () => setConvertTarget(null) },
                )
              }}
            >
              {messages.convertToInvoice}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function formatMoney(cents: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}

function formatDate(iso: string, locale: string): string {
  if (!iso) return "—"
  try {
    const d = new Date(iso)
    if (!Number.isFinite(d.getTime())) return iso
    return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return iso
  }
}
