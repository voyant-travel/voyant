import type { PublicBookingSessionRecord } from "./schemas.js"

export const bookingEngineStates = [
  "draft",
  "reserved",
  "billing_completed",
  "travelers_completed",
  "terms_accepted",
  "ready_for_payment",
  "payment_started",
  "payment_pending",
  "confirmed",
  "completed",
  "expired",
  "cancelled",
] as const

export type BookingEngineState = (typeof bookingEngineStates)[number]

export const bookingEngineActions = [
  "create_session",
  "reserve",
  "update_billing",
  "update_travelers",
  "reprice",
  "accept_terms",
  "start_payment",
  "poll_payment",
  "confirm",
  "expire",
  "clear_session",
] as const

export type BookingEngineAction = (typeof bookingEngineActions)[number]

export interface BookingEngineSnapshot {
  sessionId: string
  bookingNumber: string
  state: BookingEngineState
  bookingStatus: PublicBookingSessionRecord["status"]
  currentStep: string | null
  completedSteps: string[]
  holdExpiresAt: string | null
  readyForConfirmation: boolean
  allowedActions: BookingEngineAction[]
}

const completedStateByStep = [
  ["payment", "payment_started"],
  ["terms", "terms_accepted"],
  ["contract", "terms_accepted"],
  ["travelers", "travelers_completed"],
  ["passengers", "travelers_completed"],
  ["billing", "billing_completed"],
] as const satisfies ReadonlyArray<readonly [string, BookingEngineState]>

export function deriveBookingEngineState(session: PublicBookingSessionRecord): BookingEngineState {
  switch (session.status) {
    case "cancelled":
      return "cancelled"
    case "completed":
      return "completed"
    case "expired":
      return "expired"
    case "confirmed":
    case "in_progress":
      return "confirmed"
    case "awaiting_payment":
      return "payment_pending"
    case "on_hold":
      break
    case "draft":
      return "draft"
  }

  const completedSteps = new Set<string>(session.state?.completedSteps ?? [])
  if (session.checklist.readyForConfirmation && completedSteps.has("payment")) {
    return "payment_started"
  }

  if (session.checklist.readyForConfirmation && hasTermsAccepted(completedSteps)) {
    return "ready_for_payment"
  }

  for (const [step, state] of completedStateByStep) {
    if (completedSteps.has(step)) {
      return state
    }
  }

  return "reserved"
}

export function getAllowedBookingEngineActions(state: BookingEngineState): BookingEngineAction[] {
  switch (state) {
    case "draft":
      return ["create_session", "reserve", "clear_session"]
    case "reserved":
    case "billing_completed":
    case "travelers_completed":
      return [
        "update_billing",
        "update_travelers",
        "reprice",
        "accept_terms",
        "expire",
        "clear_session",
      ]
    case "terms_accepted":
    case "ready_for_payment":
      return [
        "update_billing",
        "update_travelers",
        "reprice",
        "start_payment",
        "confirm",
        "expire",
        "clear_session",
      ]
    case "payment_started":
    case "payment_pending":
      return ["poll_payment", "confirm", "clear_session"]
    case "confirmed":
    case "completed":
      return ["clear_session"]
    case "expired":
    case "cancelled":
      return ["clear_session"]
  }
}

export function canRunBookingEngineAction(
  state: BookingEngineState,
  action: BookingEngineAction,
): boolean {
  return getAllowedBookingEngineActions(state).includes(action)
}

export function createBookingEngineSnapshot(
  session: PublicBookingSessionRecord,
): BookingEngineSnapshot {
  const state = deriveBookingEngineState(session)
  return {
    sessionId: session.sessionId,
    bookingNumber: session.bookingNumber,
    state,
    bookingStatus: session.status,
    currentStep: session.state?.currentStep ?? null,
    completedSteps: session.state?.completedSteps ?? [],
    holdExpiresAt: session.holdExpiresAt,
    readyForConfirmation: session.checklist.readyForConfirmation,
    allowedActions: getAllowedBookingEngineActions(state),
  }
}

function hasTermsAccepted(completedSteps: Set<string>) {
  return completedSteps.has("terms") || completedSteps.has("contract")
}
