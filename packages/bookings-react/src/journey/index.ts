/**
 * `@voyant-travel/bookings-react/journey` — the unified booking journey shell.
 *
 * Per `docs/architecture/booking-journey-architecture.md`.
 *
 * Single shell, slot-injected. Operator and storefront consume the
 * same `<BookingJourney />` and inject surface-specific behavior
 * (CRM picker, payment provider widget, B2B vs B2C defaults, post-
 * commit handoff) via render-prop slots.
 */

export { BookingJourney } from "./components/booking-journey.js"
export {
  type ContractAcceptance,
  ContractPreviewDialog,
  type ContractPreviewDialogProps,
} from "./components/contract-preview-dialog.js"
export {
  AccommodationStep,
  AddonsStep,
  BillingStep,
  DepartureStep,
  OptionsStep,
  PaymentStep,
  ReviewStep,
  TravelersStep,
} from "./components/journey-steps.js"
export { PriceSidePanel } from "./components/side-panel.js"
export { StepHeader } from "./components/step-header.js"
export {
  type Draft,
  emptyDraft,
  patchBilling,
  patchConfigure,
  patchPaxCount,
  setAccommodation,
  setAddons,
  setPayment,
  setTravelers,
  totalPax,
} from "./lib/draft-state.js"
export {
  type BillingExtrasContext,
  type BookingEntitySummary,
  type BookingJourneyCheckoutContext,
  type BookingJourneyProps,
  type BookingJourneyTransitionGuard,
  type BookingJourneyTransitionGuardContext,
  type BookingJourneyTransitionGuardResult,
  type ContractAcceptanceEvent,
  type DeparturePickerProps,
  JOURNEY_STEP_ORDER,
  type JourneyHeaderState,
  type JourneyOptionSelection,
  type JourneyStep,
  type JourneySurface,
  type LeadContactPickerProps,
  type PaymentProviderCapabilities,
  type PaymentProviderStepRenderProps,
  type SidePanelState,
  type TravelCreditPickerProps,
  type TravelerContactPickerProps,
  type UnitsPickerProps,
} from "./types.js"
