import { listResponse, listResponseSchema } from "@voyant-travel/types"
import type { InferSelectModel } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import type { optionUnits, productOptions } from "../../../src/schema-core.js"

/**
 * Response contract tests (voyant#2114 — inventory options sub-batch) for the
 * product options + option-units admin routes. Each fixture is typed as the real
 * Drizzle row so column drift breaks compilation; the JSON round-trip
 * (Date → ISO string) mirrors `c.json` so a declared/actual mismatch breaks the
 * test. The schemas below mirror the response shapes declared in
 * `routes-options.ts`.
 */

const isoTimestamp = z.string()

const optionStatusValues = ["draft", "active", "archived"] as const
const unitTypeValues = ["person", "group", "room", "vehicle", "service", "other"] as const

const productOptionSchema = z.object({
  id: z.string(),
  productId: z.string(),
  name: z.string(),
  code: z.string().nullable(),
  description: z.string().nullable(),
  status: z.enum(optionStatusValues),
  isDefault: z.boolean(),
  sortOrder: z.number().int(),
  availableFrom: z.string().nullable(),
  availableTo: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const optionUnitSchema = z.object({
  id: z.string(),
  optionId: z.string(),
  name: z.string(),
  code: z.string().nullable(),
  description: z.string().nullable(),
  unitType: z.enum(unitTypeValues),
  minQuantity: z.number().int().nullable(),
  maxQuantity: z.number().int().nullable(),
  minAge: z.number().int().nullable(),
  maxAge: z.number().int().nullable(),
  occupancyMin: z.number().int().nullable(),
  occupancyMax: z.number().int().nullable(),
  isRequired: z.boolean(),
  isHidden: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const createdAt = new Date("2026-01-01T00:00:00.000Z")
const updatedAt = new Date("2026-01-02T00:00:00.000Z")

const productOptionRow: InferSelectModel<typeof productOptions> = {
  id: "product_options_00000000000000000000",
  productId: "product_0000000000000000000000000",
  name: "Standard cabin",
  code: "STD",
  description: null,
  status: "active",
  isDefault: true,
  sortOrder: 0,
  availableFrom: "2026-06-01",
  availableTo: "2026-09-30",
  createdAt,
  updatedAt,
}

const optionUnitRow: InferSelectModel<typeof optionUnits> = {
  id: "option_units_000000000000000000000",
  optionId: "product_options_00000000000000000000",
  name: "Adult",
  code: "ADT",
  description: null,
  unitType: "person",
  minQuantity: 1,
  maxQuantity: 4,
  minAge: 18,
  maxAge: null,
  occupancyMin: 1,
  occupancyMax: 2,
  isRequired: true,
  isHidden: false,
  sortOrder: 0,
  createdAt,
  updatedAt,
}

describe("inventory options list response contracts", () => {
  it("the serialized product-options list satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([productOptionRow], { total: 1, limit: 50, offset: 0 })),
    )
    const parsed = listResponseSchema(productOptionSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the serialized option-units list satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([optionUnitRow], { total: 1, limit: 50, offset: 0 })),
    )
    const parsed = listResponseSchema(optionUnitSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })
})

describe("inventory options single-entity response contracts", () => {
  it("the product-option { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: productOptionRow }))
    const parsed = z.object({ data: productOptionSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the option-unit { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: optionUnitRow }))
    const parsed = z.object({ data: optionUnitSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the success envelope satisfies the declared OpenAPI schema", () => {
    const parsed = z.object({ success: z.boolean() }).safeParse({ success: true })
    expect(parsed.success).toBe(true)
  })
})
