import { describe, expect, it } from "vitest"
import { readPolicySourceFromInternalNotes } from "./booking-payment-policy-runtime"

describe("readPolicySourceFromInternalNotes", () => {
  it("returns the stamped payment policy source", () => {
    expect(
      readPolicySourceFromInternalNotes(
        ["customer note", "__payment_policy_source__:supplier", "other note"].join("\n"),
      ),
    ).toBe("supplier")
  })

  it("ignores unknown or missing policy source markers", () => {
    expect(readPolicySourceFromInternalNotes("__payment_policy_source__:legacy")).toBeNull()
    expect(readPolicySourceFromInternalNotes("customer note")).toBeNull()
    expect(readPolicySourceFromInternalNotes(null)).toBeNull()
  })
})
