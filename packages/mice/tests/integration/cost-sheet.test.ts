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

  it("aggregates room/space/session costs into a P&L with margin", async () => {
    const program = await createProgram(db, { name: "Acme Summit" })

    // Room block: net 10000 / sell 15000, two nights, 5 held / 2 picked.
    const [roomType] = await db
      .insert(roomTypes)
      .values({ propertyId: "prop_x", name: "King" })
      .returning()
    const [rb] = await db
      .insert(roomBlocks)
      .values({
        programId: program.id,
        roomTypeId: roomType!.id,
        name: "HQ Hotel",
        currency: "EUR",
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

    // Space block: net 20000 / sell 30000, two slots, 3 held / 1 picked.
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
        programId: program.id,
        functionSpaceId: fs!.id,
        name: "Plenary",
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

    // Session inclusion: 2 × 5000.
    const [session] = await db
      .insert(programSessions)
      .values({ programId: program.id, title: "Gala" })
      .returning()
    await db
      .insert(sessionInclusions)
      .values({ sessionId: session!.id, kind: "fnb", quantity: 2, costAmountCents: 5000 })

    const sheet = await getProgramCostSheet(db, program.id)

    // Room: contracted 5×10000×2=100000; picked cost 2×10000×2=40000; sell 2×15000×2=60000.
    expect(sheet.roomBlocks.contractedCostCents).toBe(100000)
    expect(sheet.roomBlocks.pickedCostCents).toBe(40000)
    expect(sheet.roomBlocks.pickedSellCents).toBe(60000)
    // Space: picked cost 1×20000×2=40000; sell 1×30000×2=60000.
    expect(sheet.spaceBlocks.pickedCostCents).toBe(40000)
    expect(sheet.spaceBlocks.pickedSellCents).toBe(60000)
    // Inclusions: 2×5000=10000.
    expect(sheet.sessionInclusionsCostCents).toBe(10000)
    // Totals: cost 40000+40000+10000=90000; sell 120000; margin 30000; 25%.
    expect(sheet.totals.costCents).toBe(90000)
    expect(sheet.totals.sellCents).toBe(120000)
    expect(sheet.totals.marginCents).toBe(30000)
    expect(sheet.totals.marginPct).toBe(25)
  })

  it("returns zeros + null margin for a program with no inventory", async () => {
    const program = await createProgram(db, { name: "Empty" })
    const sheet = await getProgramCostSheet(db, program.id)
    expect(sheet.totals.costCents).toBe(0)
    expect(sheet.totals.sellCents).toBe(0)
    expect(sheet.totals.marginPct).toBeNull()
  })
})
