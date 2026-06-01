import { describe, expect, it } from "vitest"

import { activityTypeSchema, entityTypeSchema, opportunityStatusSchema } from "./index.js"

describe("@voyantjs/crm-contracts validation", () => {
  it("accepts valid enum vocabulary values", () => {
    expect(entityTypeSchema.parse("person")).toBe("person")
    expect(opportunityStatusSchema.parse("won")).toBe("won")
    expect(activityTypeSchema.parse("follow_up")).toBe("follow_up")
  })

  it("rejects values outside the enum vocabulary", () => {
    expect(entityTypeSchema.safeParse("vendor").success).toBe(false)
    expect(opportunityStatusSchema.safeParse("pending").success).toBe(false)
    expect(activityTypeSchema.safeParse("voicemail").success).toBe(false)
  })
})
