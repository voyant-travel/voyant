/**
 * Covers the dashboard-facing additions to `getBookingAggregates`:
 *
 *  - `totalPax` sums the `pax` column across active-status bookings
 *    in the requested range.
 *  - `upcomingDepartures.items` returns a bounded slice of soonest-
 *    departing rows ordered by `startDate` ascending.
 *  - Cancelled bookings never appear in `upcomingDepartures`.
 *  - The slice respects the `upcomingLimit` query parameter.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { bookings } from "../../src/schema.js"
import { bookingsService } from "../../src/service.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

let counter = 0
function nextBookingNumber() {
  counter += 1
  return `BK-AGG-${String(counter).padStart(6, "0")}`
}

function isoDateInDays(days: number) {
  const date = new Date()
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

describe.skipIf(!DB_AVAILABLE)("getBookingAggregates dashboard fields", () => {
  // biome-ignore lint/suspicious/noExplicitAny: test db typing -- owner: bookings; existing suppression is intentional pending typed cleanup.
  let db: any

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    db = createTestDb()
    await cleanupTestDb(db)
  })

  beforeEach(async () => {
    counter = 0
    const { cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    await cleanupTestDb(db)
  })

  afterAll(async () => {
    const { closeTestDb } = await import("@voyant-travel/db/test-utils")
    await closeTestDb()
  })

  it("sums pax across active-status bookings into totalPax", async () => {
    await db.insert(bookings).values([
      {
        bookingNumber: nextBookingNumber(),
        sellCurrency: "EUR",
        status: "confirmed",
        pax: 4,
      },
      {
        bookingNumber: nextBookingNumber(),
        sellCurrency: "EUR",
        status: "in_progress",
        pax: 2,
      },
      // Cancelled bookings do not feed totalPax.
      {
        bookingNumber: nextBookingNumber(),
        sellCurrency: "EUR",
        status: "cancelled",
        pax: 99,
      },
      // Null pax is treated as zero.
      {
        bookingNumber: nextBookingNumber(),
        sellCurrency: "EUR",
        status: "confirmed",
        pax: null,
      },
    ])

    const aggregates = await bookingsService.getBookingAggregates(db)
    expect(aggregates.totalPax).toBe(6)
  })

  it("returns upcoming-departure items ordered by startDate ascending", async () => {
    await db.insert(bookings).values([
      {
        bookingNumber: nextBookingNumber(),
        sellCurrency: "EUR",
        status: "confirmed",
        startDate: isoDateInDays(20),
      },
      {
        bookingNumber: nextBookingNumber(),
        sellCurrency: "EUR",
        status: "confirmed",
        startDate: isoDateInDays(5),
      },
      {
        bookingNumber: nextBookingNumber(),
        sellCurrency: "EUR",
        status: "in_progress",
        startDate: isoDateInDays(10),
      },
      // Cancelled never appears in upcoming.
      {
        bookingNumber: nextBookingNumber(),
        sellCurrency: "EUR",
        status: "cancelled",
        startDate: isoDateInDays(2),
      },
      // Already departed: startDate < today is excluded.
      {
        bookingNumber: nextBookingNumber(),
        sellCurrency: "EUR",
        status: "confirmed",
        startDate: isoDateInDays(-3),
      },
    ])

    const aggregates = await bookingsService.getBookingAggregates(db)
    expect(aggregates.upcomingDepartures.count).toBe(3)
    const startDates = aggregates.upcomingDepartures.items.map((row) => row.startDate)
    expect(startDates).toEqual([isoDateInDays(5), isoDateInDays(10), isoDateInDays(20)])
    // Cancelled and past departures are absent.
    expect(aggregates.upcomingDepartures.items.some((row) => row.status === "cancelled")).toBe(
      false,
    )
  })

  it("bounds upcoming items by upcomingLimit (default 8, max 20)", async () => {
    const rows = Array.from({ length: 12 }, (_, idx) => ({
      bookingNumber: nextBookingNumber(),
      sellCurrency: "EUR",
      status: "confirmed" as const,
      startDate: isoDateInDays(idx + 1),
    }))
    await db.insert(bookings).values(rows)

    const defaultLimit = await bookingsService.getBookingAggregates(db)
    expect(defaultLimit.upcomingDepartures.count).toBe(12)
    expect(defaultLimit.upcomingDepartures.items).toHaveLength(8)

    const explicit = await bookingsService.getBookingAggregates(db, { upcomingLimit: 3 })
    expect(explicit.upcomingDepartures.items).toHaveLength(3)

    const zero = await bookingsService.getBookingAggregates(db, { upcomingLimit: 0 })
    expect(zero.upcomingDepartures.count).toBe(12)
    expect(zero.upcomingDepartures.items).toHaveLength(0)
  })
})
