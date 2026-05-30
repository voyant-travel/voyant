import { beforeEach, describe, expect, it, vi } from "vitest"

const bookingMocks = vi.hoisted(() => ({
  createBooking: vi.fn(),
  createTraveler: vi.fn(),
  upsertCruiseDetails: vi.fn(),
  createBookingGroup: vi.fn(),
  addGroupMember: vi.fn(),
  upsertGroupCruiseDetails: vi.fn(),
}))

vi.mock("@voyantjs/bookings", () => ({
  bookingGroupsService: {
    addGroupMember: bookingMocks.addGroupMember,
    createBookingGroup: bookingMocks.createBookingGroup,
  },
  bookingsService: {
    createBooking: bookingMocks.createBooking,
    createTraveler: bookingMocks.createTraveler,
  },
}))

vi.mock("../../src/booking-extension.js", () => ({
  bookingCruiseDetailsService: {
    upsert: bookingMocks.upsertCruiseDetails,
  },
  bookingGroupCruiseDetailsService: {
    upsert: bookingMocks.upsertGroupCruiseDetails,
  },
}))

import type { CruiseAdapter } from "../../src/adapters/index.js"
import { cruisesBookingService } from "../../src/service-bookings.js"

function makeAdapter(overrides: Partial<CruiseAdapter> = {}): CruiseAdapter {
  return {
    name: "test-adapter",
    version: "1.0.0",
    listEntries: vi.fn(async () => ({ entries: [] })),
    searchProjection: vi.fn(async function* () {}),
    fetchCruise: vi.fn(async () => null),
    fetchSailing: vi.fn(async () => null),
    fetchSailingPricing: vi.fn(async () => [
      {
        cabinCategoryRef: { externalId: "cat-A" },
        occupancy: 2,
        passengerComposition: { adults: 2 },
        currency: "USD",
        pricePerPerson: "1000.00",
        availability: "available",
      },
    ]),
    fetchSailingItinerary: vi.fn(async () => []),
    fetchShip: vi.fn(async () => null),
    listSailingsForCruise: vi.fn(async () => []),
    createBooking: vi.fn(async () => ({
      connectorBookingRef: "UPSTREAM-1",
      connectorStatus: "confirmed",
    })),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  bookingMocks.createBooking.mockResolvedValue({
    id: "book_1",
    bookingNumber: "CR-1",
  })
  bookingMocks.createTraveler.mockResolvedValue({})
  bookingMocks.upsertCruiseDetails.mockImplementation(async (_db, _bookingId, data) => data)
})

describe("cruisesBookingService.createExternalCruiseBooking", () => {
  it("rejects passengerComposition that does not match passenger rows before upstream commit", async () => {
    const adapter = makeAdapter()

    await expect(
      cruisesBookingService.createExternalCruiseBooking({} as never, {
        adapter,
        sailingRef: { externalId: "sailing-1" },
        cabinCategoryRef: { externalId: "cat-A" },
        occupancy: 2,
        passengerComposition: { adults: 2 },
        contact: { firstName: "Ann", lastName: "Test" },
        passengers: [{ firstName: "Ann", lastName: "Test", travelerCategory: "adult" }],
      }),
    ).rejects.toThrow(/passengerComposition does not match passengers/)

    expect(adapter.fetchSailingPricing).not.toHaveBeenCalled()
    expect(adapter.createBooking).not.toHaveBeenCalled()
  })

  it("rejects child age arrays that do not match child passenger count", async () => {
    const adapter = makeAdapter()

    await expect(
      cruisesBookingService.createExternalCruiseBooking({} as never, {
        adapter,
        sailingRef: { externalId: "sailing-1" },
        cabinCategoryRef: { externalId: "cat-A" },
        occupancy: 2,
        passengerComposition: { adults: 1, children: 1, childAges: [] },
        contact: { firstName: "Ann", lastName: "Test" },
        passengers: [
          { firstName: "Ann", lastName: "Test", travelerCategory: "adult" },
          { firstName: "Bo", lastName: "Test", travelerCategory: "child" },
        ],
      }),
    ).rejects.toThrow(/childAges length/)

    expect(adapter.fetchSailingPricing).not.toHaveBeenCalled()
    expect(adapter.createBooking).not.toHaveBeenCalled()
  })

  it("snapshots the resolved fare variant when the caller omits fareVariant", async () => {
    const adapter = makeAdapter({
      fetchSailingPricing: vi.fn(async () => [
        {
          cabinCategoryRef: { externalId: "cat-A" },
          occupancy: 2,
          passengerComposition: { adults: 2 },
          fareVariant: "air_inclusive",
          currency: "USD",
          pricePerPerson: "1200.00",
          availability: "available",
        },
      ]),
    })
    const db = {
      transaction: async (run: (tx: unknown) => Promise<unknown>) => run({}),
    }

    await cruisesBookingService.createExternalCruiseBooking(db as never, {
      adapter,
      sailingRef: { externalId: "sailing-1" },
      cabinCategoryRef: { externalId: "cat-A" },
      occupancy: 2,
      passengerComposition: { adults: 2 },
      contact: { firstName: "Ann", lastName: "Test" },
      passengers: [
        { firstName: "Ann", lastName: "Test", travelerCategory: "adult" },
        { firstName: "Bo", lastName: "Test", travelerCategory: "adult" },
      ],
    })

    expect(bookingMocks.upsertCruiseDetails).toHaveBeenCalledWith(
      expect.anything(),
      "book_1",
      expect.objectContaining({
        fareVariant: "air_inclusive",
        quotedTotalForCabin: "2400.00",
      }),
    )
  })
})
