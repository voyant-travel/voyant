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
  // its own `onContractAccepted`, we run the protravel-style flow:
  //
  //   1. POST /v1/public/catalog/book with the draft id → bookingId
  //   2. POST /v1/public/catalog/checkout/start with the bookingId,
  //      the payment intent, and the captured acceptance.
  //   3. Route the customer based on the response: card → 302 to
  //      Netopia; bank_transfer → instructions page; inquiry →
  //      thanks page.
  //
  // We pull the chosen payment intent + buyer details out of the
  // BookingJourney's draft via a lookup hook on the Window object.
  // The dialog itself only knows about acceptance, so we hand the
  // intent through `data-bj-intent` on the dialog's root via the
  // BookingJourney's onContractAccepted event payload + a getter
  // the wrapper installs once.
  const defaultCheckoutHandler = async (acceptance: ContractAcceptanceEvent) => {
    try {
      // Step 1 — book the entity. The /book endpoint resolves the
      // current quote off the draft and creates a booking row.
      const bookRes = await fetch(`${getApiUrl()}/v1/public/catalog/book`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          draftId,
          paymentIntent: { type: "hold" },
          idempotencyKey: `bj-${draftId}-${acceptance.acceptedAt}`,
        }),
      })
      if (!bookRes.ok) {
        const errBody = await bookRes.json().catch(() => ({ error: "book_failed" }))
        console.error("[storefront] /book failed", errBody)
        return
      }
      const bookJson = (await bookRes.json()) as { bookingId?: string }
      const bookingId = bookJson.bookingId
      if (!bookingId) {
        console.error("[storefront] /book returned no bookingId", bookJson)
        return
      }

      // Step 2 — start checkout. We default to `card`; deployments
      // that surface bank-transfer / inquiry buttons in the journey
      // can pass an explicit paymentIntent via a custom slot.
      const intent = new URLSearchParams(window.location.search).get("paymentIntent") ?? "card"
      const startRes = await fetch(`${getApiUrl()}/v1/public/catalog/checkout/start`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bookingId,
          paymentIntent: intent,
          contractAcceptance: {
            templateId: acceptance.templateId,
            templateSlug: acceptance.templateSlug,
            acceptedTerms: true,
            acceptedMarketing: acceptance.acceptedMarketing,
            acceptedAt: acceptance.acceptedAt,
            renderedHtml: acceptance.renderedHtml,
          },
          returnOrigin: window.location.origin,
        }),
      })
      type CheckoutStartResponse =
        | { kind: "card_redirect"; bookingId: string; redirectUrl: string | null }
        | {
            kind: "bank_transfer_instructions"
            bookingId: string
            proformaNumber: string | null
            instructions: {
              beneficiary: string
              iban: string
              bankName: string
              reference: string
              amountCents: number
              currency: string
              dueAt: string
            }
          }
        | { kind: "inquiry_received"; bookingId: string; inquiryId: string }
        | { kind: "hold_placed"; bookingId: string }
        | { error: string }

      const json = (await startRes.json()) as CheckoutStartResponse

      if ("error" in json) {
        console.error("[storefront] /checkout/start error", json)
        return
      }

      switch (json.kind) {
        case "card_redirect":
          if (json.redirectUrl) {
            window.location.assign(json.redirectUrl)
          } else {
            navigate({
              to: "/shop/confirmation/$bookingId",
              params: { bookingId: json.bookingId },
              search: { kind: "card_pending" } as never,
            })
          }
          break
        case "bank_transfer_instructions":
          // Hand the instructions to the confirmation page so the
          // customer leaves with the IBAN + reference visible. Stored
          // in sessionStorage to keep the URL clean — refreshing the
          // page replays the same instructions.
          if (typeof sessionStorage !== "undefined") {
            sessionStorage.setItem(`voyant.checkout.${json.bookingId}`, JSON.stringify(json))
          }
          navigate({
            to: "/shop/confirmation/$bookingId",
            params: { bookingId: json.bookingId },
            search: { kind: "bank_transfer" } as never,
          })
          break
        case "inquiry_received":
          navigate({
            to: "/shop/confirmation/$bookingId",
            params: { bookingId: json.bookingId },
            search: { kind: "inquiry" } as never,
          })
          break
        case "hold_placed":
          navigate({
            to: "/shop/confirmation/$bookingId",
            params: { bookingId: json.bookingId },
            search: { kind: "hold" } as never,
          })
          break
      }
    } catch (err) {
      console.error("[storefront] checkout flow failed", err)
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
