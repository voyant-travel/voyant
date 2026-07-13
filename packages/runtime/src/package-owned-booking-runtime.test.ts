import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const accommodationHandlerOptions: unknown[] = []
  const cruiseHandlerOptions: unknown[] = []
  const getAccommodationContent = vi.fn()
  const getCruiseContent = vi.fn()

  const tables = {
    bookingActivityLog: { _name: "bookingActivityLog" },
    bookingItems: { _name: "bookingItems" },
    bookingItemTravelers: { _name: "bookingItemTravelers" },
    bookings: { _name: "bookings", id: "bookings.id", bookingNumber: "bookings.bookingNumber" },
    bookingTravelers: {
      _name: "bookingTravelers",
      id: "bookingTravelers.id",
      isPrimary: "bookingTravelers.isPrimary",
    },
    cruiseCabinCategories: {
      _name: "cruiseCabinCategories",
      code: "cruiseCabinCategories.code",
      shipId: "cruiseCabinCategories.shipId",
    },
    cruises: { _name: "cruises", id: "cruises.id" },
    cruiseSailings: {
      _name: "cruiseSailings",
      cruiseId: "cruiseSailings.cruiseId",
      departureDate: "cruiseSailings.departureDate",
    },
    cruiseShips: { _name: "cruiseShips", id: "cruiseShips.id" },
    stayBookingItems: { _name: "stayBookingItems" },
    stayDailyRates: { _name: "stayDailyRates" },
  }

  return {
    accommodationHandlerOptions,
    cruiseHandlerOptions,
    getAccommodationContent,
    getCruiseContent,
    tables,
  }
})

vi.mock("@voyant-travel/accommodations/booking-engine", () => ({
  createAccommodationBookingHandler: (options: unknown) => {
    mocks.accommodationHandlerOptions.push(options)
    return { entityModule: "accommodations", options }
  },
}))

vi.mock("@voyant-travel/accommodations/schema", () => ({
  stayBookingItems: mocks.tables.stayBookingItems,
  stayDailyRates: mocks.tables.stayDailyRates,
}))

vi.mock("@voyant-travel/accommodations/service-content", () => ({
  getAccommodationContent: mocks.getAccommodationContent,
}))

vi.mock("@voyant-travel/bookings/schema", () => ({
  bookingActivityLog: mocks.tables.bookingActivityLog,
  bookingItems: mocks.tables.bookingItems,
  bookingItemTravelers: mocks.tables.bookingItemTravelers,
  bookings: mocks.tables.bookings,
  bookingTravelers: mocks.tables.bookingTravelers,
}))

vi.mock("@voyant-travel/cruises", () => ({
  cruiseCabinCategories: mocks.tables.cruiseCabinCategories,
  cruiseSailings: mocks.tables.cruiseSailings,
  cruiseShips: mocks.tables.cruiseShips,
  cruises: mocks.tables.cruises,
  cruisesBookingService: { createCruiseBooking: vi.fn() },
}))

vi.mock("@voyant-travel/cruises/booking-engine", () => ({
  createCruiseBookingHandler: (options: unknown) => {
    mocks.cruiseHandlerOptions.push(options)
    return { entityModule: "cruises", options }
  },
}))

vi.mock("@voyant-travel/cruises/service-content", () => ({
  getCruiseContent: mocks.getCruiseContent,
}))

vi.mock("@voyant-travel/cruises/service-pricing", () => ({
  pricingService: { lowestAvailablePrice: vi.fn() },
}))

vi.mock("@voyant-travel/db/lib/typeid", () => ({
  newId: (prefix: string) => `${prefix}_test`,
}))

vi.mock("@voyant-travel/finance", () => ({
  bookingPaymentSchedules: { _name: "bookingPaymentSchedules" },
}))

vi.mock("drizzle-orm", () => ({
  asc: vi.fn((value) => ({ asc: value })),
  eq: vi.fn((left, right) => ({ left, right })),
}))

interface CapturedInsert {
  table: string
  value: unknown
}

function createInsertDb() {
  const inserts: CapturedInsert[] = []
  const tx = {
    insert(table: { _name: string }) {
      const builder = {
        values(value: unknown) {
          inserts.push({ table: table._name, value })
          return builder
        },
        returning() {
          if (table._name === "bookings") {
            return Promise.resolve([{ id: "booking_1", bookingNumber: "ACC-TEST" }])
          }
          if (table._name === "bookingTravelers") {
            return Promise.resolve([{ id: "traveler_1", isPrimary: true }])
          }
          return Promise.resolve([])
        },
      }
      return builder
    },
  }
  return {
    inserts,
    db: {
      transaction: (callback: (transaction: typeof tx) => unknown) => callback(tx),
    },
  }
}

