import { describe, expect, it } from "vitest"

import { productAggregatesQuerySchema } from "../../src/validation-core.js"

describe("productAggregatesQuerySchema", () => {
  it("accepts an empty object", () => {
    const result = productAggregatesQuerySchema.parse({})
    expect(result.from).toBeUndefined()
    expect(result.to).toBeUndefined()
  })

  it("accepts ISO datetime bounds", () => {
    const result = productAggregatesQuerySchema.parse({
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-04-01T00:00:00.000Z",
    })
    expect(result.from).toBe("2026-01-01T00:00:00.000Z")
    expect(result.to).toBe("2026-04-01T00:00:00.000Z")
  })

  it("rejects non-datetime strings", () => {
    expect(() => productAggregatesQuerySchema.parse({ from: "yesterday" })).toThrow()
  })
})
