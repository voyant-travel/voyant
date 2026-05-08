import type { AnyDrizzleDb } from "@voyantjs/db"
import type { IndexerSlice } from "@voyantjs/products/service-catalog-plane"
import { describe, expect, it } from "vitest"

import {
  __test__,
  createProductDeparturesProjectionExtension,
} from "../../src/service-catalog-plane-departures.js"

const { aggregateDepartures, EMPTY_AGGREGATE, SCHEDULED_BOOKING_MODES } = __test__

interface Slot {
  startsAt: Date
  dateLocal: string
  remainingPax: number | null
  unlimited: boolean
}

function slot(
  isoStarts: string,
  dateLocal: string,
  remainingPax: number | null = 5,
  unlimited = false,
): Slot {
  return { startsAt: new Date(isoStarts), dateLocal, remainingPax, unlimited }
}

const NOW = new Date("2026-05-08T12:00:00Z")

const customerSlice: IndexerSlice = {
  vertical: "products",
  locale: "en-GB",
  audience: "customer",
  market: "default",
}

describe("aggregateDepartures (kernel)", () => {
  it("returns the empty aggregate when no slots", () => {
    expect(aggregateDepartures([], NOW, 180, 24)).toEqual(EMPTY_AGGREGATE)
  })

  it("picks earliest slot as next, counts all, dedupes dates and months", () => {
    const slots: Slot[] = [
      slot("2026-05-09T10:00:00Z", "2026-05-09", 4),
      slot("2026-05-09T18:00:00Z", "2026-05-09", 6), // same local date, second time slot
      slot("2026-06-15T08:00:00Z", "2026-06-15", 8),
    ]
    const out = aggregateDepartures(slots, NOW, 180, 24)
    expect(out.nextDepartureAt).toBe("2026-05-09T10:00:00.000Z")
    expect(out.nextDepartureDate).toBe("2026-05-09")
    expect(out.hasUpcomingDeparture).toBe(true)
    expect(out.upcomingDepartureCount).toBe(3)
    // Two distinct dates after dedup, sorted ascending.
    expect(out.departureDates).toEqual(["2026-05-09", "2026-06-15"])
    expect(out.departureMonths).toEqual(["2026-05", "2026-06"])
    expect(out.availableUnitsTotal).toBe(18)
  })

  it("emits availableUnitsTotal=null when ANY slot is unlimited", () => {
    const slots: Slot[] = [
      slot("2026-05-09T10:00:00Z", "2026-05-09", 4),
      slot("2026-05-10T10:00:00Z", "2026-05-10", null, true), // unlimited
    ]
    const out = aggregateDepartures(slots, NOW, 180, 24)
    expect(out.availableUnitsTotal).toBeNull()
    // But count + dates still reflect both.
    expect(out.upcomingDepartureCount).toBe(2)
    expect(out.departureDates).toEqual(["2026-05-09", "2026-05-10"])
  })

  it("clips departureDates to the configured window", () => {
    const slots: Slot[] = [
      slot("2026-05-15T10:00:00Z", "2026-05-15"), // within 30 days
      slot("2026-08-15T10:00:00Z", "2026-08-15"), // outside 30 days
    ]
    const out = aggregateDepartures(slots, NOW, /* days */ 30, /* months */ 24)
    expect(out.departureDates).toEqual(["2026-05-15"])
    // Months window stays at 24 — both still appear.
    expect(out.departureMonths).toEqual(["2026-05", "2026-08"])
    // Count is unaffected by the window — it's the underlying scan size.
    expect(out.upcomingDepartureCount).toBe(2)
  })

  it("clips departureMonths to the configured window", () => {
    const slots: Slot[] = [
      slot("2026-05-15T10:00:00Z", "2026-05-15"),
      slot("2027-08-15T10:00:00Z", "2027-08-15"), // 15 months out
      slot("2028-08-15T10:00:00Z", "2028-08-15"), // 27 months out — past 24mo cap
    ]
    const out = aggregateDepartures(slots, NOW, 180, 24)
    expect(out.departureMonths).toEqual(["2026-05", "2027-08"])
  })

  it("uses slot.dateLocal verbatim — does not attempt timezone conversion of startsAt", () => {
    // 9am Madrid local on May 5 — startsAt is the equivalent UTC
    // (May 5 07:00Z), but the slot row says May 5 in its TZ. Storefronts
    // bucket by the slot's local calendar so a Hawaii user still sees
    // "May 5 in Madrid" and not "May 4 UTC".
    const madridSlot = slot("2026-05-05T07:00:00Z", "2026-05-05", 12)
    const out = aggregateDepartures([madridSlot], NOW, 180, 24)
    expect(out.nextDepartureDate).toBe("2026-05-05")
    expect(out.departureDates).toEqual(["2026-05-05"])
    expect(out.departureMonths).toEqual(["2026-05"])
  })

  it("orders defensively even when caller passes slots out of order", () => {
    const out = aggregateDepartures(
      [slot("2026-09-01T10:00:00Z", "2026-09-01"), slot("2026-05-09T10:00:00Z", "2026-05-09")],
      NOW,
      180,
      24,
    )
    expect(out.nextDepartureAt).toBe("2026-05-09T10:00:00.000Z")
  })

  it("scheduled-mode set covers the modes operators use for fixed cohorts", () => {
    expect(SCHEDULED_BOOKING_MODES.has("date")).toBe(true)
    expect(SCHEDULED_BOOKING_MODES.has("date_time")).toBe(true)
    expect(SCHEDULED_BOOKING_MODES.has("stay")).toBe(true)
    expect(SCHEDULED_BOOKING_MODES.has("itinerary")).toBe(true)
    // "open" = anytime (no fixed slots) — must NOT be scheduled.
    expect(SCHEDULED_BOOKING_MODES.has("open")).toBe(false)
  })
})

