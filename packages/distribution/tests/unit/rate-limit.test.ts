import { describe, expect, it } from "vitest"

import { channelScopeKey, DEFAULT_PRIORITY_GATES } from "../../src/rate-limit.js"

describe("channelScopeKey", () => {
  it("formats as channel:<channel_id>:<connection_id>", () => {
    expect(channelScopeKey("ch_xxx", "conn_yyy")).toBe("channel:ch_xxx:conn_yyy")
  })

  it("is stable across calls (idempotent)", () => {
    expect(channelScopeKey("ch_a", "conn_b")).toBe(channelScopeKey("ch_a", "conn_b"))
  })
})

describe("DEFAULT_PRIORITY_GATES", () => {
  it("orders bookings before availability before content", () => {
    expect(DEFAULT_PRIORITY_GATES.booking).toBeLessThan(DEFAULT_PRIORITY_GATES.availability)
    expect(DEFAULT_PRIORITY_GATES.availability).toBeLessThan(DEFAULT_PRIORITY_GATES.content)
  })

  it("bookings dispatch with any tokens (gate = 0)", () => {
    expect(DEFAULT_PRIORITY_GATES.booking).toBe(0)
  })
})
