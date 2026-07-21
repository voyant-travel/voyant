import { describe, expect, it, vi } from "vitest"

const { expireStaleBookingHolds } = vi.hoisted(() => ({
  expireStaleBookingHolds: vi.fn(async () => ({
    expiredIds: [],
    count: 0,
    cutoff: new Date(0),
  })),
}))
vi.mock("../../src/tasks/expire-stale-holds.js", () => ({ expireStaleBookingHolds }))

import { runBookingsExpireStaleHoldsJob } from "../../src/stale-holds-job.js"

describe("stale booking holds job", () => {
  it("runs without accepting a cutoff payload", async () => {
    const db = {}
    await runBookingsExpireStaleHoldsJob({
      getPort: async () => ({ resolveDb: async () => db, userId: "system" }),
    } as never)
    expect(expireStaleBookingHolds).toHaveBeenCalledWith(db, {}, "system", {})
  })
})
