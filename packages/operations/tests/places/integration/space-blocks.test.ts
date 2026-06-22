import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { facilities } from "../../../src/places/schema.js"
import { functionSpaces } from "../../../src/places/schema-function-spaces.js"
import { spaceBlockSlots } from "../../../src/places/schema-space-blocks.js"
import { spaceBlockService } from "../../../src/places/service-space-blocks.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL
const DATES = { startDate: "2026-10-01", endDate: "2026-10-03" } // 2 slot-days

describe.skipIf(!DB_AVAILABLE)("space-block allotment service", () => {
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

  async function seedBlock(unitsPerSlot = 3) {
    const [facility] = await db
      .insert(facilities)
      .values({ kind: "venue", name: "Convention Centre" })
      .returning()
    if (!facility) throw new Error("seed facility failed")
    const [space] = await db
      .insert(functionSpaces)
      .values({ facilityId: facility.id, name: "Ballroom" })
      .returning()
    if (!space) throw new Error("seed space failed")
    const created = await spaceBlockService.createSpaceBlock(db, {
      functionSpaceId: space.id,
      name: "Conference Hold",
    })
    if (created.status !== "ok") throw new Error("create block failed")
    await db.insert(spaceBlockSlots).values(
      ["2026-10-01", "2026-10-02"].map((date) => ({
        blockId: created.block.id,
        date,
        unitsHeld: unitsPerSlot,
      })),
    )
    return { space, block: created.block }
  }

  it("returns function_space_not_found for a stale functionSpaceId", async () => {
    const outcome = await spaceBlockService.createSpaceBlock(db, {
      functionSpaceId: "fnsp_nope",
      name: "x",
    })
    expect(outcome.status).toBe("function_space_not_found")
  })

  it("picks up units and decrements remaining, rejecting oversell", async () => {
    const { block } = await seedBlock(3)
    const ok = await spaceBlockService.pickupSpaceBlock(db, {
      blockId: block.id,
      ...DATES,
      units: 2,
    })
    expect(ok.status).toBe("ok")
    let summary = await spaceBlockService.summarizeSpaceBlock(db, block.id)
    expect(summary?.totalPickedUp).toBe(4) // 2 units × 2 days
    expect(summary?.pickupProgress).toBe("partial")

    const oversell = await spaceBlockService.pickupSpaceBlock(db, {
      blockId: block.id,
      ...DATES,
      units: 2,
    })
    expect(oversell.status).toBe("slot_unavailable") // only 1 remaining per slot
    summary = await spaceBlockService.summarizeSpaceBlock(db, block.id)
    expect(summary?.totalPickedUp).toBe(4)
  })

  it("is idempotent on sessionId and reverses scoped to the block", async () => {
    const a = await seedBlock(3)
    const b = await seedBlock(3)
    const input = { blockId: a.block.id, sessionId: "mpss_x", ...DATES, units: 1 }
    const first = await spaceBlockService.pickupSpaceBlock(db, input)
    const second = await spaceBlockService.pickupSpaceBlock(db, input)
    expect(first.status).toBe("ok")
    if (second.status === "ok") expect(second.idempotent).toBe(true)

    // Same session against a DIFFERENT block is a conflict, not a path-scoped
    // no-op satisfied by block A's pickup.
    const conflict = await spaceBlockService.pickupSpaceBlock(db, {
      blockId: b.block.id,
      sessionId: "mpss_x",
      ...DATES,
      units: 1,
    })
    expect(conflict.status).toBe("session_conflict")
    expect((await spaceBlockService.summarizeSpaceBlock(db, b.block.id))?.totalPickedUp).toBe(0)

    // Reversing under block B must not touch block A.
    const wrong = await spaceBlockService.reverseSpaceBlockPickup(db, {
      blockId: b.block.id,
      sessionId: "mpss_x",
    })
    expect(wrong.status).toBe("pickup_not_found")
    expect((await spaceBlockService.summarizeSpaceBlock(db, a.block.id))?.totalPickedUp).toBe(2)
  })

  it("releases unpicked units at cutoff and closes the block", async () => {
    const { block } = await seedBlock(3)
    await spaceBlockService.pickupSpaceBlock(db, { blockId: block.id, ...DATES, units: 1 })
    const cutoff = await spaceBlockService.releaseSpaceBlockAtCutoff(db, { blockId: block.id })
    expect(cutoff.status).toBe("ok")
    if (cutoff.status === "ok") {
      expect(cutoff.releasedUnits).toBe(4) // (3 − 1) × 2 days
      expect(cutoff.block.status).toBe("released")
    }
    const summary = await spaceBlockService.summarizeSpaceBlock(db, block.id)
    expect(summary?.totalRemaining).toBe(0)
    expect(summary?.pickupProgress).toBe("full")
  })
})
