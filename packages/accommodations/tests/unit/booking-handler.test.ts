import type { OwnedHandlerContext } from "@voyant-travel/catalog/booking-engine"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { createAccommodationBookingHandler } from "../../src/booking-engine/index.js"
import { quoteOwnedStay } from "../../src/service-owned-stays.js"

vi.mock("../../src/service-owned-stays.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/service-owned-stays.js")>()
  return {
    ...actual,
    quoteOwnedStay: vi.fn(),
  }
})

const mockQuoteOwnedStay = vi.mocked(quoteOwnedStay)

describe("createAccommodationBookingHandler", () => {
  beforeEach(() => {
    mockQuoteOwnedStay.mockReset()
  })

  it("returns the bridge booking id as the canonical commit booking id", async () => {
    mockQuoteOwnedStay.mockResolvedValue({
      status: "ok",
      available: true,
      propertyId: "prop_1",
      roomTypeId: "room_1",
      ratePlanId: "rate_1",
      mealPlanId: "meal_1",
      roomCount: 1,
      nights: 2,
      currency: "USD",
      nightlyRates: [
        {
          date: "2026-09-01",
          sellCurrency: "USD",
          sellAmountCents: 12000,
          costCurrency: "USD",
          costAmountCents: 9000,
          occupancyBasis: "room",
          includedAdults: 2,
          includedChildren: 0,
          includedInfants: 0,
          quantity: 1,
          totalAmountCents: 12000,
        },
        {
          date: "2026-09-02",
          sellCurrency: "USD",
          sellAmountCents: 12000,
          costCurrency: "USD",
          costAmountCents: 9000,
          occupancyBasis: "room",
          includedAdults: 2,
          includedChildren: 0,
          includedInfants: 0,
          quantity: 1,
          totalAmountCents: 12000,
        },
      ],
      totalAmountCents: 24000,
      availability: {
        requestedRooms: 1,
        minimumRemainingRooms: 4,
        nights: [
          {
            date: "2026-09-01",
            capacity: 4,
            booked: 0,
            remaining: 4,
            closed: false,
          },
          {
            date: "2026-09-02",
            capacity: 4,
            booked: 0,
            remaining: 4,
            closed: false,
          },
        ],
      },
    })

    const handler = createAccommodationBookingHandler({
      loadContent: async () => null,
      commitBridge: async () => ({
        status: "ok",
        bookingId: "stay_booking_123",
        bookingNumber: "STAY-123",
      }),
    })

    const result = await handler.commit({ db: {} } as OwnedHandlerContext, {
      entityModule: "accommodations",
      entityId: "prop_1",
      bookingId: "catalog_shell_123",
      pricing: { currency: "USD", total: "240.00" },
      draft: {
        configure: {
          pax: { adult: 2 },
          dateRange: { checkIn: "2026-09-01", checkOut: "2026-09-03" },
        },
        accommodation: {
          rooms: [{ optionUnitId: "room_1", quantity: 1, ratePlanId: "rate_1" }],
        },
        billing: {
          contact: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
        },
      },
    })

    expect(result).toMatchObject({
      status: "held",
      bookingId: "stay_booking_123",
      orderRef: "STAY-123",
      upstreamPayload: { bridgeBookingId: "stay_booking_123" },
    })
  })
})
