import { roomBlockNights, roomBlocks, roomTypes } from "@voyant-travel/accommodations/schema"
import { facilities, functionSpaces, spaceBlockSlots, spaceBlocks } from "@voyant-travel/operations"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { programSessions, sessionInclusions } from "../../src/schema-sessions.js"
import { createProgram } from "../../src/service.js"
import { getProgramCostSheet } from "../../src/service-commercials.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

describe.skipIf(!DB_AVAILABLE)("mice program cost sheet", () => {
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

  async function seedRoomBlock(programId: string, currency: string) {
    const [roomType] = await db
      .insert(roomTypes)
      .values({ propertyId: "prop_x", name: "King" })
      .returning()
    const [rb] = await db
      .insert(roomBlocks)
      .values({
        programId,
        roomTypeId: roomType!.id,
        name: "HQ Hotel",
        currency,
        netRateCents: 10000,
        sellRateCents: 15000,
      })
      .returning()
    await db.insert(roomBlockNights).values(
      ["2026-11-01", "2026-11-02"].map((date) => ({
        blockId: rb!.id,
        date,
        roomsHeld: 5,
        roomsPickedUp: 2,
      })),
    )
  }

  async function seedSpaceBlock(programId: string, currency: string) {
    const [facility] = await db
      .insert(facilities)
      .values({ kind: "venue", name: "Centre" })
      .returning()
    const [fs] = await db
      .insert(functionSpaces)
      .values({ facilityId: facility!.id, name: "Ballroom" })
      .returning()
    const [sb] = await db
      .insert(spaceBlocks)
      .values({
        programId,
        functionSpaceId: fs!.id,
        name: "Plenary",
        currency,
        netRateCents: 20000,
        sellRateCents: 30000,
      })
      .returning()
    await db.insert(spaceBlockSlots).values(
      ["2026-11-01", "2026-11-02"].map((date) => ({
        blockId: sb!.id,
        date,
        unitsHeld: 3,
        unitsPickedUp: 1,
      })),
    )
  }

  it("aggregates a single-currency program into one P&L bucket with margin", async () => {
    const program = await createProgram(db, { name: "Acme Summit", currency: "EUR" })
    await seedRoomBlock(program.id, "EUR")
    await seedSpaceBlock(program.id, "EUR")
    const [session] = await db
      .insert(programSessions)
      .values({ programId: program.id, title: "Gala" })
      .returning()
    await db.insert(sessionInclusions).values({
      sessionId: session!.id,
      kind: "fnb",
      quantity: 2,
      costAmountCents: 5000,
      currency: "EUR",
    })

    const sheet = await getProgramCostSheet(db, program.id)
    expect(sheet.mixedCurrency).toBe(false)
    expect(sheet.byCurrency).toHaveLength(1)
    const eur = sheet.byCurrency[0]!
    expect(eur.currency).toBe("EUR")
    expect(eur.roomBlocks.contractedCostCents).toBe(100000) // 5×10000×2
    expect(eur.roomBlocks.pickedCostCents).toBe(40000) // 2×10000×2
    expect(eur.roomBlocks.pickedSellCents).toBe(60000) // 2×15000×2
    expect(eur.spaceBlocks.pickedCostCents).toBe(40000) // 1×20000×2
    expect(eur.spaceBlocks.pickedSellCents).toBe(60000) // 1×30000×2
    expect(eur.sessionInclusionsCostCents).toBe(10000) // 2×5000
    expect(eur.costCents).toBe(90000)
    expect(eur.sellCents).toBe(120000)
    expect(eur.marginCents).toBe(30000)
    expect(eur.marginPct).toBe(25)
  })

  it("groups a mixed-currency program by currency without summing across them", async () => {
    const program = await createProgram(db, { name: "Global Summit", currency: "EUR" })
    await seedRoomBlock(program.id, "EUR")
    await seedSpaceBlock(program.id, "USD")

    const sheet = await getProgramCostSheet(db, program.id)
    expect(sheet.mixedCurrency).toBe(true)
    expect(sheet.byCurrency.map((c) => c.currency)).toEqual(["EUR", "USD"])
    const eur = sheet.byCurrency.find((c) => c.currency === "EUR")!
    const usd = sheet.byCurrency.find((c) => c.currency === "USD")!
    expect(eur.roomBlocks.pickedCostCents).toBe(40000)
    expect(eur.spaceBlocks.pickedCostCents).toBe(0)
    expect(usd.spaceBlocks.pickedCostCents).toBe(40000)
    expect(usd.roomBlocks.pickedCostCents).toBe(0)
  })

  it("returns no buckets for a program with no inventory", async () => {
    const program = await createProgram(db, { name: "Empty", currency: "EUR" })
    const sheet = await getProgramCostSheet(db, program.id)
    expect(sheet.mixedCurrency).toBe(false)
    expect(sheet.byCurrency).toHaveLength(0)
  })
})
