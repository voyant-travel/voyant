import {
  ratePlanDailyRates,
  roomTypeDailyInventory,
  roomTypes,
} from "@voyant-travel/accommodations/schema"
import { cruisePrices, cruiseSailings, cruises } from "@voyant-travel/cruises/schema"
import { afterEach, describe, expect, it, vi } from "vitest"
import { seedAccommodationRooms, seedCruises } from "./seed-catalog-verticals"

describe("catalog vertical seed booking inventory", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("seeds every cruise with a future sailing and prices for storefront occupancy choices", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-03T12:00:00.000Z"))
    const db = createSeedDb()

    await seedCruises(db as never, {
      sellerOperatorId: "seller_1",
      supplierIds: ["supplier_1"],
      facilityIds: ["facility_1"],
    })

    const seededCruises = db.inserted<{ id: string }>(cruises)
    const sailings = db.inserted<{ id: string; cruiseId: string; departureDate: string }>(
      cruiseSailings,
    )
    const prices = db.inserted<{ sailingId: string; occupancy: number }>(cruisePrices)

    expect(seededCruises).toHaveLength(5)
    expect(sailings).toHaveLength(seededCruises.length)
    expect(prices).toHaveLength(seededCruises.length * 4)
    expect(new Set(sailings.map((sailing) => sailing.cruiseId))).toEqual(
      new Set(seededCruises.map((cruise) => cruise.id)),
    )
    expect(sailings.every((sailing) => sailing.departureDate >= "2026-07-03")).toBe(true)

    for (const sailing of sailings) {
      expect(
        prices
          .filter((price) => price.sailingId === sailing.id)
          .map((price) => price.occupancy)
          .sort(),
      ).toEqual([1, 2, 3, 4])
    }
  })

  it("seeds accommodation rates and inventory from the seed run date", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-03T12:00:00.000Z"))
    const db = createSeedDb()

    await seedAccommodationRooms(db as never, {
      sellerOperatorId: "seller_1",
      supplierIds: ["supplier_1"],
      facilityIds: [],
    })

    const rooms = db.inserted<{ id: string }>(roomTypes)
    const rates = db.inserted<{ date: string }>(ratePlanDailyRates)
    const inventory = db.inserted<{ date: string }>(roomTypeDailyInventory)

    expect(rooms).toHaveLength(8)
    expect(rates).toHaveLength(rooms.length * 365)
    expect(inventory).toHaveLength(rooms.length * 365)
    expect(new Set(rates.map((rate) => rate.date))).toContain("2026-07-03")
    expect(new Set(inventory.map((row) => row.date))).toContain("2026-07-03")
    expect(rates.every((rate) => rate.date >= "2026-07-03")).toBe(true)
    expect(inventory.every((row) => row.date >= "2026-07-03")).toBe(true)
  })
})

function createSeedDb() {
  const insertedRows = new Map<unknown, Record<string, unknown>[]>()

  function inserted<T extends Record<string, unknown>>(table: unknown): T[] {
    return (insertedRows.get(table) ?? []) as T[]
  }

  return {
    inserted,
    insert(table: unknown) {
      return {
        values(value: Record<string, unknown> | Record<string, unknown>[]) {
          const rows = Array.isArray(value) ? value : [value]
          insertedRows.set(table, [...(insertedRows.get(table) ?? []), ...rows])
          return {
            returning() {
              return Promise.resolve(rows)
            },
          }
        },
      }
    },
    update(_table: unknown) {
      return {
        set(_value: Record<string, unknown>) {
          return {
            where() {
              return Promise.resolve([])
            },
          }
        },
      }
    },
    select() {
      return {
        from(table: unknown) {
          return Promise.resolve(inserted(table))
        },
      }
    },
  }
}
