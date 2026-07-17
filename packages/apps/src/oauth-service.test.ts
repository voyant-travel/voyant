import { describe, expect, it } from "vitest"
import { intersectAppTokenScopes } from "./oauth-service.js"

describe("app OAuth online token scope intersection", () => {
  it("never exceeds either app grants, viewer grants, or contextual restrictions", () => {
    expect(
      intersectAppTokenScopes(
        ["bookings:read", "invoices:read"],
        ["bookings:read", "customers:read"],
        ["bookings:read", "invoices:read"],
      ),
    ).toEqual(["bookings:read"])

    expect(
      intersectAppTokenScopes(
        ["bookings:read"],
        ["bookings:read", "invoices:read"],
        ["bookings:read", "invoices:read"],
      ),
    ).toEqual(["bookings:read"])
  })
})
