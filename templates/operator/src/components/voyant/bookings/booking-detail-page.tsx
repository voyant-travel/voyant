"use client"

import { useNavigate } from "@tanstack/react-router"
import { useAdminBreadcrumbs, useLocale } from "@voyantjs/admin"
import { useBooking } from "@voyantjs/bookings-react"
import { BookingDetailPage as CanonicalBookingDetailPage } from "@voyantjs/bookings-ui/components/booking-detail-page"
import type { BookingPaymentsSummaryRow } from "@voyantjs/bookings-ui/components/booking-payments-summary"
import { CollectPaymentDialog } from "@voyantjs/checkout-ui"
import { useInvoices, usePaymentMutation } from "@voyantjs/finance-react"
import { RecordBookingPaymentDialog } from "@voyantjs/finance-ui"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@voyantjs/ui/components/collapsible"
import { Sheet, SheetContent } from "@voyantjs/ui/components/sheet"
import { ChevronDown } from "lucide-react"
import { useState } from "react"
import { AdminWidgetSlotRenderer } from "@/components/admin/admin-widget-slot"
import { useAdminMessages } from "@/lib/admin-i18n"
import { getApiUrl } from "@/lib/env"
import { BookingActionLedgerPanel } from "./booking-action-ledger-panel"
import { BookingDocumentsTable } from "./booking-documents-table"
import { BookingInvoiceSheet } from "./booking-invoice-sheet"
import { BookingInvoicesCard } from "./booking-invoices-card"
import { BookingPaymentPolicyCard } from "./booking-payment-policy-card"
import { BookingPendingPaymentSessions } from "./booking-pending-payment-sessions"

/**
 * Operator wrapper around the canonical `BookingDetailPage`. The
 * shared layout (header, summary, tabs, dialogs) lives in
 * `@voyantjs/bookings-ui`; the operator template only supplies the
 * dependencies it owns:
 *
 *   - Router navigation callbacks (TanStack Router).
 *   - Admin chrome breadcrumbs (`useAdminBreadcrumbs`).
 *   - Two payment dialogs and the buttons that open them.
 *   - Nine operator-local cards that fill named slots (catalog
 *     source, pricing summary, payment sessions / policy, invoices,
 *     documents, action ledger).
 *   - Admin widget extension points (`AdminWidgetSlotRenderer`).
 */