describe("createProductDeparturesProjectionExtension", () => {
  // biome-ignore lint/suspicious/noExplicitAny: drizzle stub
  const dbStub: any = {}

  it("short-circuits to empty for products with bookingMode='open'", async () => {
    const ext = createProductDeparturesProjectionExtension({
      now: () => NOW,
      loadBookingMode: async () => "open",
    })
    const out = await ext.project(dbStub as AnyDrizzleDb, "prod_anytime", customerSlice)
    expect(out.get("nextDepartureAt")).toBeNull()
    expect(out.get("hasUpcomingDeparture")).toBe(false)
    expect(out.get("upcomingDepartureCount")).toBe(0)
    expect(out.get("departureDates[]")).toEqual([])
    expect(out.get("departureMonths[]")).toEqual([])
    expect(out.get("availableUnitsTotal")).toBe(0)
  })

  it("short-circuits empty for any other non-scheduled mode (transfer, other, ...)", async () => {
    const ext = createProductDeparturesProjectionExtension({
      now: () => NOW,
      loadBookingMode: async () => "transfer",
    })
    const out = await ext.project(dbStub as AnyDrizzleDb, "prod_transfer", customerSlice)
    expect(out.get("hasUpcomingDeparture")).toBe(false)
  })

  it("emits empty when bookingMode is null (product missing — defensive)", async () => {
    const ext = createProductDeparturesProjectionExtension({
      now: () => NOW,
      loadBookingMode: async () => null,
    })
    // Stub a DB that returns no slots so the path runs without errors.
    // biome-ignore lint/suspicious/noExplicitAny: chained drizzle stub
    const localDb: any = {
      select() {
        return {
          from() {
            return {
              where() {
                return { orderBy: async () => [] }
              },
            }
          },
        }
      },
    }
    const out = await ext.project(localDb, "prod_missing", customerSlice)
    // null bookingMode is treated as "scheduled" (defensive), so the
    // query runs and the empty result still produces the empty aggregate.
    expect(out.get("upcomingDepartureCount")).toBe(0)
  })

  it("returns aggregated fields for a scheduled product", async () => {
    // biome-ignore lint/suspicious/noExplicitAny: chained drizzle stub
    const dbWithSlots: any = {
      select() {
        return {
          from() {
            return {
              where() {
                return {
                  orderBy: async () => [
                    slot("2026-05-09T10:00:00Z", "2026-05-09", 5),
                    slot("2026-06-01T10:00:00Z", "2026-06-01", 8),
                  ],
                }
              },
            }
          },
        }
      },
    }
    const ext = createProductDeparturesProjectionExtension({
      now: () => NOW,
      loadBookingMode: async () => "date",
    })
    const out = await ext.project(dbWithSlots, "prod_scheduled", customerSlice)
    expect(out.get("hasUpcomingDeparture")).toBe(true)
    expect(out.get("upcomingDepartureCount")).toBe(2)
    expect(out.get("nextDepartureDate")).toBe("2026-05-09")
    expect(out.get("availableUnitsTotal")).toBe(13)
    expect(out.get("departureMonths[]")).toEqual(["2026-05", "2026-06"])
  })
})
