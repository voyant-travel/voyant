import type { AnyDrizzleDb } from "@voyant-travel/db"
import { describe, expect, it } from "vitest"

import {
  ratePlanDailyRates,
  ratePlanRoomTypes,
  ratePlans,
  roomTypeDailyInventory,
  roomTypes,
} from "../../src/schema-inventory.js"
import {
  eachStayNight,
  quoteOwnedStaysBatch,
  type ResolveOwnedStayQuoteRecords,
  resolveOwnedStayQuote,
  searchOwnedStays,
} from "../../src/service-owned-stays.js"

const baseRecords: ResolveOwnedStayQuoteRecords = {
  room: {
    id: "room_std",
    propertyId: "prop_1",
    active: true,
    maxAdults: 2,
    maxChildren: 1,
    maxInfants: 1,
    maxOccupancy: 3,
  },
  ratePlan: {
    id: "rate_bar",
    propertyId: "prop_1",
    active: true,
    mealPlanId: "meal_bb",
  },
  rates: [
    {
      date: "2026-09-01",
      sellCurrency: "USD",
      sellAmountCents: 12_000,
      occupancyBasis: "room",
      includedAdults: 2,
    },
    {
      date: "2026-09-02",
      sellCurrency: "USD",
      sellAmountCents: 13_000,
      occupancyBasis: "room",
      includedAdults: 2,
    },
    {
      date: "2026-09-03",
      sellCurrency: "USD",
      sellAmountCents: 14_000,
      occupancyBasis: "room",
      includedAdults: 2,
    },
  ],
  inventory: [
    { date: "2026-09-01", capacity: 3 },
    { date: "2026-09-02", capacity: 3 },
    { date: "2026-09-03", capacity: 3 },
  ],
  overlappingBookings: [
    {
      checkInDate: "2026-09-02",
      checkOutDate: "2026-09-04",
      roomCount: 1,
    },
  ],
}

interface QueuedRows {
  queue: unknown[][]
}

class FakeSelectQuery {
  constructor(private readonly rows: unknown[]) {}

  from() {
    return this
  }

  where() {
    return Object.assign(Promise.resolve(this.rows), {
      limit: (limit: number) => Promise.resolve(this.rows.slice(0, limit)),
      orderBy: () => Promise.resolve(this.rows),
    })
  }

  orderBy() {
    return Promise.resolve(this.rows)
  }

  limit(limit: number) {
    return Promise.resolve(this.rows.slice(0, limit))
  }
}

function queuedRows(...queue: unknown[][]): QueuedRows {
  return { queue }
}

function isQueuedRows(value: unknown[] | QueuedRows | undefined): value is QueuedRows {
  return value != null && !Array.isArray(value)
}

function fakeDb(rowsByTable: Map<unknown, unknown[] | QueuedRows>): AnyDrizzleDb {
  const readsByTable = new Map<unknown, number>()
  return {
    select() {
      return {
        from(table: unknown) {
          const configured = rowsByTable.get(table)
          if (!isQueuedRows(configured)) return new FakeSelectQuery(configured ?? [])
          const read = readsByTable.get(table) ?? 0
          readsByTable.set(table, read + 1)
          return new FakeSelectQuery(configured.queue[read] ?? [])
        },
      }
    },
  } as AnyDrizzleDb
}

function room(
  overrides: Partial<typeof roomTypes.$inferSelect> = {},
): typeof roomTypes.$inferSelect {
  return {
    id: "room_std",
    propertyId: "prop_1",
    supplierId: null,
    code: "STD",
    name: "Standard",
    description: null,
    inventoryMode: "pooled",
    roomClass: null,
    maxAdults: 2,
    maxChildren: null,
    maxInfants: null,
    standardOccupancy: null,
    maxOccupancy: 2,
    minOccupancy: null,
    bedroomCount: null,
    bathroomCount: null,
    areaValue: null,
    areaUnit: null,
    accessibilityNotes: null,
    smokingAllowed: false,
    active: true,
    sortOrder: 0,
    metadata: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  }
}

function ratePlan(
  overrides: Partial<typeof ratePlans.$inferSelect> = {},
): typeof ratePlans.$inferSelect {
  return {
    id: "rate_ref",
    propertyId: "prop_1",
    code: "BAR",
    name: "Best Available",
    description: null,
    mealPlanId: null,
    priceCatalogId: null,
    cancellationPolicyId: null,
    marketId: null,
    currencyCode: "USD",
    chargeFrequency: "per_night",
    guaranteeMode: "none",
    commissionable: true,
    refundable: true,
    active: true,
    sortOrder: 0,
    customerPaymentPolicy: null,
    metadata: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  }
}

function dailyRate(
  overrides: Partial<typeof ratePlanDailyRates.$inferSelect> = {},
): typeof ratePlanDailyRates.$inferSelect {
  return {
    id: "rate_day_1",
    ratePlanId: "rate_ref",
    roomTypeId: "room_std",
    date: "2026-09-01",
    sellCurrency: "USD",
    sellAmountCents: 10_000,
    costCurrency: null,
    costAmountCents: null,
    taxAmountCents: null,
    feeAmountCents: null,
    occupancyBasis: "room",
    includedAdults: 2,
    includedChildren: 0,
    includedInfants: 0,
    metadata: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  }
}

