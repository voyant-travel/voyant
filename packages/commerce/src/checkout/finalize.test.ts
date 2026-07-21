import { beforeEach, describe, expect, it, vi } from "vitest"

import { finalizeCheckout } from "./finalize.js"

const mocks = vi.hoisted(() => ({ runCheckoutFinalize: vi.fn() }))

vi.mock("@voyant-travel/bookings", () => ({ bookingsService: {} }))
vi.mock("@voyant-travel/bookings/schema", () => ({ bookings: {} }))
vi.mock("@voyant-travel/catalog/booking-engine", () => ({
  runCheckoutFinalize: mocks.runCheckoutFinalize,
}))
vi.mock("@voyant-travel/finance", () => ({
  convertProformaToInvoice: vi.fn(),
  issueInvoiceFromBooking: vi.fn(),
  settleCoveredBookingPaymentSchedules: vi.fn(),
}))

describe("finalizeCheckout", () => {
  beforeEach(() => vi.clearAllMocks())

  it("runs the checkout saga directly without a generic run record", async () => {
    const db = {} as never
    const eventBus = {} as never
    const input = { bookingId: "booking_1", paymentSessionId: "session_1" }

    await finalizeCheckout({ db, eventBus, input })

    expect(mocks.runCheckoutFinalize).toHaveBeenCalledWith(
      input,
      expect.objectContaining({ db, eventBus }),
    )
  })
})
