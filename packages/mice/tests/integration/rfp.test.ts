import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { createProgram } from "../../src/service.js"
import {
  awardRfp,
  createBid,
  createRfp,
  getBid,
  inviteSupplier,
  listBids,
} from "../../src/service-rfp.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

describe.skipIf(!DB_AVAILABLE)("mice RFP → bid → award", () => {
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

  it("rejects an RFP for a stale program", async () => {
    const outcome = await createRfp(db, { programId: "prog_nope", title: "Venue RFP" })
    expect(outcome.status).toBe("program_not_found")
  })

  it("invites suppliers idempotently", async () => {
    const program = await createProgram(db, { name: "Acme Summit" })
    const rfp = await createRfp(db, { programId: program.id, title: "Venue RFP" })
    if (rfp.status !== "ok") throw new Error("rfp create failed")
    const first = await inviteSupplier(db, rfp.rfp.id, { supplierId: "sup_1" })
    const second = await inviteSupplier(db, rfp.rfp.id, { supplierId: "sup_1" })
    expect(first.status).toBe("ok")
    if (second.status === "ok") expect(second.idempotent).toBe(true)
    const missing = await inviteSupplier(db, "mrfp_nope", { supplierId: "sup_1" })
    expect(missing.status).toBe("rfp_not_found")
  })

  it("awards a bid: winner accepted, others rejected, RFP awarded", async () => {
    const program = await createProgram(db, { name: "Acme Summit" })
    const rfp = await createRfp(db, { programId: program.id, title: "Venue RFP" })
    if (rfp.status !== "ok") throw new Error("rfp create failed")
    const a = await createBid(db, rfp.rfp.id, { supplierId: "sup_a", totalCents: 100000 })
    const b = await createBid(db, rfp.rfp.id, { supplierId: "sup_b", totalCents: 90000 })
    if (a.status !== "ok" || b.status !== "ok") throw new Error("bid create failed")

    const award = await awardRfp(db, rfp.rfp.id, b.bid.id)
    expect(award.status).toBe("ok")
    if (award.status === "ok") {
      expect(award.rfp.status).toBe("awarded")
      expect(award.bid.status).toBe("accepted")
    }
    expect((await getBid(db, a.bid.id))?.status).toBe("rejected")
    expect((await getBid(db, b.bid.id))?.status).toBe("accepted")
    expect((await listBids(db, rfp.rfp.id)).filter((x) => x.status === "accepted")).toHaveLength(1)

    // Re-award is rejected; an unrelated bid id is not found on this RFP.
    expect((await awardRfp(db, rfp.rfp.id, a.bid.id)).status).toBe("already_awarded")
    const other = await createRfp(db, { programId: program.id, title: "Catering RFP" })
    if (other.status !== "ok") throw new Error("rfp create failed")
    expect((await awardRfp(db, other.rfp.id, b.bid.id)).status).toBe("bid_not_found")
  })
})
