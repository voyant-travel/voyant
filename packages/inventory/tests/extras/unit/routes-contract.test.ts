import { listResponse, listResponseSchema } from "@voyant-travel/types"
import type { InferSelectModel } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import type { optionExtraConfigs, productExtras } from "../../../src/extras/schema.js"

/**
 * Response contract tests (voyant#2114 — inventory extras sub-batch) for the
 * inventory extras admin routes. Each fixture is typed as the real Drizzle row
 * so column drift breaks compilation; the JSON round-trip (Date → ISO string)
 * mirrors `c.json` so a declared/actual mismatch breaks the test. The schemas
 * below mirror the response shapes declared in `extras/routes.ts`.
 */

const isoTimestamp = z.string()
const jsonObject = z.record(z.string(), z.unknown())

const selectionTypeValues = ["optional", "required", "default_selected", "unavailable"] as const
const pricingModeValues = [
  "included",
  "per_person",
  "per_booking",
  "quantity_based",
  "on_request",
  "free",
] as const
const collectionModeValues = [
  "booking_total",
  "cash_on_trip",
  "external",
  "included",
  "none",
] as const

const productExtraSchema = z.object({
  id: z.string(),
  productId: z.string(),
  supplierId: z.string().nullable(),
  code: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  selectionType: z.enum(selectionTypeValues),
  pricingMode: z.enum(pricingModeValues),
  pricedPerPerson: z.boolean(),
  collectionMode: z.enum(collectionModeValues),
  showOnSlotManifest: z.boolean(),
  minQuantity: z.number().int().nullable(),
  maxQuantity: z.number().int().nullable(),
  defaultQuantity: z.number().int().nullable(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  metadata: jsonObject.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const optionExtraConfigSchema = z.object({
  id: z.string(),
  optionId: z.string(),
  productExtraId: z.string(),
  selectionType: z.enum(selectionTypeValues).nullable(),
  pricingMode: z.enum(pricingModeValues).nullable(),
  pricedPerPerson: z.boolean().nullable(),
  minQuantity: z.number().int().nullable(),
  maxQuantity: z.number().int().nullable(),
  defaultQuantity: z.number().int().nullable(),
  isDefault: z.boolean(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  notes: z.string().nullable(),
  metadata: jsonObject.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const createdAt = new Date("2026-01-01T00:00:00.000Z")
const updatedAt = new Date("2026-01-02T00:00:00.000Z")
const productId = "product_0000000000000000000000000"

const productExtraRow: InferSelectModel<typeof productExtras> = {
  id: "product_extras_000000000000000000000",
  productId,
  supplierId: null,
  code: "AIRPORT_TRANSFER",
  name: "Airport transfer",
  description: "Private transfer from the airport",
  selectionType: "optional",
  pricingMode: "per_booking",
  pricedPerPerson: false,
  collectionMode: "booking_total",
  showOnSlotManifest: true,
  minQuantity: null,
  maxQuantity: null,
  defaultQuantity: null,
  active: true,
  sortOrder: 0,
  metadata: { vendor: "acme" },
  createdAt,
  updatedAt,
}

const optionExtraConfigRow: InferSelectModel<typeof optionExtraConfigs> = {
  id: "option_extra_configs_0000000000000000",
  optionId: "options_00000000000000000000000000",
  productExtraId: productExtraRow.id,
  selectionType: "required",
  pricingMode: "per_person",
  pricedPerPerson: true,
  minQuantity: 1,
  maxQuantity: 4,
  defaultQuantity: 1,
  isDefault: true,
  active: true,
  sortOrder: 0,
  notes: null,
  metadata: null,
  createdAt,
  updatedAt,
}

describe("inventory extras list response contracts", () => {
  it("the serialized product-extras list satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([productExtraRow], { total: 1, limit: 50, offset: 0 })),
    )
    const parsed = listResponseSchema(productExtraSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the serialized option-extra-configs list satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([optionExtraConfigRow], { total: 1, limit: 50, offset: 0 })),
    )
    const parsed = listResponseSchema(optionExtraConfigSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })
})

describe("inventory extras single-entity response contracts", () => {
  it("the product-extra { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: productExtraRow }))
    const parsed = z.object({ data: productExtraSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the option-extra-config { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: optionExtraConfigRow }))
    const parsed = z.object({ data: optionExtraConfigSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the delete success envelope satisfies the declared OpenAPI schema", () => {
    const parsed = z.object({ success: z.boolean() }).safeParse({ success: true })
    expect(parsed.success).toBe(true)
  })
})
