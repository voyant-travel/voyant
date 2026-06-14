import { describe, expect, it } from "vitest"

import { addressLabelSchema, contactPointKindSchema, namedContactRoleSchema } from "./index.js"

describe("@voyant-travel/identity-contracts validation", () => {
  it("accepts valid identity enum values", () => {
    expect(contactPointKindSchema.parse("email")).toBe("email")
    expect(addressLabelSchema.parse("billing")).toBe("billing")
    expect(namedContactRoleSchema.parse("reservations")).toBe("reservations")
  })

  it("rejects unknown identity enum values", () => {
    expect(contactPointKindSchema.safeParse("carrier-pigeon").success).toBe(false)
    expect(addressLabelSchema.safeParse("warehouse").success).toBe(false)
    expect(namedContactRoleSchema.safeParse("mascot").success).toBe(false)
  })
})
