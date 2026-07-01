import { describe, expect, it } from "vitest"

import { updatePolicyRuleSchema, updatePolicySchema } from "./validation.js"

describe("policy update validation", () => {
  it("does not apply create defaults to partial policy updates", () => {
    expect(updatePolicySchema.parse({ description: "Updated" })).toEqual({
      description: "Updated",
    })
  })

  it("does not apply create defaults to partial policy rule updates", () => {
    expect(updatePolicyRuleSchema.parse({ label: "Updated" })).toEqual({
      label: "Updated",
    })
  })
})
