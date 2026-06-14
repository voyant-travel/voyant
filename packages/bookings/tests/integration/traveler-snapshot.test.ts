import { eq, sql } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { applyTravelDetailSnapshot, createBookingPiiService } from "../../src/pii.js"
import { bookingTravelerTravelDetails } from "../../src/schema/travel-details.js"
import { bookings, bookingTravelers } from "../../src/schema.js"
import { bookingsService } from "../../src/service.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

let seq = 0
function nextBookingNumber() {
  seq++
  return `BK-SNAP-${String(seq).padStart(6, "0")}`
}

describe("applyTravelDetailSnapshot (pure)", () => {
  it("fills empty fields with snapshot values", () => {
    const merged = applyTravelDetailSnapshot(
      {},
      {
        dietaryRequirements: "Vegan",
        accessibilityNeeds: "Step-free",
        documentNumber: "AA1",
        documentExpiry: "2030-01-01",
        documentIssuingCountry: "RO",
        documentIssuingAuthority: "IGI",
        documentPersonDocumentId: "pdoc_1",
        dateOfBirth: "1990-01-01",
      },
    )
    expect(merged.dietaryRequirements).toBe("Vegan")
    expect(merged.documentNumber).toBe("AA1")
    expect(merged.documentPersonDocumentId).toBe("pdoc_1")
    expect(merged.dateOfBirth).toBe("1990-01-01")
  })

  it("explicit input always wins (even null)", () => {
    const merged = applyTravelDetailSnapshot(
      { dietaryRequirements: null, documentNumber: "BB2" },
      { dietaryRequirements: "Vegan", documentNumber: "AA1" },
    )
    expect(merged.dietaryRequirements).toBeNull()
    expect(merged.documentNumber).toBe("BB2")
  })

  it("returns input untouched when snapshot is null", () => {
    const input = { documentNumber: "AA1" }
    expect(applyTravelDetailSnapshot(input, null)).toEqual(input)
    expect(applyTravelDetailSnapshot(input, undefined)).toEqual(input)
  })
})

