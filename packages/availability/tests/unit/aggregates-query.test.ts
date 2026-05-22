import { describe, expect, it } from "vitest"

import {
  availabilityAggregatesQuerySchema,
  availabilityOverviewQuerySchema,
} from "../../src/validation.js"

describe("availabilityAggregatesQuerySchema", () => {
  it("accepts an empty object", () => {
    const result = availabilityAggregatesQuerySchema.parse({})
    expect(result.from).toBeUndefined()
    expect(result.to).toBeUndefined()
  })

  it("accepts ISO datetime bounds", () => {
    const result = availabilityAggregatesQuerySchema.parse({
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-04-01T00:00:00.000Z",
    })
    expect(result.from).toBe("2026-01-01T00:00:00.000Z")
  })

  it("rejects non-datetime strings", () => {
    expect(() => availabilityAggregatesQuerySchema.parse({ from: "yesterday" })).toThrow()
  })
})

describe("availabilityOverviewQuerySchema", () => {
  it("defaults the attention limit", () => {
    const result = availabilityOverviewQuerySchema.parse({})
    expect(result.attentionLimit).toBe(4)
  })

  it("accepts product filters and coerces the attention limit", () => {
    const result = availabilityOverviewQuerySchema.parse({
      productId: "prod_123",
      attentionLimit: "10",
    })
    expect(result.productId).toBe("prod_123")
    expect(result.attentionLimit).toBe(10)
  })

  it("rejects an unbounded attention limit", () => {
    expect(() => availabilityOverviewQuerySchema.parse({ attentionLimit: 100 })).toThrow()
  })
})
