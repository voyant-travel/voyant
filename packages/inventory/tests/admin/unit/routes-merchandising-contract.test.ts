import { listResponse, listResponseSchema } from "@voyant-travel/types"
import type { InferSelectModel } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import type {
  productFaqs,
  productFeatures,
  productLocations,
} from "../../../src/schema-settings.js"
import type {
  destinations,
  destinationTranslations,
  productCategoryTranslations,
  productDestinations,
  productTagTranslations,
} from "../../../src/schema-taxonomy.js"

/**
 * Response contract tests (voyant#2114 — inventory merchandising sub-batch) for
 * the product merchandising admin routes. Each fixture is typed as the real
 * Drizzle row so column drift breaks compilation; the JSON round-trip
 * (Date → ISO string) mirrors `c.json` so a declared/actual mismatch breaks the
 * test. The schemas below mirror the response shapes declared in
 * `routes-merchandising.ts`. The `/destination-links` list joins `destinations`,
 * so its row schema extends the base `product_destinations` shape with the three
 * joined columns.
 */

const isoTimestamp = z.string()

const featureTypeValues = [
  "inclusion",
  "exclusion",
  "highlight",
  "important_information",
  "other",
] as const

const locationTypeValues = [
  "start",
  "end",
  "meeting_point",
  "pickup",
  "dropoff",
  "point_of_interest",
  "other",
] as const

