import { listResponse, listResponseSchema } from "@voyant-travel/types"
import type { InferSelectModel } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import type {
  optionUnitTranslations,
  productOptionTranslations,
  productTranslations,
} from "../../../src/schema-settings.js"
import type { productCategories, productTags, productTypes } from "../../../src/schema-taxonomy.js"

/**
 * Response contract tests (voyant#2114 — inventory translations + catalog
 * sub-batch) for the product translation and catalog taxonomy admin routes.
 * Each fixture is typed as the real Drizzle row so column drift breaks
 * compilation; the JSON round-trip (Date → ISO string) mirrors `c.json` so a
 * declared/actual mismatch breaks the test. The schemas below mirror the
 * response shapes declared in `routes-translations.ts` and `routes-catalog.ts`.
 */

const isoTimestamp = z.string()

// --- routes-translations.ts response schemas -------------------------------

const productTranslationSchema = z.object({
  id: z.string(),
  productId: z.string(),
  languageTag: z.string(),
  slug: z.string().nullable(),
  name: z.string(),
  shortDescription: z.string().nullable(),
  description: z.string().nullable(),
  inclusionsHtml: z.string().nullable(),
  exclusionsHtml: z.string().nullable(),
  termsHtml: z.string().nullable(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const optionTranslationSchema = z.object({
  id: z.string(),
  optionId: z.string(),
  languageTag: z.string(),
  name: z.string(),
  shortDescription: z.string().nullable(),
  description: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const unitTranslationSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  languageTag: z.string(),
  name: z.string(),
  shortDescription: z.string().nullable(),
  description: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

// --- routes-catalog.ts response schemas ------------------------------------

const productTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number(),
  active: z.boolean(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const productCategorySchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number(),
  active: z.boolean(),
  customerPaymentPolicy: z.unknown().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const productTagSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const createdAt = new Date("2026-01-01T00:00:00.000Z")
const updatedAt = new Date("2026-01-02T00:00:00.000Z")
const productId = "product_0000000000000000000000000"

const productTranslationRow: InferSelectModel<typeof productTranslations> = {
  id: "product_translations_0000000000000000",
  productId,
  languageTag: "it-IT",
  slug: "tour-a-piedi",
  name: "Tour a piedi di Roma",
  shortDescription: null,
  description: null,
  inclusionsHtml: null,
  exclusionsHtml: null,
  termsHtml: null,
  seoTitle: null,
  seoDescription: null,
  createdAt,
  updatedAt,
}

const optionTranslationRow: InferSelectModel<typeof productOptionTranslations> = {
  id: "product_option_translations_000000000",
  optionId: "product_options_00000000000000000000",
  languageTag: "it-IT",
  name: "Mattina",
  shortDescription: null,
  description: null,
  createdAt,
  updatedAt,
}

const unitTranslationRow: InferSelectModel<typeof optionUnitTranslations> = {
  id: "option_unit_translations_000000000000",
  unitId: "option_units_000000000000000000000000",
  languageTag: "it-IT",
  name: "Adulto",
  shortDescription: null,
  description: null,
  createdAt,
  updatedAt,
}

const productTypeRow: InferSelectModel<typeof productTypes> = {
  id: "product_types_0000000000000000000000",
  name: "Walking tour",
  code: "walking_tour",
  description: null,
  sortOrder: 0,
  active: true,
  metadata: { tier: "standard" },
  createdAt,
  updatedAt,
}

const productCategoryRow: InferSelectModel<typeof productCategories> = {
  id: "product_categories_00000000000000000",
  parentId: null,
  name: "City tours",
  slug: "city-tours",
  description: null,
  sortOrder: 0,
  active: true,
  customerPaymentPolicy: null,
  metadata: { featured: true },
  createdAt,
  updatedAt,
}

const productTagRow: InferSelectModel<typeof productTags> = {
  id: "product_tags_000000000000000000000000",
  name: "Family friendly",
  createdAt,
  updatedAt,
}

describe("inventory translations list response contracts", () => {
  it("the serialized product-translations list satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([productTranslationRow], { total: 1, limit: 50, offset: 0 })),
    )
    const parsed = listResponseSchema(productTranslationSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the serialized option-translations list satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([optionTranslationRow], { total: 1, limit: 50, offset: 0 })),
    )
    const parsed = listResponseSchema(optionTranslationSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the serialized unit-translations list satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([unitTranslationRow], { total: 1, limit: 50, offset: 0 })),
    )
    const parsed = listResponseSchema(unitTranslationSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })
})

describe("inventory translations single-entity response contracts", () => {
  it("the product-translation { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: productTranslationRow }))
    const parsed = z.object({ data: productTranslationSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the option-translation { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: optionTranslationRow }))
    const parsed = z.object({ data: optionTranslationSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the unit-translation { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: unitTranslationRow }))
    const parsed = z.object({ data: unitTranslationSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })
})

describe("inventory catalog list response contracts", () => {
  it("the serialized product-types list satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([productTypeRow], { total: 1, limit: 50, offset: 0 })),
    )
    const parsed = listResponseSchema(productTypeSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the serialized product-categories list satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([productCategoryRow], { total: 1, limit: 50, offset: 0 })),
    )
    const parsed = listResponseSchema(productCategorySchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the serialized product-tags list satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([productTagRow], { total: 1, limit: 50, offset: 0 })),
    )
    const parsed = listResponseSchema(productTagSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })
})

describe("inventory catalog single-entity response contracts", () => {
  it("the product-type { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: productTypeRow }))
    const parsed = z.object({ data: productTypeSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the product-category { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: productCategoryRow }))
    const parsed = z.object({ data: productCategorySchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the product-tag { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: productTagRow }))
    const parsed = z.object({ data: productTagSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the success envelope satisfies the declared OpenAPI schema", () => {
    const parsed = z.object({ success: z.boolean() }).safeParse({ success: true })
    expect(parsed.success).toBe(true)
  })
})
