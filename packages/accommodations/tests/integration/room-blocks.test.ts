import { bookingItems, bookings } from "@voyant-travel/bookings/schema"
import { and, eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { stayBookingItems } from "../../src/schema-bookings.js"
import { ratePlans, roomTypes } from "../../src/schema-inventory.js"
import { roomBlockNights, roomBlockPickups, roomBlocks } from "../../src/schema-room-blocks.js"
import {
  pickupRoomBlock,
  releaseRoomBlockAtCutoff,
  reverseRoomBlockPickup,
  summarizeRoomBlock,
} from "../../src/service-room-blocks.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

const NIGHTS = ["2026-09-01", "2026-09-02"] as const

describe.skipIf(!DB_AVAILABLE)("room-block allotment service", () => {
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

  /** Seed a room type + a block + two nights (5 rooms held each). */
  async function seedBlock(heldPerNight = 5) {
    const [roomType] = await db
      .insert(roomTypes)
      .values({ propertyId: "prop_rb_test", name: "Standard King" })
      .returning()
    if (!roomType) throw new Error("seed roomType failed")

    const [block] = await db
      .insert(roomBlocks)
      .values({
        roomTypeId: roomType.id,
        propertyId: "prop_rb_test",
        name: "Test Block",
        currency: "EUR",
        status: "confirmed",
      })
      .returning()
    if (!block) throw new Error("seed block failed")

    await db
      .insert(roomBlockNights)
      .values(NIGHTS.map((date) => ({ blockId: block.id, date, roomsHeld: heldPerNight })))

    return { roomType, block }
  }

  /** Seed the booking → bookingItem → stayBookingItem chain for idempotency. */
  async function seedStayBookingItem(roomTypeId: string) {
    const [booking] = await db
      .insert(bookings)
      .values({ bookingNumber: `RB-${Date.now()}`, sellCurrency: "EUR" })
      .returning()
    if (!booking) throw new Error("seed booking failed")
    const [item] = await db
      .insert(bookingItems)
      .values({ bookingId: booking.id, title: "Room", sellCurrency: "EUR" })
      .returning()
    if (!item) throw new Error("seed bookingItem failed")
    const [ratePlan] = await db
      .insert(ratePlans)
      .values({ propertyId: "prop_rb_test", code: "BAR", name: "BAR", currencyCode: "EUR" })
      .returning()
    if (!ratePlan) throw new Error("seed ratePlan failed")
    const [stay] = await db
      .insert(stayBookingItems)
      .values({
        bookingItemId: item.id,
        propertyId: "prop_rb_test",
        roomTypeId,
        ratePlanId: ratePlan.id,
        checkInDate: NIGHTS[0],
        checkOutDate: "2026-09-03",
      })
      .returning()
    if (!stay) throw new Error("seed stayBookingItem failed")
    return stay
  }

  it("picks up rooms and decrements remaining across nights", async () => {
    const { block } = await seedBlock(5)
    const outcome = await pickupRoomBlock(db, {
      blockId: block.id,
      checkIn: NIGHTS[0],
      checkOut: "2026-09-03",
      rooms: 2,
    })
    expect(outcome.status).toBe("ok")

    const summary = await summarizeRoomBlock(db, block.id)
    expect(summary?.totalPickedUp).toBe(4) // 2 rooms × 2 nights
    expect(summary?.totalRemaining).toBe(6) // (5 − 2) × 2 nights
    expect(summary?.pickupProgress).toBe("partial")
  })

  it("rejects an oversell and leaves counters untouched", async () => {
    const { block } = await seedBlock(5)
    const outcome = await pickupRoomBlock(db, {
      blockId: block.id,
      checkIn: NIGHTS[0],
      checkOut: "2026-09-03",
      rooms: 6,
    })
    expect(outcome.status).toBe("night_unavailable")

    const summary = await summarizeRoomBlock(db, block.id)
    expect(summary?.totalPickedUp).toBe(0)
  })

  it("reverses a pickup, returning rooms to remaining (not released)", async () => {
    const { block } = await seedBlock(5)
    const picked = await pickupRoomBlock(db, {
      blockId: block.id,
      checkIn: NIGHTS[0],
      checkOut: "2026-09-03",
      rooms: 2,
    })
    if (picked.status !== "ok") throw new Error("pickup failed")

    const reversal = await reverseRoomBlockPickup(db, { pickupId: picked.pickup.id })
    expect(reversal.status).toBe("ok")

    const summary = await summarizeRoomBlock(db, block.id)
    expect(summary?.totalPickedUp).toBe(0)
    expect(summary?.totalReleased).toBe(0)
    expect(summary?.totalRemaining).toBe(10)
    expect(summary?.pickupProgress).toBe("none")

    const [row] = await db
      .select()
      .from(roomBlockPickups)
      .where(eq(roomBlockPickups.id, picked.pickup.id))
    expect(row?.status).toBe("reversed")
  })

  it("refuses to reverse a pickup that belongs to a different block", async () => {
    const a = await seedBlock(5)
    const b = await seedBlock(5)
    const picked = await pickupRoomBlock(db, {
      blockId: a.block.id,
      checkIn: NIGHTS[0],
      checkOut: "2026-09-03",
      rooms: 2,
    })
    if (picked.status !== "ok") throw new Error("pickup failed")

    // Reversing under block B's id must not touch block A's pickup/counters.
    const wrong = await reverseRoomBlockPickup(db, {
      blockId: b.block.id,
      pickupId: picked.pickup.id,
    })
    expect(wrong.status).toBe("pickup_not_found")

    const summaryA = await summarizeRoomBlock(db, a.block.id)
    expect(summaryA?.totalPickedUp).toBe(4)
  })

  it("is idempotent on stayBookingItemId", async () => {
    const { roomType, block } = await seedBlock(5)
    const stay = await seedStayBookingItem(roomType.id)
    const input = {
      blockId: block.id,
      stayBookingItemId: stay.id,
      checkIn: NIGHTS[0],
      checkOut: "2026-09-03",
      rooms: 1,
    }
    const first = await pickupRoomBlock(db, input)
    const second = await pickupRoomBlock(db, input)
    expect(first.status).toBe("ok")
    expect(second.status).toBe("ok")
    if (second.status === "ok") expect(second.idempotent).toBe(true)

    // Only one active pickup, counters not double-counted.
    const active = await db
      .select()
      .from(roomBlockPickups)
      .where(
        and(eq(roomBlockPickups.stayBookingItemId, stay.id), eq(roomBlockPickups.status, "active")),
      )
    expect(active).toHaveLength(1)
    const summary = await summarizeRoomBlock(db, block.id)
    expect(summary?.totalPickedUp).toBe(2) // 1 room × 2 nights, once
  })

  it("releases unpicked rooms at cutoff and closes the block", async () => {
    const { block } = await seedBlock(5)
    await pickupRoomBlock(db, {
      blockId: block.id,
      checkIn: NIGHTS[0],
      checkOut: "2026-09-03",
      rooms: 2,
    })
    const cutoff = await releaseRoomBlockAtCutoff(db, { blockId: block.id })
    expect(cutoff.status).toBe("ok")
    if (cutoff.status === "ok") {
      expect(cutoff.releasedRooms).toBe(6) // (5 − 2) × 2 nights
      expect(cutoff.block.status).toBe("released")
    }

    const summary = await summarizeRoomBlock(db, block.id)
    expect(summary?.totalReleased).toBe(6)
    expect(summary?.totalPickedUp).toBe(4)
    expect(summary?.totalRemaining).toBe(0)
    expect(summary?.pickupProgress).toBe("full")
  })
})
