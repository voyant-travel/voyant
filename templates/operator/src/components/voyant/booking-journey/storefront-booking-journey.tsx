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
  /**
   * Source provenance — optional on the storefront. When absent,
   * the public engine route resolves it from
   * `(entityModule, entityId)` via the catalog plane's
   * sourced-entry lookup. Operator surfaces still pass it
   * explicitly via `<OperatorBookingJourney />`.
   */
  sourceKind?: string
  sourceConnectionId?: string
  sourceRef?: string
  draftId: string
  /**
   * Departure picked on the detail page. Required on the storefront
   * — the journey doesn't render Configure, so without this the
   * commit path has no slot to bind to.
   */
  departureSlotId: string
  paxCounts: { adult: number; child: number; infant: number }
  className?: string
}

export function StorefrontBookingJourney({
  entityModule,
  entityId,
  sourceKind,
  sourceConnectionId,
  sourceRef,
  draftId,
  departureSlotId,
  paxCounts,
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
      hideConfigure
      initialConfigure={{
        departureSlotId,
        pax: {
          adult: paxCounts.adult,
          child: paxCounts.child,
          infant: paxCounts.infant,
        },
      }}
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
