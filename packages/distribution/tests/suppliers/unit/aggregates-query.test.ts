import { supplierAggregatesQuerySchema } from "@voyantjs/distribution"
import { describe, expect, it } from "vitest"

describe("supplierAggregatesQuerySchema", () => {
  it("accepts an empty object", () => {
    const result = supplierAggregatesQuerySchema.parse({})
    expect(result.from).toBeUndefined()
    expect(result.to).toBeUndefined()
  })

  it("accepts ISO datetime bounds", () => {
    const result = supplierAggregatesQuerySchema.parse({
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-04-01T00:00:00.000Z",
    })
    expect(result.from).toBe("2026-01-01T00:00:00.000Z")
  })

  it("rejects non-datetime strings", () => {
    expect(() => supplierAggregatesQuerySchema.parse({ from: "yesterday" })).toThrow()
  })
})