const featureSchema = z.object({
  id: z.string(),
  productId: z.string(),
  featureType: z.enum(featureTypeValues),
  title: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const faqSchema = z.object({
  id: z.string(),
  productId: z.string(),
  question: z.string(),
  answer: z.string(),
  sortOrder: z.number(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const locationSchema = z.object({
  id: z.string(),
  productId: z.string(),
  locationType: z.enum(locationTypeValues),
  title: z.string(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  countryCode: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  googlePlaceId: z.string().nullable(),
  applePlaceId: z.string().nullable(),
  tripadvisorLocationId: z.string().nullable(),
  sortOrder: z.number(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const destinationSchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  slug: z.string(),
  code: z.string().nullable(),
  canonicalPlaceId: z.string().nullable(),
  destinationType: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  sortOrder: z.number(),
  active: z.boolean(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const destinationTranslationSchema = z.object({
  id: z.string(),
  destinationId: z.string(),
  languageTag: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const productCategoryTranslationSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  languageTag: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const productTagTranslationSchema = z.object({
  id: z.string(),
  tagId: z.string(),
  languageTag: z.string(),
  name: z.string(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const productDestinationSchema = z.object({
  productId: z.string(),
  destinationId: z.string(),
  sortOrder: z.number(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const productDestinationListItemSchema = productDestinationSchema.extend({
  destinationSlug: z.string(),
  destinationType: z.string(),
  destinationActive: z.boolean(),
})

const createdAt = new Date("2026-01-01T00:00:00.000Z")
const updatedAt = new Date("2026-01-02T00:00:00.000Z")
const productId = "product_0000000000000000000000000"
const destinationId = "destinations_0000000000000000000000"

const featureRow: InferSelectModel<typeof productFeatures> = {
  id: "product_features_00000000000000000000",
  productId,
  featureType: "highlight",
  title: "Skip-the-line entry",
  description: null,
  sortOrder: 0,
  createdAt,
  updatedAt,
}

const faqRow: InferSelectModel<typeof productFaqs> = {
  id: "product_faqs_000000000000000000000000",
  productId,
  question: "Is hotel pickup included?",
  answer: "Yes, from central hotels.",
  sortOrder: 1,
  createdAt,
  updatedAt,
}

const locationRow: InferSelectModel<typeof productLocations> = {
  id: "product_locations_0000000000000000000",
  productId,
  locationType: "meeting_point",
  title: "Main square fountain",
  address: "Piazza Navona",
  city: "Rome",
  countryCode: "IT",
  latitude: 41.8992,
  longitude: 12.4731,
  googlePlaceId: null,
  applePlaceId: null,
  tripadvisorLocationId: null,
  sortOrder: 0,
  createdAt,
  updatedAt,
}

const destinationRow: InferSelectModel<typeof destinations> = {
  id: destinationId,
  parentId: null,
  slug: "rome",
  code: "ROM",
  canonicalPlaceId: null,
  destinationType: "city",
  latitude: 41.9028,
  longitude: 12.4964,
  sortOrder: 0,
  active: true,
  metadata: { region: "Lazio" },
  createdAt,
  updatedAt,
}

const destinationTranslationRow: InferSelectModel<typeof destinationTranslations> = {
  id: "destination_translations_00000000000",
  destinationId,
  languageTag: "it-IT",
  name: "Roma",
  description: null,
  seoTitle: null,
  seoDescription: null,
  createdAt,
  updatedAt,
}

const productCategoryTranslationRow: InferSelectModel<typeof productCategoryTranslations> = {
  id: "product_category_translations_0000000",
  categoryId: "product_categories_00000000000000000",
  languageTag: "it-IT",
  name: "Tour a piedi",
  description: null,
  seoTitle: null,
  seoDescription: null,
  createdAt,
  updatedAt,
}

const productTagTranslationRow: InferSelectModel<typeof productTagTranslations> = {
  id: "product_tag_translations_00000000000",
  tagId: "product_tags_000000000000000000000000",
  languageTag: "it-IT",
  name: "Famiglia",
  createdAt,
  updatedAt,
}

const productDestinationRow: InferSelectModel<typeof productDestinations> = {
  productId,
  destinationId,
  sortOrder: 0,
  createdAt,
  updatedAt,
}

const productDestinationListItemRow: InferSelectModel<typeof productDestinations> & {
  destinationSlug: string
  destinationType: string
  destinationActive: boolean
} = {
  ...productDestinationRow,
  destinationSlug: "rome",
  destinationType: "city",
  destinationActive: true,
}

describe("inventory merchandising list response contracts", () => {
  it("the serialized features list satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([featureRow], { total: 1, limit: 50, offset: 0 })),
    )
    const parsed = listResponseSchema(featureSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the serialized faqs list satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([faqRow], { total: 1, limit: 50, offset: 0 })),
    )
    const parsed = listResponseSchema(faqSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the serialized locations list satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([locationRow], { total: 1, limit: 50, offset: 0 })),
    )
    const parsed = listResponseSchema(locationSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the serialized destinations list satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([destinationRow], { total: 1, limit: 50, offset: 0 })),
    )
    const parsed = listResponseSchema(destinationSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the serialized destination-translations list satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([destinationTranslationRow], { total: 1, limit: 50, offset: 0 })),
    )
    const parsed = listResponseSchema(destinationTranslationSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the serialized product-category-translations list satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify(
        listResponse([productCategoryTranslationRow], { total: 1, limit: 50, offset: 0 }),
      ),
    )
    const parsed = listResponseSchema(productCategoryTranslationSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the serialized product-tag-translations list satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([productTagTranslationRow], { total: 1, limit: 50, offset: 0 })),
    )
    const parsed = listResponseSchema(productTagTranslationSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the serialized destination-links list (joined columns) satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify(
        listResponse([productDestinationListItemRow], { total: 1, limit: 50, offset: 0 }),
      ),
    )
    const parsed = listResponseSchema(productDestinationListItemSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })
})

describe("inventory merchandising single-entity response contracts", () => {
  it("the feature { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: featureRow }))
    const parsed = z.object({ data: featureSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the faq { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: faqRow }))
    const parsed = z.object({ data: faqSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the location { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: locationRow }))
    const parsed = z.object({ data: locationSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the destination { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: destinationRow }))
    const parsed = z.object({ data: destinationSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the destination-translation { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: destinationTranslationRow }))
    const parsed = z.object({ data: destinationTranslationSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the product-category-translation { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: productCategoryTranslationRow }))
    const parsed = z.object({ data: productCategoryTranslationSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the product-tag-translation { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: productTagTranslationRow }))
    const parsed = z.object({ data: productTagTranslationSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the destination-link { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: productDestinationRow }))
    const parsed = z.object({ data: productDestinationSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the success envelope satisfies the declared OpenAPI schema", () => {
    const parsed = z.object({ success: z.boolean() }).safeParse({ success: true })
    expect(parsed.success).toBe(true)
  })
})