describe.skipIf(!DB_AVAILABLE)("createTravelerWithTravelDetails snapshot wiring", () => {
  // biome-ignore lint/suspicious/noExplicitAny: issue #695; test db helpers return a broad Drizzle client type.
  let db: any

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyant-travel/db/test-utils")
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
    await db.execute(
      sql`CREATE INDEX idx_bttd_lead_traveler ON booking_traveler_travel_details (is_lead_traveler)`,
    )
    await db.execute(
      sql`CREATE INDEX idx_bttd_sharing_group ON booking_traveler_travel_details (sharing_group_id)`,
    )
  })

  beforeEach(async () => {
    seq = 0
    const { cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    await cleanupTestDb(db)
  })

  afterAll(async () => {
    const { closeTestDb } = await import("@voyant-travel/db/test-utils")
    await closeTestDb()
  })

  async function seedBooking() {
    const [booking] = await db
      .insert(bookings)
      .values({ bookingNumber: nextBookingNumber(), sellCurrency: "EUR" })
      .returning()
    return booking
  }

  async function buildPii() {
    const { generateEnvKmsKey, EnvKmsProvider } = await import("@voyant-travel/utils")
    return createBookingPiiService({
      kms: new EnvKmsProvider({ key: generateEnvKmsKey() }),
    })
  }

  it("snapshots dietary/accessibility/passport from the resolver when personId is set", async () => {
    const booking = await seedBooking()
    const pii = await buildPii()

    const result = await bookingsService.createTravelerWithTravelDetails(
      db,
      booking.id,
      {
        firstName: "Snapshot",
        lastName: "Traveler",
        participantType: "traveler",
        personId: "pers_test",
      },
      {
        pii,
        actorId: "test",
        resolveTravelSnapshot: async (personId) => {
          expect(personId).toBe("pers_test")
          return {
            dietaryRequirements: "Vegan",
            accessibilityNeeds: "Step-free",
            documentNumber: "AA111",
            documentExpiry: "2030-12-31",
            documentIssuingCountry: "RO",
            documentIssuingAuthority: "IGI",
            documentPersonDocumentId: "pdoc_test",
            dateOfBirth: "1990-04-15",
          }
        },
      },
    )

    expect(result?.travelDetails?.dietaryRequirements).toBe("Vegan")
    expect(result?.travelDetails?.accessibilityNeeds).toBe("Step-free")
    expect(result?.travelDetails?.documentNumber).toBe("AA111")
    expect(result?.travelDetails?.documentExpiry).toBe("2030-12-31")
    expect(result?.travelDetails?.documentIssuingCountry).toBe("RO")
    expect(result?.travelDetails?.documentIssuingAuthority).toBe("IGI")
    expect(result?.travelDetails?.documentPersonDocumentId).toBe("pdoc_test")
    expect(result?.travelDetails?.dateOfBirth).toBe("1990-04-15")

    // Provenance column is plaintext in storage.
    const [stored] = await db
      .select()
      .from(bookingTravelerTravelDetails)
      .where(eq(bookingTravelerTravelDetails.travelerId, result!.traveler.id))
    expect(stored?.documentPersonDocumentId).toBe("pdoc_test")
  }, 20000)

  it("explicit input wins over snapshot values", async () => {
    const booking = await seedBooking()
    const pii = await buildPii()

    const result = await bookingsService.createTravelerWithTravelDetails(
      db,
      booking.id,
      {
        firstName: "Explicit",
        lastName: "Wins",
        participantType: "traveler",
        personId: "pers_test",
        documentNumber: "OVERRIDE",
        dietaryRequirements: "Halal",
      },
      {
        pii,
        actorId: "test",
        resolveTravelSnapshot: async () => ({
          documentNumber: "AA111",
          dietaryRequirements: "Vegan",
          accessibilityNeeds: "Step-free",
        }),
      },
    )

    expect(result?.travelDetails?.documentNumber).toBe("OVERRIDE")
    expect(result?.travelDetails?.dietaryRequirements).toBe("Halal")
    // Snapshot still fills the unspecified field.
    expect(result?.travelDetails?.accessibilityNeeds).toBe("Step-free")
  }, 20000)

  it("does not invoke the resolver when personId is missing", async () => {
    const booking = await seedBooking()
    const pii = await buildPii()
    let resolverCalls = 0

    const result = await bookingsService.createTravelerWithTravelDetails(
      db,
      booking.id,
      {
        firstName: "Anon",
        lastName: "Walk-in",
        participantType: "traveler",
        documentNumber: "manual-only",
      },
      {
        pii,
        actorId: "test",
        resolveTravelSnapshot: async () => {
          resolverCalls += 1
          return {
            documentNumber: "AA111",
            dietaryRequirements: "Vegan",
          }
        },
      },
    )

    expect(resolverCalls).toBe(0)
    expect(result?.travelDetails?.documentNumber).toBe("manual-only")
    expect(result?.travelDetails?.dietaryRequirements).toBeNull()
  }, 20000)

  it("skips fields the resolver doesn't return", async () => {
    const booking = await seedBooking()
    const pii = await buildPii()

    const result = await bookingsService.createTravelerWithTravelDetails(
      db,
      booking.id,
      {
        firstName: "Partial",
        lastName: "Snapshot",
        participantType: "traveler",
        personId: "pers_test",
      },
      {
        pii,
        actorId: "test",
        resolveTravelSnapshot: async () => ({
          dietaryRequirements: "Vegan",
          // No passport — person hasn't uploaded one yet.
        }),
      },
    )

    expect(result?.travelDetails?.dietaryRequirements).toBe("Vegan")
    expect(result?.travelDetails?.documentNumber).toBeNull()
    expect(result?.travelDetails?.documentPersonDocumentId).toBeNull()

    // Plaintext booking-traveler row still exists.
    const [traveler] = await db
      .select()
      .from(bookingTravelers)
      .where(eq(bookingTravelers.id, result!.traveler.id))
    expect(traveler?.personId).toBe("pers_test")
  }, 20000)
})
