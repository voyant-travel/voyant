import { describe, expect, it } from "vitest"

import {
  insertOptionUnitSchema,
  insertProductOptionSchema,
  updateOptionUnitSchema,
  updateProductOptionSchema,
  updateProductSchema,
  validateMergedOptionUnit,
} from "./validation-core.js"

describe("core update validation", () => {
  const updateCases = [
    ["product", updateProductSchema, { name: "Everest Base Camp" }],
    ["product option", updateProductOptionSchema, { name: "Private room" }],
    ["option unit", updateOptionUnitSchema, { maxQuantity: 4 }],
  ] as const

  for (const [label, schema, patch] of updateCases) {
    it(`does not apply core defaults when parsing a partial ${label} patch`, () => {
      expect(schema.parse(patch)).toEqual(patch)
    })
  }

  it("keeps defaults on product option inserts", () => {
    expect(insertProductOptionSchema.parse({ name: "Standard" })).toMatchObject({
      status: "draft",
      isDefault: false,
      sortOrder: 0,
    })
  })

  it("keeps defaults on option unit inserts", () => {
    expect(insertOptionUnitSchema.parse({ name: "Adult" })).toMatchObject({
      unitType: "person",
      isRequired: false,
      isHidden: false,
      sortOrder: 0,
    })
  })

  it("rejects option unit age ranges where minAge is greater than maxAge", () => {
    const result = insertOptionUnitSchema.safeParse({ name: "Senior", minAge: 70, maxAge: 12 })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ["maxAge"], message: "maxAge must be ≥ minAge" }),
        ]),
      )
    }
  })

  it("accepts option unit age ranges where minAge equals maxAge", () => {
    expect(insertOptionUnitSchema.parse({ name: "Infant", minAge: 2, maxAge: 2 })).toMatchObject({
      minAge: 2,
      maxAge: 2,
    })
  })

  it("validates merged option unit age ranges for partial updates", () => {
    expect(validateMergedOptionUnit({ minAge: 70, maxAge: 12 })).toEqual({
      ok: false,
      issues: [{ path: ["maxAge"], message: "maxAge must be ≥ minAge" }],
    })
  })
})
