import { describe, expect, it } from "vitest"

import { createDemoAdapter, DEMO_SOURCE_KIND } from "../../src/adapter.js"

const stubDb: unknown = {
  // The adapter's static surface (kind, capabilities) doesn't touch the
  // DB — these tests assert that surface without spinning up Postgres.
  // Lifecycle methods (discover/liveResolve/reserve/cancel) get full
  // integration coverage in the booking-engine package once it's wired
  // up; this file deliberately stays scoped to the static contract.
}

describe("createDemoAdapter", () => {
  it('declares source.kind = "demo"', () => {
    const adapter = createDemoAdapter({ getDb: () => stubDb as never })
    expect(adapter.kind).toBe(DEMO_SOURCE_KIND)
    expect(adapter.kind).toBe("demo")
  })

  it("defaults to feeding the products vertical", () => {
    const adapter = createDemoAdapter({ getDb: () => stubDb as never })
    expect(adapter.capabilities.verticals).toEqual(["products"])
  })

  it("respects a custom vertical list", () => {
    const adapter = createDemoAdapter({
      getDb: () => stubDb as never,
      verticals: ["products", "extras"],
    })
    expect(adapter.capabilities.verticals).toEqual(["products", "extras"])
  })

  it("declares the booking-forwarding capability", () => {
    const adapter = createDemoAdapter({ getDb: () => stubDb as never })
    expect(adapter.capabilities.supportsBookingForwarding).toBe(true)
    expect(adapter.capabilities.supportsLiveResolution).toBe(true)
    expect(adapter.capabilities.supportsDriftDetection).toBe(false)
  })

  it("supports cancel + status post-book operations", () => {
    const adapter = createDemoAdapter({ getDb: () => stubDb as never })
    expect(adapter.capabilities.postBookOperations).toEqual(["cancel", "status"])
  })

  it("connect / pause / disconnect are no-ops that resolve", async () => {
    const adapter = createDemoAdapter({ getDb: () => stubDb as never })
    const ctx = { connection_id: "test" }
    await expect(adapter.connect(ctx)).resolves.toBeUndefined()
    await expect(adapter.pause(ctx)).resolves.toBeUndefined()
    await expect(adapter.disconnect(ctx)).resolves.toBeUndefined()
  })

  it("reports `active` state without consulting upstream", async () => {
    const adapter = createDemoAdapter({ getDb: () => stubDb as never })
    await expect(adapter.getState({ connection_id: "test" })).resolves.toBe("active")
  })
})
