import { describe, expect, it } from "vitest"

import {
  insertOptionUnitSchema,
  insertProductOptionSchema,
  updateOptionUnitSchema,
  updateProductOptionSchema,
  updateProductSchema,
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
})
