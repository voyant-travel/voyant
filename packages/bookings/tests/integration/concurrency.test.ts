import { eq, sql } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { availabilitySlotsRef } from "../../src/availability-ref.js"
import { bookingAllocations } from "../../src/schema.js"
import { bookingsService } from "../../src/service.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

let counter = 0
function nextNumber(prefix = "BK-CONC") {
  counter += 1
  return `${prefix}-${String(counter).padStart(6, "0")}`
}

describe.skipIf(!DB_AVAILABLE)("bookings concurrency — reserve race", () => {
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

  async function seedSlot(remainingPax: number) {
    const [slot] = await db
      .insert(availabilitySlotsRef)
      .values({
        productId: "prod_conc",
        optionId: "opt_conc",
        dateLocal: "2026-06-01",
        startsAt: new Date("2026-06-01T09:00:00.000Z"),
        endsAt: new Date("2026-06-01T11:00:00.000Z"),
        timezone: "Europe/Bucharest",
        status: "open",
        unlimited: false,
        initialPax: remainingPax,
        remainingPax,
      })
      .returning()
    if (!slot) throw new Error("seedSlot: insert returned no rows")
    return slot
  }

  function reservePayload(slotId: string, quantity: number) {
    return {
      bookingNumber: nextNumber(),
      sellCurrency: "USD",
      sourceType: "manual" as const,
      holdMinutes: 30,
      items: [
        {
          title: "Race seat",
          itemType: "unit" as const,
          quantity,
          sellCurrency: "USD",
          allocationType: "unit" as const,
          availabilitySlotId: slotId,
        },
      ],
    }
  }

  it("two concurrent reserves on the last seat — exactly one succeeds, one returns insufficient_capacity", async () => {
    const slot = await seedSlot(1)

    const [a, b] = await Promise.all([
      bookingsService.reserveBooking(db, reservePayload(slot.id, 1)),
      bookingsService.reserveBooking(db, reservePayload(slot.id, 1)),
    ])

    const successes = [a, b].filter(
      (r): r is { status: "ok"; booking: { id: string } } => r.status === "ok",
    )
    const conflicts = [a, b].filter((r) => r.status === "insufficient_capacity")

    expect(successes).toHaveLength(1)
    expect(conflicts).toHaveLength(1)

    const [refreshedSlot] = await db
      .select({
        remainingPax: availabilitySlotsRef.remainingPax,
        status: availabilitySlotsRef.status,
      })
      .from(availabilitySlotsRef)
      .where(eq(availabilitySlotsRef.id, slot.id))
    expect(refreshedSlot?.remainingPax).toBe(0)
    expect(refreshedSlot?.status).toBe("sold_out")

    const [{ count }] = (await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookingAllocations)
      .where(eq(bookingAllocations.availabilitySlotId, slot.id))) as Array<{ count: number }>
    expect(count).toBe(1)
  })

  it("ten concurrent reserves on a 5-seat slot — exactly five succeed, five conflict", async () => {
    const slot = await seedSlot(5)

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        bookingsService.reserveBooking(db, reservePayload(slot.id, 1)),
      ),
    )

    const successes = results.filter((r) => r.status === "ok")
    const conflicts = results.filter((r) => r.status === "insufficient_capacity")
    expect(successes).toHaveLength(5)
    expect(conflicts).toHaveLength(5)

    const [refreshedSlot] = await db
      .select({
        remainingPax: availabilitySlotsRef.remainingPax,
        status: availabilitySlotsRef.status,
      })
      .from(availabilitySlotsRef)
      .where(eq(availabilitySlotsRef.id, slot.id))
    expect(refreshedSlot?.remainingPax).toBe(0)
    expect(refreshedSlot?.status).toBe("sold_out")
  })

  it("oversubscribing a single reserve quantity > remaining — fails fast with insufficient_capacity", async () => {
    const slot = await seedSlot(2)
    const result = await bookingsService.reserveBooking(db, reservePayload(slot.id, 5))
    expect(result.status).toBe("insufficient_capacity")

    const [refreshedSlot] = await db
      .select({ remainingPax: availabilitySlotsRef.remainingPax })
      .from(availabilitySlotsRef)
      .where(eq(availabilitySlotsRef.id, slot.id))
    expect(refreshedSlot?.remainingPax).toBe(2)
  })
})

describe.skipIf(!DB_AVAILABLE)("bookings concurrency — confirm idempotency", () => {
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

  async function seedHeldBooking() {
    const [slot] = await db
      .insert(availabilitySlotsRef)
      .values({
        productId: "prod_conc",
        optionId: "opt_conc",
        dateLocal: "2026-07-01",
        startsAt: new Date("2026-07-01T09:00:00.000Z"),
        endsAt: new Date("2026-07-01T11:00:00.000Z"),
        timezone: "Europe/Bucharest",
        status: "open",
        unlimited: false,
        initialPax: 5,
        remainingPax: 5,
      })
      .returning()
    if (!slot) throw new Error("seedSlot: insert returned no rows")

    const reserved = await bookingsService.reserveBooking(db, {
      bookingNumber: nextNumber(),
      sellCurrency: "USD",
      sourceType: "manual",
      holdMinutes: 30,
      items: [
        {
          title: "Confirmation seat",
          itemType: "unit",
          quantity: 1,
          sellCurrency: "USD",
          allocationType: "unit",
          availabilitySlotId: slot.id,
        },
      ],
    })
    if (reserved.status !== "ok" || !reserved.booking) {
      throw new Error("seedHeldBooking: reserve failed")
    }
    return reserved.booking
  }

  it("two concurrent confirms — exactly one transitions to confirmed, the other sees invalid_transition", async () => {
    const booking = await seedHeldBooking()

    const [a, b] = await Promise.all([
      bookingsService.confirmBooking(db, booking.id, {}),
      bookingsService.confirmBooking(db, booking.id, {}),
    ])

    const okResults = [a, b].filter((r) => r.status === "ok")
    const losers = [a, b].filter((r) => r.status === "invalid_transition")
    expect(okResults).toHaveLength(1)
    expect(losers).toHaveLength(1)
  })
})
