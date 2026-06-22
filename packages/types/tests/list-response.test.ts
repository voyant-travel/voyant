import { describe, expect, it } from "vitest"
import { z } from "zod"
import { listResponse, listResponseSchema, paginationSchema } from "../src/list-response.js"

describe("listResponse", () => {
  it("builds the canonical envelope", () => {
    expect(listResponse([1, 2, 3], { total: 42, limit: 50, offset: 0 })).toEqual({
      data: [1, 2, 3],
      total: 42,
      limit: 50,
      offset: 0,
    })
  })
})

describe("paginationSchema", () => {
  it("applies defaults", () => {
    expect(paginationSchema.parse({})).toEqual({ limit: 50, offset: 0 })
  })

  it("coerces string query params", () => {
    expect(paginationSchema.parse({ limit: "100", offset: "20" })).toEqual({
      limit: 100,
      offset: 20,
    })
  })

  it("clamps limit to [1, 200]", () => {
    expect(paginationSchema.safeParse({ limit: 0 }).success).toBe(false)
    expect(paginationSchema.safeParse({ limit: 201 }).success).toBe(false)
    expect(paginationSchema.safeParse({ limit: 200 }).success).toBe(true)
  })

  it("rejects negative offset", () => {
    expect(paginationSchema.safeParse({ offset: -1 }).success).toBe(false)
  })
})

describe("listResponseSchema", () => {
  it("validates an envelope around an item schema", () => {
    const schema = listResponseSchema(z.object({ id: z.string() }))
    const parsed = schema.parse({
      data: [{ id: "a" }, { id: "b" }],
      total: 2,
      limit: 50,
      offset: 0,
    })
    expect(parsed.data).toHaveLength(2)
  })

  it("rejects a malformed envelope", () => {
    const schema = listResponseSchema(z.object({ id: z.string() }))
    expect(schema.safeParse({ data: [{ id: 1 }], total: 1, limit: 50, offset: 0 }).success).toBe(
      false,
    )
  })
})
