/**
 * `@voyantjs/booking-journey-ui` — the unified booking journey shell.
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
  AccommodationStep,
  AddonsStep,
  BillingStep,
  ConfigureStep,
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
  type BookingJourneyProps,
  JOURNEY_STEP_ORDER,
  type JourneyHeaderState,
  type JourneyStep,
  type JourneySurface,
  type LeadContactPickerProps,
  type PaymentProviderCapabilities,
  type PaymentProviderStepRenderProps,
  type SidePanelState,
  type TravelerContactPickerProps,
} from "./types.js"
