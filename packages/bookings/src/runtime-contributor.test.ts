import { describe, expect, it, vi } from "vitest"

import { bookingsStaleHoldsJobRuntimePort } from "./stale-holds-job.js"
import { createBookingsRuntimePortContribution } from "./runtime-contributor.js"

describe("createBookingsRuntimePortContribution", () => {
  it("defers dependent port resolution until every contributor is registered", async () => {
    let registered = false
    const staleHoldsRuntime = { run: vi.fn() }
    const contribution = createBookingsRuntimePortContribution({
      primitives: { database: { resolve: vi.fn() } } as never,
      getRuntimePort: () => {
        if (!registered) throw new Error("finance runtime is not registered")
        return { createStaleBookingHoldsJobRuntime: () => staleHoldsRuntime } as never
      },
    })

    registered = true

    await expect(contribution[bookingsStaleHoldsJobRuntimePort.id]).resolves.toBe(
      staleHoldsRuntime,
    )
  })
})