function dailyInventory(
  overrides: Partial<typeof roomTypeDailyInventory.$inferSelect> = {},
): typeof roomTypeDailyInventory.$inferSelect {
  return {
    id: "inventory_day_1",
    roomTypeId: "room_std",
    date: "2026-09-01",
    capacity: 2,
    closed: false,
    metadata: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  }
}

function searchDb(options: {
  rooms: Array<typeof roomTypes.$inferSelect>
  plans: Array<typeof ratePlans.$inferSelect>
  rates?: Array<typeof ratePlanDailyRates.$inferSelect>
  inventory?: Array<typeof roomTypeDailyInventory.$inferSelect>
}): AnyDrizzleDb {
  return fakeDb(
    new Map<unknown, unknown[] | QueuedRows>([
      [roomTypes, queuedRows(options.rooms, ...options.plans.map(() => options.rooms))],
      [ratePlans, queuedRows(options.plans, ...options.plans.map((plan) => [plan]))],
      [ratePlanRoomTypes, []],
      [ratePlanDailyRates, queuedRows(...options.plans.map(() => options.rates ?? [dailyRate()]))],
      [
        roomTypeDailyInventory,
        queuedRows(...options.plans.map(() => options.inventory ?? [dailyInventory()])),
      ],
    ]),
  )
}

describe("eachStayNight", () => {
  it("enumerates occupied stay nights from check-in through exclusive check-out", () => {
    expect(eachStayNight("2026-09-01", "2026-09-04")).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
    ])
    expect(eachStayNight("2026-09-01", "2026-09-01")).toEqual([])
  })
})

describe("resolveOwnedStayQuote", () => {
  it("returns nightly and total price while subtracting overlapping booked stays", () => {
    const result = resolveOwnedStayQuote(
      {
        roomTypeId: "room_std",
        ratePlanId: "rate_bar",
        checkIn: "2026-09-01",
        checkOut: "2026-09-04",
        roomCount: 2,
        occupancy: { adults: 2 },
        currency: "USD",
      },
      baseRecords,
    )

    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.available).toBe(true)
    expect(result.propertyId).toBe("prop_1")
    expect(result.mealPlanId).toBe("meal_bb")
    expect(result.totalAmountCents).toBe(78_000)
    expect(result.nightlyRates.map((rate) => rate.totalAmountCents)).toEqual([
      24_000, 26_000, 28_000,
    ])
    expect(result.availability.minimumRemainingRooms).toBe(2)
    expect(result.availability.nights.map((night) => night.remaining)).toEqual([3, 2, 2])
  })

  it("reports missing nightly rates for the requested range", () => {
    const result = resolveOwnedStayQuote(
      {
        roomTypeId: "room_std",
        ratePlanId: "rate_bar",
        checkIn: "2026-09-01",
        checkOut: "2026-09-04",
      },
      { ...baseRecords, rates: baseRecords.rates.slice(0, 2) },
    )

    expect(result).toEqual({ status: "rates_missing", missingDates: ["2026-09-03"] })
  })

  it("marks a stay unavailable when any requested night is closed", () => {
    const result = resolveOwnedStayQuote(
      {
        roomTypeId: "room_std",
        ratePlanId: "rate_bar",
        checkIn: "2026-09-01",
        checkOut: "2026-09-04",
      },
      {
        ...baseRecords,
        inventory: [
          { date: "2026-09-01", capacity: 3 },
          { date: "2026-09-02", capacity: 3, closed: true },
          { date: "2026-09-03", capacity: 3 },
        ],
      },
    )

    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.available).toBe(false)
    expect(result.availability.minimumRemainingRooms).toBe(0)
  })

  it("rejects occupancies beyond room limits", () => {
    const result = resolveOwnedStayQuote(
      {
        roomTypeId: "room_std",
        ratePlanId: "rate_bar",
        checkIn: "2026-09-01",
        checkOut: "2026-09-04",
        occupancy: { adults: 3 },
      },
      baseRecords,
    )

    expect(result.status).toBe("room_occupancy_exceeded")
  })

  it("checks each requested room occupancy while pricing per-person stays across rooms", () => {
    const result = resolveOwnedStayQuote(
      {
        roomTypeId: "room_std",
        ratePlanId: "rate_bar",
        checkIn: "2026-09-01",
        checkOut: "2026-09-02",
        roomCount: 2,
        occupancies: [{ adults: 2 }, { adults: 2 }],
      },
      {
        ...baseRecords,
        rates: [
          {
            date: "2026-09-01",
            sellCurrency: "USD",
            sellAmountCents: 10_000,
            occupancyBasis: "per_person",
          },
        ],
        inventory: [{ date: "2026-09-01", capacity: 2 }],
        overlappingBookings: [],
      },
    )

    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.totalAmountCents).toBe(40_000)
    expect(result.nightlyRates[0]?.quantity).toBe(4)
  })
})

