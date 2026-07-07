import type { BookingOverviewEnricherItem } from "@voyant-travel/bookings"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { properties } from "@voyant-travel/operations"
import { describe, expect, it } from "vitest"

import {
  enrichStayBookingOverviewItems,
  type StayBookingOverviewDetails,
} from "../../src/booking-overview-enricher.js"
import { stayBookingItems, stayDailyRates } from "../../src/schema-bookings.js"
import { mealPlans, ratePlans, roomTypes } from "../../src/schema-inventory.js"

// Minimal drizzle-query fake: keys canned rows by the first `.from()` table and
// treats every builder step (join / where / orderBy) as a pass-through so the
// enricher's real join/group/shape logic runs against the provided rows.
class FakeQuery {
  constructor(private readonly rows: unknown[]) {}
  from() {
    return this
  }
  innerJoin() {
    return this
  }
  leftJoin() {
    return this
  }
  where() {
    // Terminal step: an awaitable that also supports a trailing `.orderBy()`.
    return Object.assign(Promise.resolve(this.rows), {
      orderBy: () => Promise.resolve(this.rows),
    })
  }
}

function fakeDb(rowsByTable: Map<unknown, unknown[]>): AnyDrizzleDb {
  return {
    select() {
      return {
        from(table: unknown) {
          return new FakeQuery(rowsByTable.get(table) ?? [])
        },
      }
    },
  } as AnyDrizzleDb
}

function items(...ids: string[]): BookingOverviewEnricherItem[] {
  return ids.map((id) => ({ id, itemType: "accommodation", productId: null, optionId: null }))
}

const baseStay = {
  id: "staybi_1",
  bookingItemId: "bkit_1",
  propertyId: "prop_1",
  roomTypeId: "room_1",
  ratePlanId: "rate_1",
  mealPlanId: "meal_1" as string | null,
  checkInDate: "2026-09-01",
  checkOutDate: "2026-09-03",
  nightCount: 2,
  roomCount: 1,
  adults: 2,
  children: 0,
  infants: 0,
  confirmationCode: "CONF-1",
  voucherCode: null,
  status: "reserved",
}

const baseProperty = {
  id: "prop_1",
  checkInTime: "15:00",
  checkOutTime: "11:00",
  name: "Acme Grand Hotel",
  addressFullText: "1 Ocean Dr, Split, HR",
  addressLine1: "1 Ocean Dr",
  addressLine2: null,
  city: "Split",
  region: null,
  postalCode: "21000",
  country: "HR",
}

describe("enrichStayBookingOverviewItems", () => {
  it("builds a full accommodation recap keyed by booking item id", async () => {
    const db = fakeDb(
      new Map<unknown, unknown[]>([
        [stayBookingItems, [baseStay]],
        [properties, [baseProperty]],
        [roomTypes, [{ id: "room_1", name: "Deluxe King" }]],
        [ratePlans, [{ id: "rate_1", name: "Best Available" }]],
        [mealPlans, [{ id: "meal_1", name: "Bed & Breakfast" }]],
        [
          stayDailyRates,
          [
            {
              stayBookingItemId: "staybi_1",
              date: "2026-09-01",
              sellCurrency: "EUR",
              sellAmountCents: 12_000,
            },
            {
              stayBookingItemId: "staybi_1",
              date: "2026-09-02",
              sellCurrency: "EUR",
              sellAmountCents: 12_000,
            },
          ],
        ],
      ]),
    )

    const result = await enrichStayBookingOverviewItems(db, items("bkit_1"))
    const details = result.get("bkit_1") as StayBookingOverviewDetails

    expect(details.kind).toBe("accommodation")
    expect(details.property.name).toBe("Acme Grand Hotel")
    expect(details.property.checkInTime).toBe("15:00")
    expect(details.property.address).toMatchObject({ city: "Split", country: "HR" })
    expect(details.roomType.name).toBe("Deluxe King")
    expect(details.ratePlan.name).toBe("Best Available")
    expect(details.mealPlan).toMatchObject({ id: "meal_1", name: "Bed & Breakfast" })
    expect(details.nightCount).toBe(2)
    expect(details.confirmationCode).toBe("CONF-1")
    expect(details.dailyRates).toHaveLength(2)
    expect(details.dailyRates[0]).toMatchObject({ date: "2026-09-01", sellAmountCents: 12_000 })
  })

  it("returns a null meal plan and null address when those are absent", async () => {
    const db = fakeDb(
      new Map<unknown, unknown[]>([
        [stayBookingItems, [{ ...baseStay, mealPlanId: null }]],
        [
          properties,
          [
            {
              ...baseProperty,
              addressFullText: null,
              addressLine1: null,
              city: null,
              country: null,
            },
          ],
        ],
        [roomTypes, [{ id: "room_1", name: "Deluxe King" }]],
        [ratePlans, [{ id: "rate_1", name: "Best Available" }]],
        [mealPlans, []],
        [stayDailyRates, []],
      ]),
    )

    const details = (await enrichStayBookingOverviewItems(db, items("bkit_1"))).get(
      "bkit_1",
    ) as StayBookingOverviewDetails

    expect(details.mealPlan).toBeNull()
    expect(details.property.address).toBeNull()
    expect(details.dailyRates).toEqual([])
  })

  it("returns an empty map when no stay rows match", async () => {
    const db = fakeDb(new Map<unknown, unknown[]>([[stayBookingItems, []]]))
    const result = await enrichStayBookingOverviewItems(db, items("bkit_1", "bkit_2"))
    expect(result.size).toBe(0)
  })
})
