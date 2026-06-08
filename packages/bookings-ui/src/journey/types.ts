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
 * Props for the injectable departure picker rendered in the Configure
 * step for a `"departure"` sub-step. The template wires this with a
 * scheduled-departures source (e.g. operator availability) so the
 * operator picks a real departure rather than typing a free date.
 *
 * The picker owns its own data-loading and should fall back to a free
 * date when the product has no scheduled departures — the journey just
 * stores whatever it reports via `onChange`.
 */
export interface DeparturePickerProps {
  /** The owned product whose departures to load. */
  productId: string
  /** Selected product option, used to filter departures (null = any). */
  optionId: string | null
  /** Currently-picked scheduled departure id, or null. */
  slotId: string | null
  /** Currently-entered departure date (free-date fallback), or null. */
  departureDate: string | null
  /** Currently-entered departure time (free-date fallback), or null. */
  departureTime: string | null
  /** Report a change — any omitted field is left unchanged on the draft. */
  onChange: (next: {
    slotId?: string | null
    departureDate?: string | null
    departureTime?: string | null
  }) => void
}

/** A picked inventory unit (room) selection on the draft's configure. */
export interface JourneyOptionSelection {
  optionId: string
  optionName?: string
  optionUnitId?: string
  optionUnitName?: string
  quantity: number
}

/**
 * Props for the injectable units (rooms) picker rendered in the Configure
 * step for an `"option-units"` sub-step. The template wires it to an
 * inventory source (operator availability) so the operator picks room
 * quantities for the chosen option + departure; the journey stores the
 * result on `configure.optionSelections`.
 */
export interface UnitsPickerProps {
  /** The owned product whose units to load. */
  productId: string
  /** Currently-selected product option (drives which units show), or null. */
  optionId: string | null
  /** Currently-picked departure slot (drives per-slot availability), or null. */
  slotId: string | null
  /** Current unit selections on the draft. */
  selections: ReadonlyArray<JourneyOptionSelection>
  /** Report the new full set of unit selections. */
  onChange: (selections: JourneyOptionSelection[]) => void
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

export type BookingJourneyTransitionGuardResult =
  | undefined
  | boolean
  | { allow: boolean; message?: string; draft?: BookingDraftV1 }

export interface BookingJourneyTransitionGuardContext {
  currentStep: JourneyStep
  nextStep: JourneyStep
  draft: BookingDraftV1
  pricing: PricingBreakdownV1 | null
  quoteId?: string
  surface: "admin" | "public"
}

export type BookingJourneyTransitionGuard = (
  context: BookingJourneyTransitionGuardContext,
) => BookingJourneyTransitionGuardResult | Promise<BookingJourneyTransitionGuardResult>

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

  /**
   * Renders the Configure step's `"departure"` sub-step. Operator
   * surfaces wire this to a scheduled-departure picker (availability);
   * when omitted, the journey renders a free date/time fallback.
   */
  renderDeparturePicker?: (props: DeparturePickerProps) => ReactNode

  /**
   * Renders the Configure step's `"option-units"` sub-step (room/unit
   * quantity selection). Operator surfaces wire this to an inventory
   * units picker; when omitted, the sub-step renders nothing.
   */
  renderUnitsPicker?: (props: UnitsPickerProps) => ReactNode

  /** Hook for the actual payment-provider widget — checkout-ui's
   *  PaymentStep is the canonical implementation. When omitted, the
   *  shell renders a "Hold only — no card collected" stub. */
  renderPaymentProviderStep?: (props: PaymentProviderStepRenderProps) => ReactNode

  /**
   * Runs before a forward step transition. Return `false` or
   * `{ allow: false, message }` to keep the current step active and
   * surface an inline navigation error; return `{ allow: true,
   * draft }` to continue with an updated draft snapshot.
   */
  onBeforeStepAdvance?: BookingJourneyTransitionGuard

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
   * fields (cruises have ports, accommodations have check-in/out, etc.).
   */
  entitySummary?: BookingEntitySummary

  /**
   * Contract preview integration. When `templateSlug` is set, the
   * Review step's "Continue to checkout" button opens the contract
   * preview dialog with the rendered template instead of committing
   * directly. The journey then surfaces the acceptance back to the
   * caller via `onContractAccepted` so the storefront can call its
   * own `/checkout/start` endpoint.
   *
   * - `previewUrl` — absolute URL of the public render endpoint.
   * - `resolveVariables` — maps the draft to the template's variable
   *   schema. The storefront supplies a default mapper that covers
   *   traveler / billing / room / dates.
   * - `marketingLabel` — when set, an additional opt-in checkbox is
   *   rendered in the dialog. Marketing consent is optional and is
   *   passed through `onContractAccepted` so the caller can decide
   *   what to do with it.
   */
  contract?: {
    templateSlug: string
    previewUrl: string
    acceptLanguage?: string
    resolveVariables: (input: {
      draft: BookingDraftV1
      pricing: PricingBreakdownV1 | null
    }) => Record<string, unknown> // i18n-literal-ok Type signature return shape, not user-visible copy.
    marketingLabel?: ReactNode
    termsLabel?: ReactNode
  }
  /**
   * Fired when the user accepts the contract in the preview dialog.
   * The caller persists the acceptance + dispatches the checkout
   * workflow. Receives the rendered HTML so it can be stored
   * verbatim for the audit trail.
   */
  /**
   * Called when the user clicks Confirm on the Review step. Receives
   * the rendered contract acceptance when the contract dialog was
   * shown; receives `null` when the journey skipped the dialog
   * (no template configured — the storefront still wants to drive
   * the post-confirm /checkout/start flow).
   */
  onContractAccepted?: (
    acceptance: ContractAcceptanceEvent | null,
    context: BookingJourneyCheckoutContext,
  ) => void | Promise<void>
}

export interface BookingJourneyCheckoutContext {
  draft: BookingDraftV1
  pricing: PricingBreakdownV1 | null
  quoteId?: string
}

export interface ContractAcceptanceEvent {
  templateId: string
  templateSlug: string
  templateName: string
  acceptedTerms: true
  acceptedMarketing: boolean
  acceptedAt: string
  renderedHtml: string
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
  vertical?: "products" | "cruises" | "accommodations" | string
  /** Optional ISO date or formatted date — e.g. "Tue, May 5, 2026". */
  whenLabel?: string
  /** Optional location label — e.g. "Reykjavík", "Mediterranean", "Bucharest". */
  locationLabel?: string
  /** ISO start date (YYYY-MM-DD or full ISO) — used by the contract
   *  preview when the draft only carries a slot id. */
  startDate?: string
  /** ISO end date — paired with `startDate` for ranges and contract
   *  variables like `departure.end_date`. */
  endDate?: string
  /** Free-form destination / route string — surfaced as
   *  `product.destination` in contract variables. */
  destination?: string
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