export function BookingDetailPage({ id }: { id: string }) {
  const detailMessages = useAdminMessages().bookings.detail
  const { resolvedLocale } = useLocale()
  const navigate = useNavigate()
  const [collectPaymentOpen, setCollectPaymentOpen] = useState(false)
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<BookingPaymentsSummaryRow | null>(null)
  const [viewingInvoiceId, setViewingInvoiceId] = useState<string | null>(null)
  const { remove: removePayment } = usePaymentMutation()
  // Mirror the booking fetch so the admin chrome can render
  // breadcrumbs and the payment dialogs can read sell currency /
  // contact snapshots without prop-drilling through the canonical.
  // TanStack Query dedupes by key, so this doesn't issue a second
  // network request.
  const { data: bookingData } = useBooking(id)
  const booking = bookingData?.data
  // Sum customer payments across this booking's non-credit-note,
  // non-draft invoices.
  const { data: invoicesData } = useInvoices({ bookingId: id, limit: 20 })
  const paidAmountCents = invoicesData?.data
    ? invoicesData.data
        .filter((inv) => {
          const type = (inv as { invoiceType?: string }).invoiceType ?? "invoice"
          return type !== "credit_note" && inv.status !== "draft"
        })
        .reduce((sum, inv) => sum + (inv.paidCents ?? 0), 0)
    : null
  useAdminBreadcrumbs(
    booking
      ? [
          { label: detailMessages.breadcrumbBookings, href: "/bookings" },
          { label: booking.bookingNumber },
        ]
      : [{ label: detailMessages.breadcrumbBookings, href: "/bookings" }],
  )

  return (
    <>
      <CanonicalBookingDetailPage
        id={id}
        locale={resolvedLocale}
        hideBreadcrumb
        onBack={() => void navigate({ to: "/bookings" })}
        onPersonOpen={(personId) => void navigate({ to: "/people/$id", params: { id: personId } })}
        onOrganizationOpen={(organizationId) =>
          void navigate({ to: "/organizations/$id", params: { id: organizationId } })
        }
        onRecordPayment={() => setRecordPaymentOpen(true)}
        recordPaymentDisabledReason={
          booking &&
          booking.sellAmountCents != null &&
          paidAmountCents != null &&
          paidAmountCents >= booking.sellAmountCents
            ? detailMessages.generateLinkFullyPaid
            : null
        }
        addScheduleDisabledReason={
          booking &&
          booking.sellAmountCents != null &&
          paidAmountCents != null &&
          paidAmountCents >= booking.sellAmountCents
            ? detailMessages.generateLinkFullyPaid
            : null
        }
        paidAmountCents={paidAmountCents}
        onItemResourceOpen={(kind, resourceId) => {
          if (kind === "product") {
            void navigate({ to: "/products/$id", params: { id: resourceId } })
            return
          }
          if (kind === "availabilitySlot") {
            void navigate({ to: "/availability/$id", params: { id: resourceId } })
          }
        }}
        onInvoiceOpen={(invoiceId) => setViewingInvoiceId(invoiceId)}
        onViewPayment={(row) =>
          void navigate({ to: "/finance/payments/$id", params: { id: row.id } })
        }
        onEditPayment={(row) => {
          setEditingPayment(row)
          setRecordPaymentOpen(true)
        }}
        onDeletePayment={async (row) => {
          await removePayment.mutateAsync(row.id)
        }}
        slots={{
          header: (b) => (
            <AdminWidgetSlotRenderer slot="booking.details.header" props={{ booking: b }} />
          ),
          afterSummary: (b) => (
            <AdminWidgetSlotRenderer slot="booking.details.after-summary" props={{ booking: b }} />
          ),
          financeStart: () => (
            <BookingPendingPaymentSessions
              bookingId={id}
              onGenerateLink={() => setCollectPaymentOpen(true)}
              generateLinkDisabledReason={
                booking &&
                booking.sellAmountCents != null &&
                paidAmountCents != null &&
                paidAmountCents >= booking.sellAmountCents
                  ? detailMessages.generateLinkFullyPaid
                  : null
              }
            />
          ),
          financeEnd: (b) => (
            <Collapsible>
              <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-md border bg-background px-4 py-3 text-sm font-semibold hover:bg-muted/30">
                {detailMessages.paymentPolicyCard.title}
                <ChevronDown className="h-4 w-4 transition-transform group-data-panel-open:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <BookingPaymentPolicyCard booking={b} />
              </CollapsibleContent>
            </Collapsible>
          ),
          invoicesTab: {
            content: (b) => (
              <BookingInvoicesCard
                bookingId={id}
                defaultCurrency={b.sellCurrency}
                defaultAmountCents={b.sellAmountCents ?? null}
                onInvoiceOpen={(invoiceId) => setViewingInvoiceId(invoiceId)}
              />
            ),
          },
          ledgerTab: {
            content: <BookingActionLedgerPanel bookingId={id} />,
          },
          documents: () => <BookingDocumentsTable bookingId={id} apiBaseUrl={getApiUrl()} />,
        }}
      />

      {booking ? (
        <>
          <CollectPaymentDialog
            open={collectPaymentOpen}
            onOpenChange={setCollectPaymentOpen}
            bookingId={id}
            defaultCurrency={booking.sellCurrency}
            defaultAmountCents={booking.sellAmountCents ?? null}
            defaultPayerEmail={booking.contactEmail}
            defaultPayerName={[booking.contactFirstName, booking.contactLastName]
              .filter(Boolean)
              .join(" ")}
            defaultPayerLanguage={resolvedLocale}
          />
          <RecordBookingPaymentDialog
            open={recordPaymentOpen}
            onOpenChange={(open) => {
              setRecordPaymentOpen(open)
              if (!open) setEditingPayment(null)
            }}
            bookingId={id}
            defaultCurrency={booking.sellCurrency}
            editingPayment={
              editingPayment
                ? {
                    id: editingPayment.id,
                    invoiceId: editingPayment.invoiceId,
                    amountCents: editingPayment.amountCents,
                    currency: editingPayment.currency,
                    baseCurrency: null,
                    baseAmountCents: null,
                    paymentMethod: editingPayment.paymentMethod,
                    status: editingPayment.status,
                    paymentDate: editingPayment.paymentDate,
                    referenceNumber: editingPayment.referenceNumber,
                    notes: editingPayment.notes,
                  }
                : null
            }
          />
        </>
      ) : null}

      <Sheet
        open={Boolean(viewingInvoiceId)}
        onOpenChange={(open) => {
          if (!open) setViewingInvoiceId(null)
        }}
      >
        <SheetContent side="right" className="w-full! max-w-5xl!">
          {viewingInvoiceId ? (
            <BookingInvoiceSheet
              invoiceId={viewingInvoiceId}
              onOpenInvoice={(id) => {
                setViewingInvoiceId(null)
                void navigate({ to: "/finance/invoices/$id", params: { id } })
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  )
}
