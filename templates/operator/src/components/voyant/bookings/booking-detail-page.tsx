"use client"

import { useLocale } from "@voyantjs/admin"
import { useBooking } from "@voyantjs/bookings-react"
import { BookingDetailHost } from "@voyantjs/bookings-react/admin/booking-detail-host"
import type { BookingDetailTabValue } from "@voyantjs/bookings-react/components/booking-detail-page"
import type { BookingPaymentsSummaryRow } from "@voyantjs/bookings-react/components/booking-payments-summary"
import { CollectPaymentDialog } from "@voyantjs/checkout-react/ui"
import { RecordBookingPaymentDialog } from "@voyantjs/finance-react/ui"
import { useState } from "react"

/**
 * Operator wrapper around the packaged `BookingDetailHost` from
 * `@voyantjs/bookings-react/admin`. The host owns the canonical page wiring
 * (breadcrumbs, semantic-destination navigation, paid-amount aggregation,
 * the Documents tab, the action-ledger timeline merge, widget slots,
 * invoice sheet); the finance-tab cards (pending payment links, payment
 * policy) and the Invoices tab arrive as widget contributions from
 * `@voyantjs/finance-react/admin`. This wrapper only supplies the two payment
 * dialogs — `@voyantjs/finance-react/ui` / `@voyantjs/checkout-react/ui` depend on
 * `bookings-ui`, so the package host cannot import them without a cycle.
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
  const { resolvedLocale } = useLocale()
  const [collectPaymentOpen, setCollectPaymentOpen] = useState(false)
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<BookingPaymentsSummaryRow | null>(null)
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
        onGenerateLink={() => setCollectPaymentOpen(true)}
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
