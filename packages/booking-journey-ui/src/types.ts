/**
 * Shell-side types for `<BookingJourney />`. These complement the
 * engine contracts in `@voyantjs/catalog/booking-engine/contracts`
 * with React-specific slots and event shapes that don't belong on
 * the wire.
 *
 * Per booking-journey-architecture §8.1.
 */

import type {
  BookingDraftShape,
  BookingDraftV1,
  BookResponseV1,
  PricingBreakdownV1,
} from "@voyantjs/catalog/booking-engine"
import type { ReactNode } from "react"

export type JourneyStep =
  | "configure"
  | "billing"
  | "travelers"
  | "accommodation"
  | "addons"
  | "payment"
  | "review"

export const JOURNEY_STEP_ORDER: ReadonlyArray<JourneyStep> = [
  "configure",
  "billing",
  "travelers",
  "accommodation",
  "addons",
  "payment",
  "review",
]

export interface JourneySurface {
  /** Operator-side or storefront — drives default slot behavior. */
  kind: "admin" | "public"
}

export interface LeadContactPickerProps {
  /** Apply a picked contact to the draft's billing fields. */
  apply: (contact: {
    firstName: string
    lastName: string
    email: string
    phone?: string
    personId?: string
  }) => void
}

export interface TravelerContactPickerProps {
  rowIndex: number
  /** Apply a picked contact to the traveler at `rowIndex`. */
  apply: (contact: {
    firstName: string
    lastName: string
    email?: string
    phone?: string
    personId?: string
  }) => void
}

/** Capabilities supplied by the template — checkout-ui's PaymentStep
 *  consumes these to render the right provider widget. */
export interface PaymentProviderCapabilities {
  acceptsCard: boolean
  acceptsHold: boolean
  acceptsTicketOnCredit: boolean
  /** Free-form provider-specific config (e.g. Netopia merchant id,
   *  Stripe publishable key). */
  config?: Record<string, unknown>
}

export interface PaymentProviderStepRenderProps {
  intent: BookingDraftV1["payment"]["intent"]
  schedule: BookingDraftV1["payment"]["schedule"]
  capabilities: PaymentProviderCapabilities
}

export interface BookingJourneyProps {
  /** What to book. */
  entityModule: string
  entityId: string
  sourceKind: string
  sourceConnectionId?: string
  sourceRef?: string

  /** Surface — drives audience defaults and slot wiring. */
  surface?: "admin" | "public"

  /** Stable draft id — caller persists in URL or session storage so
   *  the journey survives page refresh. */
  draftId: string

  /** Default buyer type — operator: B2B, storefront: B2C. */
  defaultBuyerType?: "B2C" | "B2B"

  /** Initial fallback shape — rendered before the first quote
   *  resolves. The engine returns a more specific shape on the
   *  first quote response. */
  fallbackShape?: BookingDraftShape

  /** Per-payment-provider capabilities — passed through to the
   *  Payment step's provider widget. */
  paymentCapabilities?: PaymentProviderCapabilities

  /** Operator: pulls from CRM. Storefront: bare inline form. */
  renderLeadContactPicker?: (props: LeadContactPickerProps) => ReactNode
  renderTravelerContactPicker?: (props: TravelerContactPickerProps) => ReactNode

  /** Hook for the actual payment-provider widget — checkout-ui's
   *  PaymentStep is the canonical implementation. When omitted, the
   *  shell renders a "Hold only — no card collected" stub. */
  renderPaymentProviderStep?: (props: PaymentProviderStepRenderProps) => ReactNode

  /** Optional pre/post-step extension slots — useful when a
   *  template wants to inject a custom block (e.g. coupon code
   *  banner, marketing opt-in). */
  renderConfigureExtras?: () => ReactNode
  renderBillingExtras?: () => ReactNode
  renderReviewExtras?: () => ReactNode

  /** Fired on successful commit — typically a navigation. */
  onCommitted?: (result: BookResponseV1) => void

  /** Fired when the user explicitly abandons the journey via the
   *  shell's cancel button. */
  onCancelled?: () => void

  /** Optional class names. */
  className?: string
  sidePanelClassName?: string
}

export interface JourneyHeaderState {
  current: JourneyStep
  visited: ReadonlyArray<JourneyStep>
  steps: ReadonlyArray<JourneyStep>
  shape: BookingDraftShape
}

export interface SidePanelState {
  pricing: PricingBreakdownV1 | null
  isQuoting: boolean
  invalidReason?: string
}