describe("quoteOwnedStaysBatch", () => {
  it("resolves multiple rate plans for one room/date range from shared records", async () => {
    const db = fakeDb(
      new Map<unknown, unknown[] | QueuedRows>([
        [roomTypes, [room()]],
        [
          ratePlans,
          [
            ratePlan({ id: "rate_bar", mealPlanId: "meal_bb" }),
            ratePlan({ id: "rate_flex", mealPlanId: "meal_hb" }),
          ],
        ],
        [
          ratePlanDailyRates,
          [
            dailyRate({
              id: "bar_1",
              ratePlanId: "rate_bar",
              date: "2026-09-01",
              sellAmountCents: 10_000,
            }),
            dailyRate({
              id: "bar_2",
              ratePlanId: "rate_bar",
              date: "2026-09-02",
              sellAmountCents: 11_000,
            }),
            dailyRate({
              id: "flex_1",
              ratePlanId: "rate_flex",
              date: "2026-09-01",
              sellAmountCents: 12_000,
            }),
            dailyRate({
              id: "flex_2",
              ratePlanId: "rate_flex",
              date: "2026-09-02",
              sellAmountCents: 13_000,
            }),
          ],
        ],
        [
          roomTypeDailyInventory,
          [
            dailyInventory({ date: "2026-09-01", capacity: 3 }),
            dailyInventory({ date: "2026-09-02", capacity: 3 }),
          ],
        ],
      ]),
    )

    const [bar, flex] = await quoteOwnedStaysBatch(db, [
      {
        roomTypeId: "room_std",
        ratePlanId: "rate_bar",
        checkIn: "2026-09-01",
        checkOut: "2026-09-03",
        occupancy: { adults: 2 },
      },
      {
        roomTypeId: "room_std",
        ratePlanId: "rate_flex",
        checkIn: "2026-09-01",
        checkOut: "2026-09-03",
        occupancy: { adults: 2 },
      },
    ])

    expect(bar).toMatchObject({ status: "ok", ratePlanId: "rate_bar", totalAmountCents: 21_000 })
    expect(flex).toMatchObject({
      status: "ok",
      ratePlanId: "rate_flex",
      totalAmountCents: 25_000,
    })
  })
})

describe("searchOwnedStays", () => {
  it("honors refundable-only searches", async () => {
    const refundable = ratePlan({ id: "rate_ref", refundable: true })
    const nonRefundable = ratePlan({ id: "rate_nonref", refundable: false })
    const result = await searchOwnedStays(
      searchDb({
        rooms: [room()],
        plans: [refundable, nonRefundable],
      }),
      {
        criteria: {
          checkIn: "2026-09-01",
          checkOut: "2026-09-02",
          rooms: [{ adults: 2 }],
          refundableOnly: true,
        },
        nights: 1,
        scope: { locale: "en-US", currency: "USD" },
        limit: 10,
      },
    )

    expect(result.matches.map((match) => match.ratePlanId)).toEqual(["rate_ref"])
  })

  it("keeps multi-room occupancy per room in the search quote path", async () => {
    const result = await searchOwnedStays(
      searchDb({
        rooms: [room({ maxAdults: 2, maxOccupancy: 2 })],
        plans: [ratePlan()],
        rates: [dailyRate({ occupancyBasis: "per_person" })],
      }),
      {
        criteria: {
          checkIn: "2026-09-01",
          checkOut: "2026-09-02",
          rooms: [{ adults: 2 }, { adults: 2 }],
        },
        nights: 1,
        scope: { locale: "en-US", currency: "USD" },
        limit: 10,
      },
    )

    expect(result.matches).toHaveLength(1)
    expect(result.matches[0]?.price).toEqual({ amount: "400.00", currency: "USD" })
  })

  it("returns and consumes cursors when truncating owned matches", async () => {
    const plans = [
      ratePlan({ id: "rate_a", name: "A" }),
      ratePlan({ id: "rate_b", name: "B" }),
      ratePlan({ id: "rate_c", name: "C" }),
    ]
    const input = {
      criteria: {
        checkIn: "2026-09-01",
        checkOut: "2026-09-02",
        rooms: [{ adults: 2 }],
      },
      nights: 1,
      scope: { locale: "en-US", currency: "USD" },
      limit: 2,
    }

    const firstPage = await searchOwnedStays(searchDb({ rooms: [room()], plans }), input)
    const secondPage = await searchOwnedStays(searchDb({ rooms: [room()], plans }), {
      ...input,
      cursor: firstPage.nextCursor,
    })

    expect(firstPage.matches.map((match) => match.ratePlanId)).toEqual(["rate_a", "rate_b"])
    expect(firstPage.nextCursor).toBe("owned:2")
    expect(secondPage.matches.map((match) => match.ratePlanId)).toEqual(["rate_c"])
    expect(secondPage.nextCursor).toBeUndefined()
  })
})
