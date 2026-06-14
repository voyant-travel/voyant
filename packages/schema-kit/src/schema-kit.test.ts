import { describe, expect, it } from "vitest"

import { booleanQueryParam, kmsEnvelopeSchema, newId, typeIdSchema } from "./index.js"

describe("@voyant-travel/schema-kit", () => {
  it("generates and validates prefixed TypeIDs", () => {
    const id = newId("bookings")
    expect(id.startsWith("book_")).toBe(true)
    expect(typeIdSchema("bookings").safeParse(id).success).toBe(true)
    expect(typeIdSchema("bookings").safeParse("not-a-typeid").success).toBe(false)
  })

  it("coerces boolean query params correctly (the z.coerce.boolean footgun)", () => {
    expect(booleanQueryParam.parse("true")).toBe(true)
    expect(booleanQueryParam.parse("1")).toBe(true)
    expect(booleanQueryParam.parse("false")).toBe(false)
    expect(booleanQueryParam.parse("0")).toBe(false)
  })

  it("validates the KMS envelope shape", () => {
    expect(kmsEnvelopeSchema.safeParse({ enc: "ciphertext" }).success).toBe(true)
    expect(kmsEnvelopeSchema.safeParse(null).success).toBe(true)
    expect(kmsEnvelopeSchema.safeParse({ enc: "" }).success).toBe(false)
  })
})
