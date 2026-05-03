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
import {
  type BookingEntitySummary,
  BookingJourney,
  type BookingJourneyProps,
  type ContractAcceptanceEvent,
} from "@voyantjs/booking-journey-ui"

import { getApiUrl } from "@/lib/env"
import { resolveContractVariables } from "./resolve-contract-variables"

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
  /** Pre-locked configure inputs (departure / sailing / cabin /
   *  date-range / pax) collected on the detail page. */
  initialConfigure: Record<string, unknown>
  /** Pre-locked accommodation slice (room/rate for hospitality). */
  initialAccommodation?: Record<string, unknown>
  /** Optional summary of the entity being booked — surfaces in the
   *  side panel so the customer keeps context while filling out the
   *  journey. */
  entitySummary?: BookingEntitySummary
  /**
   * Slug of the contract template the storefront uses for this
   * product. When set, the Review step opens the preview dialog
   * (rendered HTML + terms/marketing checkboxes) and acceptance is
   * forwarded to `onContractAccepted` so the route can call
   * /v1/public/catalog/checkout/start with the captured payload.
   */
  contractTemplateSlug?: string
  /** Optional marketing-opt-in label — when set, an extra checkbox
   *  is rendered in the contract dialog. */
  contractMarketingLabel?: string
  /** Fired after the user accepts the contract. The route handles
   *  the actual checkout-start dispatch + redirect to Netopia /
   *  bank-transfer instructions. */
  onContractAccepted?: (acceptance: ContractAcceptanceEvent) => void | Promise<void>
  className?: string
}

export function StorefrontBookingJourney({
  entityModule,
  entityId,
  sourceKind,
  sourceConnectionId,
  sourceRef,
  draftId,
  initialConfigure,
  initialAccommodation,
  entitySummary,
  contractTemplateSlug,
  contractMarketingLabel,
  onContractAccepted,
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

  // Default checkout-start handler — when the caller doesn't supply
  // its own `onContractAccepted`, we POST the acceptance to the
  // checkout endpoint and route the customer based on the response.
  const defaultCheckoutHandler = async (acceptance: ContractAcceptanceEvent) => {
    // Phase 3 ships a stub response. The real payment-intent →
    // booking-id wiring lands in Phase 4 (card / Netopia) and
    // Phase 5 (bank transfer). Until then we surface the response
    // payload in the console so the storefront integration can be
    // verified end-to-end without the underlying services lighting
    // up.
    try {
      const res = await fetch(`${getApiUrl()}/v1/public/catalog/checkout/start`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          // Phase 4 fills bookingId from a bookEntity call ahead of
          // the checkout-start invocation; for now we send the
          // draftId as a placeholder so the request validates.
          bookingId: draftId,
          paymentIntent: "card",
          contractAcceptance: {
            templateId: acceptance.templateId,
            templateSlug: acceptance.templateSlug,
            acceptedTerms: true,
            acceptedMarketing: acceptance.acceptedMarketing,
            acceptedAt: acceptance.acceptedAt,
            renderedHtml: acceptance.renderedHtml,
          },
        }),
      })
      const json = await res.json()
      console.info("[storefront] checkout/start response", json)
    } catch (err) {
      console.error("[storefront] checkout/start failed", err)
    }
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
      initialConfigure={initialConfigure}
      initialAccommodation={initialAccommodation}
      entitySummary={entitySummary}
      contract={
        contractTemplateSlug
          ? {
              templateSlug: contractTemplateSlug,
              previewUrl: `${getApiUrl()}/v1/public/legal/contracts/templates/by-slug/${encodeURIComponent(
                contractTemplateSlug,
              )}/preview`,
              acceptLanguage: typeof navigator !== "undefined" ? navigator.language : undefined,
              resolveVariables: (draft) =>
                resolveContractVariables(draft, { entityModule, entityId, entitySummary }),
              ...(contractMarketingLabel ? { marketingLabel: contractMarketingLabel } : {}),
            }
          : undefined
      }
      onContractAccepted={onContractAccepted ?? defaultCheckoutHandler}
      paymentCapabilities={{
        // Storefront defaults — covers the three customer-facing
        // payment paths a typical tour operator wants. The deployment
        // can override per-product (e.g. high-ticket cruises that
        // should always go through inquiry first).
        //
        //  - acceptsCard: real-time card via the configured PSP
        //    (renderPaymentProviderStep supplies the widget — when
        //    absent we fall back to a "we'll email a link" message).
        //  - acceptsBankTransfer: lock inventory, send bank details
        //    out of band, reconcile on receipt of funds.
        //  - acceptsInquiry: lead-only path. No inventory hold, no
        //    charge — operator follows up manually. Useful for
        //    custom itineraries / availability-on-request products.
        acceptsCard: true,
        acceptsBankTransfer: true,
        acceptsHold: false,
        acceptsTicketOnCredit: false,
        acceptsInquiry: true,
      }}
      className={className}
      {...slots}
    />
  )
}
