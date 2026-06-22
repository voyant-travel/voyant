import { describe, expect, it } from "vitest"

import { resolveRealtimeCapabilities } from "../../src/capabilities.js"

describe("resolveRealtimeCapabilities", () => {
  it("returns nothing for an unauthenticated context", () => {
    expect(resolveRealtimeCapabilities({ actor: undefined, userId: undefined })).toEqual({})
    expect(resolveRealtimeCapabilities({ actor: "staff", userId: undefined })).toEqual({})
  })

  it("grants staff broad admin + wildcard booking scope", () => {
    const caps = resolveRealtimeCapabilities({ actor: "staff", userId: "usr_admin" })
    expect(caps).toEqual({
      admin: ["subscribe"],
      "booking:*": ["subscribe"],
      "notifications:user:usr_admin": ["subscribe", "presence"],
    })
  })

  it("grants a portal session only its own person + owned bookings", () => {
    const caps = resolveRealtimeCapabilities({
      actor: "customer",
      userId: "usr_cust",
      portalScope: { personId: "per_9", bookingIds: ["bk_1", "bk_2"] },
    })
    expect(caps).toEqual({
      "notifications:user:usr_cust": ["subscribe"],
      "portal:customer:per_9": ["subscribe", "presence"],
      "booking:bk_1": ["subscribe"],
      "booking:bk_2": ["subscribe"],
    })
    // No admin or wildcard booking scope leaks to the portal.
    expect(caps.admin).toBeUndefined()
    expect(caps["booking:*"]).toBeUndefined()
  })

  it("falls back to only the personal channel when portal scope is unresolved", () => {
    const caps = resolveRealtimeCapabilities({ actor: "customer", userId: "usr_cust" })
    expect(caps).toEqual({ "notifications:user:usr_cust": ["subscribe"] })
  })
})
