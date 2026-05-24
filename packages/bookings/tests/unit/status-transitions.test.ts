import { describe, expect, it } from "vitest"

import {
  BOOKING_TRANSITIONS,
  type BookingStatus,
  BookingTransitionError,
  canTransitionBooking,
  transitionBooking,
} from "../../src/state-machine.js"

const ALL_STATUSES = Object.keys(BOOKING_TRANSITIONS) as BookingStatus[]

function generateBookingNumber(prefix: string, sequence: number): string {
  const padded = String(sequence).padStart(6, "0")
  return `${prefix}-${padded}`
}

describe("BOOKING_TRANSITIONS — full matrix", () => {
  for (const from of ALL_STATUSES) {
    for (const to of ALL_STATUSES) {
      const expected = (BOOKING_TRANSITIONS[from] as readonly BookingStatus[]).includes(to)
      it(`${from} → ${to} is ${expected ? "allowed" : "rejected"}`, () => {
        expect(canTransitionBooking(from, to)).toBe(expected)
      })
    }
  }
})

describe("BOOKING_TRANSITIONS — domain rules", () => {
  it("allows the manual confirmed-booking flow (draft → confirmed without on_hold)", () => {
    expect(canTransitionBooking("draft", "confirmed")).toBe(true)
  })

  it("requires confirmed before in_progress (no draft → in_progress)", () => {
    expect(canTransitionBooking("draft", "in_progress")).toBe(false)
    expect(canTransitionBooking("on_hold", "in_progress")).toBe(false)
  })

  it("requires in_progress before completed", () => {
    expect(canTransitionBooking("draft", "completed")).toBe(false)
    expect(canTransitionBooking("on_hold", "completed")).toBe(false)
    expect(canTransitionBooking("confirmed", "completed")).toBe(false)
  })

  it("treats completed, cancelled, expired as terminal", () => {
    for (const terminal of ["completed", "cancelled", "expired"] as const) {
      for (const target of ALL_STATUSES) {
        expect(canTransitionBooking(terminal, target)).toBe(false)
      }
    }
  })
})

describe("transitionBooking()", () => {
  it("returns a patch with the new status", () => {
    const patch = transitionBooking("on_hold", "confirmed")
    expect(patch.status).toBe("confirmed")
  })

  it("stamps confirmedAt when transitioning to confirmed", () => {
    const now = new Date("2026-01-01T00:00:00Z")
    const patch = transitionBooking("on_hold", "confirmed", { now })
    expect(patch.confirmedAt).toEqual(now)
    expect(patch.cancelledAt).toBeUndefined()
    expect(patch.expiredAt).toBeUndefined()
    expect(patch.completedAt).toBeUndefined()
  })

  it("stamps cancelledAt when transitioning to cancelled", () => {
    const now = new Date("2026-01-01T00:00:00Z")
    const patch = transitionBooking("confirmed", "cancelled", { now })
    expect(patch.cancelledAt).toEqual(now)
    expect(patch.confirmedAt).toBeNull()
  })

  it("stamps expiredAt when transitioning to expired", () => {
    const now = new Date("2026-01-01T00:00:00Z")
    const patch = transitionBooking("on_hold", "expired", { now })
    expect(patch.expiredAt).toEqual(now)
    expect(patch.confirmedAt).toBeNull()
  })

  it("stamps completedAt when transitioning to completed", () => {
    const now = new Date("2026-01-01T00:00:00Z")
    const patch = transitionBooking("in_progress", "completed", { now })
    expect(patch.completedAt).toEqual(now)
  })

  it("does not stamp a timestamp when moving to in_progress (no dedicated column)", () => {
    const patch = transitionBooking("confirmed", "in_progress")
    expect(patch.confirmedAt).toBeNull()
    expect(patch.cancelledAt).toBeUndefined()
    expect(patch.expiredAt).toBeUndefined()
    expect(patch.completedAt).toBeUndefined()
  })

  it("uses Date.now() when opts.now is omitted", () => {
    const before = Date.now()
    const patch = transitionBooking("on_hold", "confirmed")
    const after = Date.now()
    expect(patch.confirmedAt).toBeInstanceOf(Date)
    const stampedAt = patch.confirmedAt?.getTime() ?? 0
    expect(stampedAt).toBeGreaterThanOrEqual(before)
    expect(stampedAt).toBeLessThanOrEqual(after)
  })

  it("throws BookingTransitionError for illegal moves", () => {
    expect(() => transitionBooking("completed", "draft")).toThrow(BookingTransitionError)
    expect(() => transitionBooking("draft", "completed")).toThrow(BookingTransitionError)
  })

  it("BookingTransitionError exposes from/to + a stable code", () => {
    try {
      transitionBooking("completed", "draft")
      expect.unreachable("should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(BookingTransitionError)
      const e = err as BookingTransitionError
      expect(e.from).toBe("completed")
      expect(e.to).toBe("draft")
      expect(e.code).toBe("INVALID_BOOKING_TRANSITION")
      expect(e.message).toMatch(/completed.*draft/)
    }
  })
})

describe("Booking number generation", () => {
  it("generates padded number with prefix", () => {
    expect(generateBookingNumber("BK", 1)).toBe("BK-000001")
  })

  it("pads to 6 digits", () => {
    expect(generateBookingNumber("BK", 42)).toBe("BK-000042")
  })

  it("handles large numbers", () => {
    expect(generateBookingNumber("BK", 999999)).toBe("BK-999999")
  })

  it("allows custom prefix", () => {
    expect(generateBookingNumber("DMC", 123)).toBe("DMC-000123")
  })
})
