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
  /** Apply a picked contact to the draft's billing fields. Email is
   *  optional because CRM-backed people may not have one stored —
   *  the billing form will surface it as empty for the operator to
   *  fill in. */
  apply: (contact: {
    firstName: string
    lastName: string
    email?: string
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

/**
 * Capabilities supplied by the template — checkout-ui's PaymentStep
 * consumes these to render the right provider widget. Each flag is
 * an independent on/off switch the operator configures per
 * deployment / supplier:
 *
 * - `acceptsCard` — Stripe / Netopia / generic card flow. The
 *   `renderPaymentProviderStep` slot supplies the actual widget.
 * - `acceptsBankTransfer` — operator emails the buyer bank details;
 *   booking is created with status "awaiting_payment". Inventory
 *   hold is still placed so capacity is reserved.
 * - `acceptsHold` — staff/agent-only soft-hold path; useful when an
 *   operator is brokering for an end customer.
 * - `acceptsTicketOnCredit` — agency credit account.
 * - `acceptsInquiry` — lead-only flow: NO inventory hold, NO charge.
 *   The "booking" is recorded as an inquiry for the operator to
 *   manually follow up on. Right for tour operators where a quote
 *   conversation precedes booking.
 */
export interface PaymentProviderCapabilities {
  acceptsCard: boolean
  acceptsHold: boolean
  acceptsBankTransfer?: boolean
  acceptsTicketOnCredit: boolean
  acceptsInquiry?: boolean
  /** Free-form provider-specific config (e.g. Netopia merchant id,
   *  Stripe publishable key, bank-transfer instructions). */
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
  /**
   * Source pointer fields. Optional on the public surface — the
   * engine resolves provenance server-side from
   * `(entityModule, entityId)` via the catalog plane's
   * sourced-entry lookup. Operator surfaces should still pass
   * `sourceKind` explicitly when known.
   */
  sourceKind?: string
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

  /**
   * Pre-locked configure state. When set, the journey skips the
   * Configure step entirely — Configure already happened on the
   * product detail page. Mirrors the BookingDraft's `configure`
   * shape (loosely typed so storefront callers can pass a
   * vertical-specific subset without fighting the contract).
   */
  initialConfigure?: Record<string, unknown>
  /** Pre-locked accommodation slice (room/rate picks made on the
   *  detail page). Loosely typed for the same reason. */
  initialAccommodation?: Record<string, unknown>
  /**
   * When true, the wizard hides Configure regardless of descriptor
   * flags. Use for storefront flows where the product detail page
   * already collected those choices.
   */
  hideConfigure?: boolean

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

  /**
   * Optional summary of the entity being booked — surfaces in the
   * side panel so the customer keeps context while filling out the
   * journey. Shape is loose because each vertical carries different
   * fields (cruises have ports, hospitality has check-in/out, etc.).
   */
  entitySummary?: BookingEntitySummary
}

/**
 * Caller-provided context for the side-panel summary. Keep it
 * vertical-agnostic — the panel renders whatever subset is present.
 */
export interface BookingEntitySummary {
  /** Headline name — e.g. product / cruise / hotel name. */
  name: string
  /** Optional second line — e.g. "Iceland · 1 day", "7 nights · Mediterranean". */
  subtitle?: string
  /** Optional hero image — small thumbnail at the top of the panel. */
  heroImageUrl?: string
  /** Vertical badge — drives the "What you're booking" header copy. */
  vertical?: "products" | "cruises" | "hospitality" | string
  /** Optional ISO date or formatted date — e.g. "Tue, May 5, 2026". */
  whenLabel?: string
  /** Optional location label — e.g. "Reykjavík", "Mediterranean", "Bucharest". */
  locationLabel?: string
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
  entitySummary?: BookingEntitySummary
  currentStep?: JourneyStep
  steps?: ReadonlyArray<JourneyStep>
  shape?: BookingDraftShape
  draft?: BookingDraftV1
}
