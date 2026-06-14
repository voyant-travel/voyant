/**
 * Verifies that mutations going through `bookingsService.{createItem,
 * updateItem, deleteItem}` keep `bookings.sellAmountCents` /
 * `bookings.costAmountCents` consistent with `Σ(booking_items.total*)`.
 *
 * Closes #313.
 */

import { eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { bookings } from "../../src/schema.js"
import { bookingsService } from "../../src/service.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

let counter = 0
function nextNumber() {
  counter += 1
  return `BK-ROLL-${String(counter).padStart(6, "0")}`
}

describe.skipIf(!DB_AVAILABLE)("bookings auto-rollup", () => {
  let db: ReturnType<typeof import("@voyant-travel/db/test-utils").createTestDb>

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    db = createTestDb()
    await cleanupTestDb(db)
  })

  afterAll(async () => {
    const { closeTestDb } = await import("@voyant-travel/db/test-utils")
    await closeTestDb()
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    await cleanupTestDb(db)
  })

  async function seedBooking() {
    const [row] = await db
      .insert(bookings)
      .values({
        bookingNumber: nextNumber(),
        sellCurrency: "EUR",
      })
      .returning()
    if (!row) throw new Error("seedBooking: insert returned no rows")
    return row
  }

  async function getTotals(bookingId: string) {
    const [row] = await db
      .select({
        sellAmountCents: bookings.sellAmountCents,
        costAmountCents: bookings.costAmountCents,
      })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
    return row
  }

  it("createItem rolls up sellAmountCents and costAmountCents on the parent", async () => {
    const booking = await seedBooking()

    expect((await getTotals(booking.id))?.sellAmountCents).toBeNull()

    await bookingsService.createItem(db, booking.id, {
      title: "Half-day tour",
      itemType: "unit",
      status: "draft",
      quantity: 2,
      sellCurrency: "EUR",
      unitSellAmountCents: 5000,
      totalSellAmountCents: 10000,
      costCurrency: "EUR",
      unitCostAmountCents: 3000,
      totalCostAmountCents: 6000,
    })

    expect(await getTotals(booking.id)).toEqual({
      sellAmountCents: 10000,
      costAmountCents: 6000,
    })

    await bookingsService.createItem(db, booking.id, {
      title: "Pickup",
      itemType: "extra",
      status: "draft",
      quantity: 1,
      sellCurrency: "EUR",
      unitSellAmountCents: 1500,
      totalSellAmountCents: 1500,
    })

    expect(await getTotals(booking.id)).toEqual({
      sellAmountCents: 11500,
      costAmountCents: 6000,
    })
  })

  it("updateItem re-rolls when totalSellAmountCents changes", async () => {
    const booking = await seedBooking()
    const created = await bookingsService.createItem(db, booking.id, {
      title: "Tour",
      itemType: "unit",
      status: "draft",
      quantity: 1,
      sellCurrency: "EUR",
      unitSellAmountCents: 10000,
      totalSellAmountCents: 10000,
    })
    expect(created).not.toBeNull()
    if (!created) throw new Error("createItem returned null")

    await bookingsService.updateItem(db, created.id, {
      totalSellAmountCents: 17500,
    })

    expect((await getTotals(booking.id))?.sellAmountCents).toBe(17500)
  })

  it("deleteItem re-rolls without the removed item", async () => {
    const booking = await seedBooking()
    const a = await bookingsService.createItem(db, booking.id, {
      title: "Tour",
      itemType: "unit",
      status: "draft",
      quantity: 1,
      sellCurrency: "EUR",
      unitSellAmountCents: 10000,
      totalSellAmountCents: 10000,
    })
    await bookingsService.createItem(db, booking.id, {
      title: "Pickup",
      itemType: "extra",
      status: "draft",
      quantity: 1,
      sellCurrency: "EUR",
      unitSellAmountCents: 2000,
      totalSellAmountCents: 2000,
    })
    expect((await getTotals(booking.id))?.sellAmountCents).toBe(12000)

    if (!a) throw new Error("createItem returned null")
    await bookingsService.deleteItem(db, a.id)

    expect((await getTotals(booking.id))?.sellAmountCents).toBe(2000)
  })

  it("recomputeBookingTotal is idempotent and exposed for ad-hoc invocation", async () => {
    const booking = await seedBooking()
    await bookingsService.createItem(db, booking.id, {
      title: "Tour",
      itemType: "unit",
      status: "draft",
      quantity: 1,
      sellCurrency: "EUR",
      unitSellAmountCents: 5000,
      totalSellAmountCents: 5000,
    })

    // Manually set the parent total to a stale value to simulate a prior
    // bug — recompute should restore truth.
    await db
      .update(bookings)
      .set({ sellAmountCents: 999, updatedAt: new Date() })
      .where(eq(bookings.id, booking.id))

    const result = await bookingsService.recomputeBookingTotal(db, booking.id)
    expect(result).toEqual({ sellAmountCents: 5000, costAmountCents: 0 })
    expect((await getTotals(booking.id))?.sellAmountCents).toBe(5000)

    // Idempotent — calling again is a no-op.
    const second = await bookingsService.recomputeBookingTotal(db, booking.id)
    expect(second).toEqual({ sellAmountCents: 5000, costAmountCents: 0 })
  })

  it("treats null totalSellAmountCents as 0 — never NaN, never error", async () => {
    const booking = await seedBooking()
    await bookingsService.createItem(db, booking.id, {
      title: "Pricing TBD",
      itemType: "unit",
      status: "draft",
      quantity: 1,
      sellCurrency: "EUR",
      // unit/total left null intentionally
    })

    expect(await getTotals(booking.id)).toEqual({
      sellAmountCents: 0,
      costAmountCents: 0,
    })
  })

  it("recomputeBookingTotal returns null for a missing booking", async () => {
    const result = await bookingsService.recomputeBookingTotal(db, "book_does_not_exist")
    expect(result).toBeNull()
  })
})
