"use client"

/**
 * Storefront-flavored wrapper around `<BookingJourney />` —
 * customer-facing, no CRM picker, B2C billing default, post-commit
 * navigation to a confirmation page.
 *
 * Uses `surface="public"` so the engine hits `/v1/public/catalog/*`.
 * Per booking-journey-architecture §8.1 + §10 Phase B.
 *
 * Lives in the operator template's `(storefront)` route group as a
 * "simulated storefront" — validates the dual-surface design without
 * spinning up a separate template. A real storefront template would
 * lift this component (and the route group) verbatim.
 */

import { useNavigate } from "@tanstack/react-router"
import { BookingJourney, type BookingJourneyProps } from "@voyantjs/booking-journey-ui"

export interface StorefrontBookingJourneyProps {
  entityModule: string
  entityId: string
  sourceKind: string
  sourceConnectionId?: string
  sourceRef?: string
  draftId: string
  className?: string
}

export function StorefrontBookingJourney({
  entityModule,
  entityId,
  sourceKind,
  sourceConnectionId,
  sourceRef,
  draftId,
  className,
}: StorefrontBookingJourneyProps): React.ReactElement {
  const navigate = useNavigate()

  // Storefront-specific slot wiring. NO CRM picker — customers fill
  // an inline contact form, which is the BookingJourney's default
  // when `renderLeadContactPicker` is absent. Operators who later
  // sign in could swap to the CRM picker mid-journey via an
  // upgrade-path hook (Phase E follow-up).
  const slots: Pick<BookingJourneyProps, "onCommitted" | "onCancelled"> = {
    onCommitted(result) {
      navigate({
        to: "/shop/confirmation/$bookingId",
        params: { bookingId: result.bookingId },
      })
    },
    onCancelled() {
      navigate({ to: "/shop" })
    },
  }

  return (
    <BookingJourney
      surface="public"
      entityModule={entityModule}
      entityId={entityId}
      sourceKind={sourceKind}
      sourceConnectionId={sourceConnectionId}
      sourceRef={sourceRef}
      draftId={draftId}
      defaultBuyerType="B2C"
      paymentCapabilities={{
        // Storefront accepts card; hold-only and ticket-on-credit are
        // operator surface concerns that don't make sense for a
        // self-serve customer flow.
        acceptsCard: true,
        acceptsHold: false,
        acceptsTicketOnCredit: false,
      }}
      className={className}
      {...slots}
    />
  )
}
