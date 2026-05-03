"use client"

/**
 * Operator-flavored wrapper around `<BookingJourney />` —
 * supplies CRM-backed contact pickers, B2B billing default, and
 * post-commit navigation to /orders/catalog.
 *
 * Per booking-journey-architecture §8.1 + §10 Phase B.
 */

import { useNavigate } from "@tanstack/react-router"
import { BookingJourney, type BookingJourneyProps } from "@voyantjs/booking-journey-ui"

export interface OperatorBookingJourneyProps {
  entityModule: string
  entityId: string
  sourceKind: string
  sourceConnectionId?: string
  sourceRef?: string
  draftId: string
  className?: string
}

export function OperatorBookingJourney({
  entityModule,
  entityId,
  sourceKind,
  sourceConnectionId,
  sourceRef,
  draftId,
  className,
}: OperatorBookingJourneyProps): React.ReactElement {
  const navigate = useNavigate()

  // Operator slot wiring. Phase B keeps the CRM picker as a
  // placeholder — the actual picker is the `PersonPickerSection` in
  // `@voyantjs/bookings-ui`, which is wired in a follow-up.
  const slots: Pick<
    BookingJourneyProps,
    | "renderLeadContactPicker"
    | "renderTravelerContactPicker"
    | "renderPaymentProviderStep"
    | "onCommitted"
    | "onCancelled"
  > = {
    onCommitted(result) {
      navigate({ to: "/orders/catalog", search: { highlight: result.bookingId } as never })
    },
    onCancelled() {
      navigate({ to: "/catalog" })
    },
  }

  return (
    <BookingJourney
      surface="admin"
      entityModule={entityModule}
      entityId={entityId}
      sourceKind={sourceKind}
      sourceConnectionId={sourceConnectionId}
      sourceRef={sourceRef}
      draftId={draftId}
      defaultBuyerType="B2B"
      paymentCapabilities={{
        acceptsCard: true,
        acceptsHold: true,
        acceptsTicketOnCredit: true,
      }}
      className={className}
      {...slots}
    />
  )
}
