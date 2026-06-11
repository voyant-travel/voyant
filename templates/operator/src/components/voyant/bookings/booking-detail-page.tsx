"use client"

import { useLocale } from "@voyantjs/admin"
import { useBooking } from "@voyantjs/bookings-react"
import { BookingDetailHost } from "@voyantjs/bookings-ui/admin"
import type { BookingDetailTabValue } from "@voyantjs/bookings-ui/components/booking-detail-page"
import type { BookingPaymentsSummaryRow } from "@voyantjs/bookings-ui/components/booking-payments-summary"
import { CollectPaymentDialog } from "@voyantjs/checkout-ui"
import { RecordBookingPaymentDialog } from "@voyantjs/finance-ui"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@voyantjs/ui/components/collapsible"
import { ChevronDown } from "lucide-react"
import { useState } from "react"
import { useAdminMessages } from "@/lib/admin-i18n"
import { getApiUrl } from "@/lib/env"
import { BookingDocumentsTable } from "./booking-documents-table"
import { BookingInvoicesCard } from "./booking-invoices-card"
import { BookingPaymentPolicyCard } from "./booking-payment-policy-card"
import { BookingPendingPaymentSessions } from "./booking-pending-payment-sessions"
import { useBookingActionLedgerEvents } from "./use-booking-action-ledger-events"

/**
 * Operator wrapper around the packaged `BookingDetailHost` from
 * `@voyantjs/bookings-ui/admin`. The host owns the canonical page wiring
 * (breadcrumbs, semantic-destination navigation, paid-amount aggregation,
 * widget slots, invoice sheet); this wrapper only supplies what stays
 * app-local because its data access has no package equivalent yet:
 *
 *   - Pending/complete/cancel payment-session card (admin payment-sessions
 *     API) + the payment-policy override card (schedule regenerate API).
 *   - The unified Documents tab (contract generation API).
 *   - The invoices card (template-level `/v1/uploads` attachment upload).
 *   - Action-ledger timeline events (booking action-ledger API).
 *   - The two payment dialogs (`@voyantjs/finance-ui` /
 *     `@voyantjs/checkout-ui` depend on `bookings-ui`, so the package host
 *     cannot import them without a cycle).
 */
export function BookingDetailPage({
  id,
  activeTab,
  onTabChange,
}: {
  id: string
  activeTab?: BookingDetailTabValue
  onTabChange?: (tab: BookingDetailTabValue) => void
}) {
  const detailMessages = useAdminMessages().bookings.detail
  const { resolvedLocale } = useLocale()
  const [collectPaymentOpen, setCollectPaymentOpen] = useState(false)
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<BookingPaymentsSummaryRow | null>(null)
  const { events: actionLedgerEvents, footer: actionLedgerFooter } =
    useBookingActionLedgerEvents(id)
  // Mirror the booking fetch so the payment dialogs can read sell currency /
  // contact snapshots. TanStack Query dedupes by key, so this doesn't issue
  // a second network request.
  const { data: bookingData } = useBooking(id)
  const booking = bookingData?.data

  return (
    <>
      <BookingDetailHost
        id={id}
        activeTab={activeTab}
        onTabChange={onTabChange}
        onRecordPayment={() => setRecordPaymentOpen(true)}
        onEditPayment={(row) => {
          setEditingPayment(row)
          setRecordPaymentOpen(true)
        }}
        slots={{
          financeStart: ({ fullyPaidReason }) => (
            <BookingPendingPaymentSessions
              bookingId={id}
              onGenerateLink={() => setCollectPaymentOpen(true)}
              generateLinkDisabledReason={fullyPaidReason}
            />
          ),
          financeEnd: ({ booking: b }) => (
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
            content: ({ booking: b, openInvoiceSheet }) => (
              <BookingInvoicesCard
                bookingId={id}
                defaultCurrency={b.sellCurrency}
                defaultAmountCents={b.sellAmountCents ?? null}
                onInvoiceOpen={openInvoiceSheet}
              />
            ),
          },
          documents: () => <BookingDocumentsTable bookingId={id} apiBaseUrl={getApiUrl()} />,
          activityExtraEvents: actionLedgerEvents,
          activityTimelineFooter: actionLedgerFooter,
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
    </>
  )
}
