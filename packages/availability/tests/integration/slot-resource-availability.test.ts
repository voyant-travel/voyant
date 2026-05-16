import { newId } from "@voyantjs/db/lib/typeid"
import { cleanupTestDb, createTestDb } from "@voyantjs/db/test-utils"
import { products } from "@voyantjs/products/schema"
import { sql } from "drizzle-orm"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { allocationResources, availabilitySlots } from "../../src/schema.js"
import {
  getSlotAllocationManifest,
  getSlotResourceAvailability,
  validateSlotAllocationCapacity,
} from "../../src/service-allocation.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

describe.skipIf(!DB_AVAILABLE)("slot resource availability (integration)", () => {
  // biome-ignore lint/suspicious/noExplicitAny: drizzle test client
  let db: any
  let productId: string
  let slotId: string

  beforeAll(() => {
    db = createTestDb()
  })

  beforeEach(async () => {
    await cleanupTestDb(db)
    productId = newId("products")
    slotId = newId("availability_slots")
    await db.insert(products).values({
      id: productId,
      name: "Bali Wellness Retreat",
      sellCurrency: "USD",
      bookingMode: "date",
    })
    await db.insert(availabilitySlots).values({
      id: slotId,
      productId,
      dateLocal: "2026-06-01",
      startsAt: new Date("2026-06-01T08:00:00Z"),
      timezone: "UTC",
      status: "open",
      unlimited: false,
      initialPax: 49,
      remainingPax: 49,
    })
  })

  async function seedResource(input: {
    kind: string
    capacity: number
    label: string
    sortOrder?: number
  }) {
    const id = newId("allocation_resources")
    await db.insert(allocationResources).values({
      id,
      slotId,
      kind: input.kind,
      label: input.label,
      capacity: input.capacity,
      sortOrder: input.sortOrder ?? 0,
      flags: {},
    })
    return id
  }

  async function seedBookingWithTraveler(input: {
    travelerId: string
    allocations?: Record<string, string>
  }) {
    const bookingId = newId("bookings")
    await db.execute(sql`
      INSERT INTO bookings (id, booking_number, status, sell_currency)
      VALUES (${bookingId}, ${`B${bookingId.slice(-6)}`}, 'confirmed', 'USD')
    `)
    await db.execute(sql`
      INSERT INTO booking_allocations (id, booking_id, availability_slot_id, quantity, allocation_type, status)
      VALUES (${newId("booking_allocations")}, ${bookingId}, ${slotId}, 1, 'unit', 'confirmed')
    `)
    await db.execute(sql`
      INSERT INTO booking_travelers (id, booking_id, participant_type, first_name, last_name)
      VALUES (${input.travelerId}, ${bookingId}, 'traveler', 'Test', 'Traveler')
    `)
    if (input.allocations) {
      await db.execute(sql`
        INSERT INTO booking_traveler_travel_details (traveler_id, allocations)
        VALUES (${input.travelerId}, ${JSON.stringify(input.allocations)}::jsonb)
      `)
    }
    return bookingId
  }

  it("reports capacity / assigned / available per resource", async () => {
    const dblId = await seedResource({ kind: "room", capacity: 2, label: "DBL 1", sortOrder: 1 })
    const sglId = await seedResource({ kind: "room", capacity: 1, label: "SGL 1", sortOrder: 2 })

    await seedBookingWithTraveler({
      travelerId: newId("booking_travelers"),
      allocations: { room: dblId },
    })

    const manifest = await getSlotResourceAvailability(db, slotId)
    expect(manifest).toHaveLength(2)
    const dbl = manifest.find((r) => r.id === dblId)
    const sgl = manifest.find((r) => r.id === sglId)
    expect(dbl?.assigned).toBe(1)
    expect(dbl?.available).toBe(1)
    expect(sgl?.assigned).toBe(0)
    expect(sgl?.available).toBe(1)
  })

  it("returns a violation when planned travelers exceed resource capacity", async () => {
    const dblId = await seedResource({ kind: "room", capacity: 2, label: "DBL 1" })
    // Two existing travelers in DBL — at capacity.
    await seedBookingWithTraveler({
      travelerId: newId("booking_travelers"),
      allocations: { room: dblId },
    })
    await seedBookingWithTraveler({
      travelerId: newId("booking_travelers"),
      allocations: { room: dblId },
    })

    const plannedTravelerId = newId("booking_travelers")
    const violations = await validateSlotAllocationCapacity(db, slotId, [
      { travelerId: plannedTravelerId, kind: "room", resourceId: dblId },
    ])
    expect(violations).toHaveLength(1)
    expect(violations[0]?.resourceId).toBe(dblId)
    expect(violations[0]?.capacity).toBe(2)
    expect(violations[0]?.existingAssigned).toBe(2)
  })

  it("treats re-saving the same traveler as idempotent", async () => {
    const dblId = await seedResource({ kind: "room", capacity: 2, label: "DBL 1" })
    const travelerId = newId("booking_travelers")
    await seedBookingWithTraveler({
      travelerId,
      allocations: { room: dblId },
    })

    const violations = await validateSlotAllocationCapacity(db, slotId, [
      { travelerId, kind: "room", resourceId: dblId },
    ])
    expect(violations).toEqual([])
  })

  it("flags a resource-kind mismatch as a violation", async () => {
    const dblId = await seedResource({ kind: "room", capacity: 2, label: "DBL 1" })
    const violations = await validateSlotAllocationCapacity(db, slotId, [
      { travelerId: newId("booking_travelers"), kind: "vehicle_seat", resourceId: dblId },
    ])
    expect(violations).toHaveLength(1)
    expect(violations[0]?.kind).toBe("vehicle_seat")
  })

  // Regression for #952 — when a slot had 2+ bookings, the manifest
  // query crashed with `cannot cast type record to text[]` because
  // drizzle's `sql` template spreads JS arrays into a tuple, not a
  // text[] literal. The `sqlTextArray` helper emits `ARRAY[$1, $2,
  // …]::text[]` instead. Single-booking slots happened to work
  // because `(($1)::text[])` evaluates as the lone value.
  it("loads the manifest for a slot with multiple bookings without a record-cast crash", async () => {
    const dblId = await seedResource({ kind: "room", capacity: 4, label: "DBL 1" })
    await seedBookingWithTraveler({
      travelerId: newId("booking_travelers"),
      allocations: { room: dblId },
    })
    await seedBookingWithTraveler({
      travelerId: newId("booking_travelers"),
      allocations: { room: dblId },
    })
    await seedBookingWithTraveler({
      travelerId: newId("booking_travelers"),
    })

    const manifest = await getSlotAllocationManifest(db, slotId)
    expect(manifest).not.toBeNull()
    expect(manifest?.bookings).toHaveLength(3)
    expect(manifest?.summary.travelerCount).toBe(3)
  })

  it("validates allocations across multiple resources without a record-cast crash", async () => {
    const dblId = await seedResource({ kind: "room", capacity: 2, label: "DBL 1" })
    const twnId = await seedResource({ kind: "room", capacity: 2, label: "TWN 1" })
    await seedBookingWithTraveler({
      travelerId: newId("booking_travelers"),
      allocations: { room: dblId },
    })
    await seedBookingWithTraveler({
      travelerId: newId("booking_travelers"),
      allocations: { room: twnId },
    })

    const violations = await validateSlotAllocationCapacity(db, slotId, [
      { travelerId: newId("booking_travelers"), kind: "room", resourceId: dblId },
      { travelerId: newId("booking_travelers"), kind: "room", resourceId: twnId },
    ])
    expect(violations).toEqual([])
  })
})
