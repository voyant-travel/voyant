import { describe, expect, it } from "vitest"

import {
  canRunBookingEngineAction,
  createBookingEngineSnapshot,
  deriveBookingEngineState,
  type PublicBookingSessionRecord,
} from "../../src/index.js"

function session(overrides: Partial<PublicBookingSessionRecord> = {}): PublicBookingSessionRecord {
  return {
    sessionId: "book_123",
    bookingNumber: "BK-2605-000001",
    status: "on_hold",
    externalBookingRef: null,
    communicationLanguage: null,
    sellCurrency: "EUR",
    sellAmountCents: 10000,
    startDate: null,
    endDate: null,
    pax: 1,
    holdExpiresAt: "2026-06-01T10:00:00.000Z",
    confirmedAt: null,
    expiredAt: null,
    cancelledAt: null,
    completedAt: null,
    travelers: [],
    items: [],
    allocations: [],
    checklist: {
      hasTravelers: false,
      hasPrimaryTraveler: false,
      hasItems: true,
      hasAllocations: true,
      readyForConfirmation: false,
    },
    state: null,
    ...overrides,
  }
}

describe("deriveBookingEngineState", () => {
  it("maps held sessions with no wizard progress to reserved", () => {
    expect(deriveBookingEngineState(session())).toBe("reserved")
  })

  it("maps wizard progress to customer-facing engine states", () => {
    expect(
      deriveBookingEngineState(
        session({
          state: {
            sessionId: "book_123",
            stateKey: "wizard",
            currentStep: "travelers",
            completedSteps: ["billing"],
            payload: {},
            version: 1,
            createdAt: "2026-06-01T09:00:00.000Z",
            updatedAt: "2026-06-01T09:00:00.000Z",
          },
        }),
      ),
    ).toBe("billing_completed")
  })

  it("returns ready_for_payment when terms are accepted and the session is complete", () => {
    expect(
      deriveBookingEngineState(
        session({
          checklist: {
            hasTravelers: true,
            hasPrimaryTraveler: true,
            hasItems: true,
            hasAllocations: true,
            readyForConfirmation: true,
          },
          state: {
            sessionId: "book_123",
            stateKey: "wizard",
            currentStep: "payment",
            completedSteps: ["billing", "travelers", "terms"],
            payload: {},
            version: 1,
            createdAt: "2026-06-01T09:00:00.000Z",
            updatedAt: "2026-06-01T09:00:00.000Z",
          },
        }),
      ),
    ).toBe("ready_for_payment")
  })

  it("maps booking lifecycle statuses to terminal engine states", () => {
    expect(deriveBookingEngineState(session({ status: "awaiting_payment" }))).toBe(
      "payment_pending",
    )
    expect(deriveBookingEngineState(session({ status: "confirmed" }))).toBe("confirmed")
    expect(deriveBookingEngineState(session({ status: "expired" }))).toBe("expired")
  })
})

describe("createBookingEngineSnapshot", () => {
  it("includes allowed actions for the derived state", () => {
    const snapshot = createBookingEngineSnapshot(session())

    expect(snapshot.state).toBe("reserved")
    expect(snapshot.allowedActions).toContain("update_travelers")
    expect(canRunBookingEngineAction(snapshot.state, "start_payment")).toBe(false)
  })
})