function createReadDb() {
  const rowsByTable: Record<string, unknown[]> = {
    cruises: [
      {
        id: "cruise_1",
        name: "Mediterranean Highlights",
        status: "live",
        description: "Round trip",
        cruiseType: "ocean",
        heroImageUrl: "https://example.com/hero.jpg",
        highlights: ["Rome"],
        nights: 7,
        defaultShipId: "ship_1",
      },
    ],
    cruiseSailings: [
      {
        id: "sailing_1",
        shipId: "ship_1",
        departureDate: "2026-07-12",
        returnDate: "2026-07-19",
        salesStatus: "open",
      },
    ],
    cruiseShips: [
      {
        id: "ship_1",
        name: "MV Voyant Explorer",
        description: "Demo ship",
        deckPlanUrl: null,
        capacityGuests: 1200,
        deckCount: 10,
        gallery: [],
      },
    ],
    cruiseCabinCategories: [
      {
        id: "cabin_category_1",
        code: "BAL",
        name: "Balcony",
        description: "Balcony cabin",
        roomType: "balcony",
        minOccupancy: 1,
        maxOccupancy: 2,
        squareFeet: "210.00",
        viewType: "balcony",
        amenities: ["balcony"],
        images: [],
      },
    ],
  }

  return {
    select() {
      let tableName = ""
      const builder = {
        from(table: { _name: string }) {
          tableName = table._name
          return builder
        },
        where() {
          return builder
        },
        orderBy() {
          return Promise.resolve(rowsByTable[tableName] ?? [])
        },
        limit() {
          return Promise.resolve(rowsByTable[tableName] ?? [])
        },
      }
      return builder
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.accommodationHandlerOptions.length = 0
  mocks.cruiseHandlerOptions.length = 0
})

describe("package-owned vertical booking handlers", () => {
  it("wires accommodation commits to booking, traveler, item, stay, and daily-rate rows", async () => {
    const { registerAccommodationBookingHandler } = await import(
      "@voyant-travel/accommodations/booking-engine/runtime"
    )
    const registry = { register: vi.fn() }
    const { db, inserts } = createInsertDb()
    registerAccommodationBookingHandler(registry as never, {
      getSourceRegistry: () => ({}) as never,
      withDatabase: (operation) => operation(db as never),
    })
    const options = mocks.accommodationHandlerOptions[0] as {
      commitBridge: (input: unknown, options?: { userId?: string }) => Promise<unknown>
    }

    const result = await options.commitBridge(
      {
        propertyId: "property_1",
        roomTypeId: "room_1",
        ratePlanId: "rate_1",
        checkInDate: "2026-07-12",
        checkOutDate: "2026-07-14",
        roomCount: 1,
        adults: 2,
        children: 0,
        infants: 0,
        dailyRates: [
          {
            sellCurrency: "GBP",
            sellAmountCents: 22000,
            costCurrency: "GBP",
            costAmountCents: 15000,
          },
          {
            sellCurrency: "GBP",
            sellAmountCents: 24000,
            costCurrency: "GBP",
            costAmountCents: 17000,
          },
        ],
        contact: {
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.com",
        },
        passengers: [
          {
            firstName: "Ada",
            lastName: "Lovelace",
            travelerCategory: "adult",
            isPrimary: true,
          },
        ],
      },
      { userId: "user_1" },
    )

    expect(result).toMatchObject({
      status: "ok",
      bookingId: "booking_1",
      bookingNumber: "ACC-TEST",
    })
    expect(inserts.map((insert) => insert.table)).toEqual([
      "bookings",
      "bookingActivityLog",
      "bookingTravelers",
      "bookingItems",
      "bookingItemTravelers",
      "stayBookingItems",
      "stayDailyRates",
    ])
    expect(inserts.find((insert) => insert.table === "stayDailyRates")?.value).toEqual([
      expect.objectContaining({ date: "2026-07-12", sellAmountCents: 22000 }),
      expect.objectContaining({ date: "2026-07-13", sellAmountCents: 24000 }),
    ])
  })

  it("falls back to local cruise rows when sourced cruise content is absent", async () => {
    const { registerCruiseBookingHandler } = await import(
      "@voyant-travel/cruises/booking-engine/runtime"
    )
    const registry = { register: vi.fn() }
    mocks.getCruiseContent.mockResolvedValue(null)

    registerCruiseBookingHandler(registry as never, {
      getSourceRegistry: () => ({}) as never,
      withDatabase: (operation) => operation(createReadDb() as never),
    })
    const options = mocks.cruiseHandlerOptions[0] as {
      loadContent: (ctx: { db: unknown }, entityId: string) => Promise<unknown>
    }
    const content = await options.loadContent({ db: createReadDb() }, "cruise_1")

    expect(content).toMatchObject({
      cruise: { id: "cruise_1", name: "Mediterranean Highlights" },
      ship: { name: "MV Voyant Explorer" },
      sailings: [expect.objectContaining({ id: "sailing_1" })],
      cabin_categories: [expect.objectContaining({ id: "cabin_category_1", code: "BAL" })],
    })
  })
})
