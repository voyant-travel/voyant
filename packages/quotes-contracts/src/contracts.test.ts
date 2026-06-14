import { describe, expect, it } from "vitest"

import { entityTypeSchema, quoteStatusSchema, quoteVersionStatusSchema } from "./index.js"

describe("@voyant-travel/quotes-contracts validation", () => {
  it("accepts valid enum vocabulary values", () => {
    expect(entityTypeSchema.parse("quote")).toBe("quote")
    expect(quoteStatusSchema.parse("won")).toBe("won")
    expect(quoteVersionStatusSchema.parse("accepted")).toBe("accepted")
  })

  it("rejects values outside the enum vocabulary", () => {
    expect(entityTypeSchema.safeParse("vendor").success).toBe(false)
    expect(quoteStatusSchema.safeParse("pending").success).toBe(false)
    expect(quoteVersionStatusSchema.safeParse("viewed").success).toBe(false)
  })
})
