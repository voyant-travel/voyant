import { listResponse, listResponseSchema } from "@voyant-travel/types"
import type { InferSelectModel } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import type { productMedia } from "../../../src/schema-itinerary.js"

/**
 * Response contract tests (voyant#2114 — inventory media sub-batch) for the
 * product media + brochure admin routes. Each fixture is typed as the real
 * Drizzle `product_media` row so column drift breaks compilation; the JSON
 * round-trip (Date → ISO string) mirrors `c.json` so a declared/actual mismatch
 * breaks the test. The schemas below mirror the response shapes declared in
 * `routes-media.ts` and `routes-brochure.ts`. Upload + binary-serve routes (from
 * `@voyant-travel/storage`) and the content route's complex `ProductContent`
 * payload are not JSON-envelope row responses, so they are out of scope here.
 */

const isoTimestamp = z.string()
const mediaTypeValues = ["image", "video", "document"] as const

const mediaSchema = z.object({
  id: z.string(),
  productId: z.string(),
  dayId: z.string().nullable(),
  mediaType: z.enum(mediaTypeValues),
  name: z.string(),
  url: z.string(),
  storageKey: z.string().nullable(),
  mimeType: z.string().nullable(),
  fileSize: z.number().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  altText: z.string().nullable(),
  sortOrder: z.number(),
  isCover: z.boolean(),
  isOpenGraph: z.boolean(),
  isBrochure: z.boolean(),
  isBrochureCurrent: z.boolean(),
  brochureVersion: z.number().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const reorderResultSchema = z.object({ data: z.array(z.object({ id: z.string() })) })

const brochureGenerateResponseSchema = z.object({
  data: mediaSchema,
  metadata: z.object({
    filename: z.string(),
    sizeBytes: z.number(),
    storageKey: z.string(),
    url: z.string(),
  }),
})

const createdAt = new Date("2026-01-01T00:00:00.000Z")
const updatedAt = new Date("2026-01-02T00:00:00.000Z")
const productId = "product_0000000000000000000000000"

const mediaRow: InferSelectModel<typeof productMedia> = {
  id: "product_media_00000000000000000000000",
  productId,
  dayId: null,
  mediaType: "image",
  name: "Hero shot",
  url: "https://cdn.example.com/hero.jpg",
  storageKey: "products/hero.jpg",
  mimeType: "image/jpeg",
  fileSize: 204800,
  width: 1200,
  height: 630,
  altText: "Sunset over the harbour",
  sortOrder: 0,
  isCover: true,
  isOpenGraph: true,
  isBrochure: false,
  isBrochureCurrent: false,
  brochureVersion: null,
  createdAt,
  updatedAt,
}

const brochureRow: InferSelectModel<typeof productMedia> = {
  id: "product_media_00000000000000000000001",
  productId,
  dayId: null,
  mediaType: "document",
  name: "brochure-v1.pdf",
  url: "https://cdn.example.com/brochure-v1.pdf",
  storageKey: "brochures/products/brochure-v1.pdf",
  mimeType: "application/pdf",
  fileSize: 1048576,
  width: null,
  height: null,
  altText: null,
  sortOrder: 0,
  isCover: false,
  isOpenGraph: false,
  isBrochure: true,
  isBrochureCurrent: true,
  brochureVersion: 1,
  createdAt,
  updatedAt,
}

describe("inventory media list response contracts", () => {
  it("the serialized product-media list satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([mediaRow], { total: 1, limit: 50, offset: 0 })),
    )
    const parsed = listResponseSchema(mediaSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the serialized day-media list satisfies the declared OpenAPI schema", () => {
    const dayMediaRow = { ...mediaRow, dayId: "product_days_0000000000000000000000000" }
    const wire = JSON.parse(
      JSON.stringify(listResponse([dayMediaRow], { total: 1, limit: 50, offset: 0 })),
    )
    const parsed = listResponseSchema(mediaSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the serialized brochure-versions list satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: [brochureRow] }))
    const parsed = z.object({ data: z.array(mediaSchema) }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })
})

describe("inventory media single-entity response contracts", () => {
  it("the media { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: mediaRow }))
    const parsed = z.object({ data: mediaSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the brochure { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: brochureRow }))
    const parsed = z.object({ data: mediaSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the reorder { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: [{ id: mediaRow.id }] }))
    const parsed = reorderResultSchema.safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the brochure-generate { data, metadata } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify({
        data: brochureRow,
        metadata: {
          filename: "brochure-v1.pdf",
          sizeBytes: 1048576,
          storageKey: "brochures/products/brochure-v1.pdf",
          url: "https://cdn.example.com/brochure-v1.pdf",
        },
      }),
    )
    const parsed = brochureGenerateResponseSchema.safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })
})
