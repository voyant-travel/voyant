"use client"

import { useLocale } from "@voyant-travel/admin"
import { useBooking } from "@voyant-travel/bookings-react"
import type { BookingDetailPaymentControllerSlotContext } from "@voyant-travel/bookings-react/admin"
import type { BookingPaymentsSummaryRow } from "@voyant-travel/bookings-react/components/booking-payments-summary"
import { useEffect, useMemo, useState } from "react"

import { CollectPaymentDialog } from "../checkout-components/collect-payment-dialog.js"
import { RecordBookingPaymentDialog } from "../components/record-booking-payment-dialog.js"

/** Finance-owned controller for the booking detail payment-dialog slot. */
export function BookingPaymentController({
  bookingId,
  onActionsChange,
}: BookingDetailPaymentControllerSlotContext) {
  const { resolvedLocale } = useLocale()
  const [collectPaymentOpen, setCollectPaymentOpen] = useState(false)
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<BookingPaymentsSummaryRow | null>(null)
  const { data: bookingData } = useBooking(bookingId)
  const booking = bookingData?.data

  const actions = useMemo(
    () => ({
      onRecordPayment: () => setRecordPaymentOpen(true),
      onEditPayment: (row: BookingPaymentsSummaryRow) => {
        setEditingPayment(row)
        setRecordPaymentOpen(true)
      },
      onGenerateLink: () => setCollectPaymentOpen(true),
    }),
    [],
  )

  useEffect(() => {
    onActionsChange(actions)
    return () => onActionsChange({})
  }, [actions, onActionsChange])

  if (!booking) return null

  return (
    <>
      <CollectPaymentDialog
        open={collectPaymentOpen}
        onOpenChange={setCollectPaymentOpen}
        bookingId={bookingId}
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
        bookingId={bookingId}
        defaultCurrency={booking.sellCurrency}
        editingPayment={
          editingPayment?.source === "payment"
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
  )
}
