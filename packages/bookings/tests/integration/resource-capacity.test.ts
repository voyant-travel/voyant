import { sql } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { createBookingPiiService } from "../../src/pii.js"
import { bookings, bookingTravelers } from "../../src/schema.js"
import { bookingsService } from "../../src/service.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

let seq = 0
function nextBookingNumber() {
  seq++
  return `BK-RES-${String(seq).padStart(6, "0")}`
}

describe.skipIf(!DB_AVAILABLE)(
  "createTravelerWithTravelDetails enforces per-resource capacity",
  () => {
    // biome-ignore lint/suspicious/noExplicitAny: drizzle test client
    let db: any

    beforeAll(async () => {
      const { createTestDb, cleanupTestDb } = await import("@voyantjs/db/test-utils")
      db = createTestDb()
      await cleanupTestDb(db)
      await db.execute(sql`DROP TABLE IF EXISTS booking_traveler_travel_details CASCADE`)
      await db.execute(sql`
        CREATE TABLE booking_traveler_travel_details (
          traveler_id text PRIMARY KEY NOT NULL REFERENCES booking_travelers(id) ON DELETE cascade,
          identity_encrypted jsonb,
          dietary_encrypted jsonb,
          accessibility_encrypted jsonb,
          document_person_document_id text,
          is_lead_traveler boolean DEFAULT false NOT NULL,
          sharing_group_id text,
          room_type_id text,
          bed_preference text,
          allocations jsonb DEFAULT '{}'::jsonb NOT NULL,
          created_at timestamp with time zone DEFAULT now() NOT NULL,
          updated_at timestamp with time zone DEFAULT now() NOT NULL
        )
      `)
    })

    beforeEach(async () => {
      seq = 0
      const { cleanupTestDb } = await import("@voyantjs/db/test-utils")
      await cleanupTestDb(db)
    })

    afterAll(async () => {
      const { closeTestDb } = await import("@voyantjs/db/test-utils")
      await closeTestDb()
    })

    async function buildPii() {
      const { generateEnvKmsKey, EnvKmsProvider } = await import("@voyantjs/utils")
      return createBookingPiiService({
        kms: new EnvKmsProvider({ key: generateEnvKmsKey() }),
      })
    }

    async function seedSlot(input: { slotId: string; productId: string }) {
      await db.execute(sql`
        INSERT INTO availability_slots (
          id, product_id, date_local, starts_at, timezone, status, unlimited, remaining_pax
        ) VALUES (
          ${input.slotId},
          ${input.productId},
          '2026-06-01',
          '2026-06-01 08:00:00+00',
          'UTC',
          'open',
          false,
          10
        )
      `)
    }

    async function seedResource(input: {
      resourceId: string
      slotId: string
      kind: string
      capacity: number
    }) {
      await db.execute(sql`
        INSERT INTO allocation_resources (id, slot_id, kind, capacity, sort_order, flags)
        VALUES (${input.resourceId}, ${input.slotId}, ${input.kind}, ${input.capacity}, 0, '{}'::jsonb)
      `)
    }

    async function seedBookingOnSlot(input: { slotId: string }): Promise<string> {
      const [booking] = await db
        .insert(bookings)
        .values({ bookingNumber: nextBookingNumber(), sellCurrency: "EUR" })
        .returning()
      await db.execute(sql`
        INSERT INTO booking_allocations (id, booking_id, availability_slot_id, quantity, allocation_type, status)
        VALUES (
          'balc_' || substr(md5(random()::text), 1, 24),
          ${booking.id},
          ${input.slotId},
          1,
          'unit',
          'confirmed'
        )
      `)
      return booking.id
    }

    it("rejects assigning a traveler to a resource at capacity", async () => {
      const slotId = "slot_capacity_test_1"
      const resourceId = "alrs_dbl_test_1"
      await seedSlot({ slotId, productId: "prod_test_1" })
      await seedResource({ resourceId, slotId, kind: "room", capacity: 1 })

      const bookingA = await seedBookingOnSlot({ slotId })
      const [travelerA] = await db
        .insert(bookingTravelers)
        .values({
          bookingId: bookingA,
          firstName: "Alpha",
          lastName: "One",
          participantType: "traveler",
        })
        .returning()
      const pii = await buildPii()
      await pii.upsertTravelerTravelDetails(db, travelerA.id, {
        allocations: { room: resourceId },
      })

      const bookingB = await seedBookingOnSlot({ slotId })
      await expect(
        bookingsService.createTravelerWithTravelDetails(
          db,
          bookingB,
          {
            firstName: "Bravo",
            lastName: "Two",
            participantType: "traveler",
            allocations: { room: resourceId },
          },
          { pii },
        ),
      ).rejects.toMatchObject({ code: "resource_capacity_exhausted" })
    })

    it("allows re-saving the same traveler against the same resource", async () => {
      const slotId = "slot_capacity_test_2"
      const resourceId = "alrs_dbl_test_2"
      await seedSlot({ slotId, productId: "prod_test_2" })
      await seedResource({ resourceId, slotId, kind: "room", capacity: 2 })

      const bookingId = await seedBookingOnSlot({ slotId })
      const pii = await buildPii()
      const created = await bookingsService.createTravelerWithTravelDetails(
        db,
        bookingId,
        {
          firstName: "Charlie",
          lastName: "Three",
          participantType: "traveler",
          allocations: { room: resourceId },
        },
        { pii },
      )
      expect(created?.traveler.id).toBeDefined()

      // Re-saving the same traveler is idempotent — the existing
      // assignment is excluded from the capacity check.
      const updated = await bookingsService.updateTravelerWithTravelDetails(
        db,
        created!.traveler.id,
        { firstName: "Charlie", allocations: { room: resourceId } },
        { pii },
      )
      expect(updated?.traveler.id).toBe(created!.traveler.id)
    })
  },
)
