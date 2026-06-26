import { listResponse, listResponseSchema } from "@voyant-travel/types"
import type { InferSelectModel } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import type {
  productDayServices,
  productDayServiceTranslations,
  productDays,
  productDayTranslations,
  productItineraries,
  productItineraryTranslations,
  productNotes,
  productVersions,
} from "../../../src/schema-itinerary.js"

/**
 * Response contract tests (voyant#2114 — inventory itinerary sub-batch) for the
 * product itinerary + itinerary-translation admin routes. Each fixture is typed
 * as the real Drizzle row so column drift breaks compilation; the JSON
 * round-trip (Date → ISO string) mirrors `c.json` so a declared/actual mismatch
 * breaks the test. The schemas below mirror the response shapes declared in
 * `routes-itinerary.ts` and `routes-itinerary-translations.ts`. Collection lists
 * use a `{ data: [...] }` envelope; the day/itinerary/day-service translation
 * lists return the paginated `listResponse` envelope.
 */

const isoTimestamp = z.string()

const serviceTypeValues = [
  "accommodation",
  "transfer",
  "experience",
  "guide",
  "meal",
  "other",
] as const

const itinerarySchema = z.object({
  id: z.string(),
  productId: z.string(),
  name: z.string(),
  isDefault: z.boolean(),
  sortOrder: z.number(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const daySchema = z.object({
  id: z.string(),
  itineraryId: z.string(),
  dayNumber: z.number(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const dayServiceSchema = z.object({
  id: z.string(),
  dayId: z.string(),
  supplierServiceId: z.string().nullable(),
  serviceType: z.enum(serviceTypeValues),
  name: z.string(),
  description: z.string().nullable(),
  countryCode: z.string().nullable(),
  costCurrency: z.string(),
  costAmountCents: z.number(),
  quantity: z.number(),
  sortOrder: z.number().nullable(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
})

const dayTranslationSchema = z.object({
  id: z.string(),
  dayId: z.string(),
  languageTag: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const versionSchema = z.object({
  id: z.string(),
  productId: z.string(),
  versionNumber: z.number(),
  snapshot: z.unknown(),
  authorId: z.string(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
})

const noteSchema = z.object({
  id: z.string(),
  productId: z.string(),
  authorId: z.string(),
  content: z.string(),
  createdAt: isoTimestamp,
})

const itineraryTranslationSchema = z.object({
  id: z.string(),
  itineraryId: z.string(),
  languageTag: z.string(),
  name: z.string(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const dayServiceTranslationSchema = z.object({
  id: z.string(),
  serviceId: z.string(),
  languageTag: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const createdAt = new Date("2026-01-01T00:00:00.000Z")
const updatedAt = new Date("2026-01-02T00:00:00.000Z")
const productId = "product_0000000000000000000000000"
const itineraryId = "product_itineraries_00000000000000000"
const dayId = "product_days_0000000000000000000000000"
const serviceId = "product_day_services_000000000000000"

const itineraryRow: InferSelectModel<typeof productItineraries> = {
  id: itineraryId,
  productId,
  name: "Classic 3-day",
  isDefault: true,
  sortOrder: 0,
  createdAt,
  updatedAt,
}

const dayRow: InferSelectModel<typeof productDays> = {
  id: dayId,
  itineraryId,
  dayNumber: 1,
  title: "Arrival",
  description: null,
  location: "Rome",
  createdAt,
  updatedAt,
}

const dayServiceRow: InferSelectModel<typeof productDayServices> = {
  id: serviceId,
  dayId,
  supplierServiceId: null,
  serviceType: "experience",
  name: "Guided walking tour",
  description: null,
  countryCode: "IT",
  costCurrency: "EUR",
  costAmountCents: 4500,
  quantity: 1,
  sortOrder: 0,
  notes: null,
  createdAt,
}

const dayTranslationRow: InferSelectModel<typeof productDayTranslations> = {
  id: "product_day_translations_0000000000",
  dayId,
  languageTag: "it-IT",
  title: "Arrivo",
  description: null,
  location: "Roma",
  createdAt,
  updatedAt,
}

const versionRow: InferSelectModel<typeof productVersions> = {
  id: "product_versions_00000000000000000000",
  productId,
  versionNumber: 3,
  snapshot: { name: "Classic 3-day" },
  authorId: "user_00000000000000000000000000000",
  notes: null,
  createdAt,
}

const noteRow: InferSelectModel<typeof productNotes> = {
  id: "product_notes_000000000000000000000000",
  productId,
  authorId: "user_00000000000000000000000000000",
  content: "Confirm pickup window with supplier.",
  createdAt,
}

const itineraryTranslationRow: InferSelectModel<typeof productItineraryTranslations> = {
  id: "product_itinerary_translations_00000",
  itineraryId,
  languageTag: "it-IT",
  name: "Classico 3 giorni",
  createdAt,
  updatedAt,
}

const dayServiceTranslationRow: InferSelectModel<typeof productDayServiceTranslations> = {
  id: "product_day_service_translations_000",
  serviceId,
  languageTag: "it-IT",
  name: "Tour a piedi guidato",
  description: null,
  notes: null,
  createdAt,
  updatedAt,
}

describe("inventory itinerary list response contracts", () => {
  it("the serialized itineraries list satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: [itineraryRow] }))
    const parsed = z.object({ data: z.array(itinerarySchema) }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the serialized days list satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: [dayRow] }))
    const parsed = z.object({ data: z.array(daySchema) }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the serialized day-services list satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: [dayServiceRow] }))
    const parsed = z.object({ data: z.array(dayServiceSchema) }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the serialized versions list satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: [versionRow] }))
    const parsed = z.object({ data: z.array(versionSchema) }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the serialized notes list satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: [noteRow] }))
    const parsed = z.object({ data: z.array(noteSchema) }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the serialized day-translations list (paginated) satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([dayTranslationRow], { total: 1, limit: 100, offset: 0 })),
    )
    const parsed = listResponseSchema(dayTranslationSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the serialized itinerary-translations list (paginated) satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([itineraryTranslationRow], { total: 1, limit: 100, offset: 0 })),
    )
    const parsed = listResponseSchema(itineraryTranslationSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the serialized day-service-translations list (paginated) satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([dayServiceTranslationRow], { total: 1, limit: 100, offset: 0 })),
    )
    const parsed = listResponseSchema(dayServiceTranslationSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })
})

describe("inventory itinerary single-entity response contracts", () => {
  it("the itinerary { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: itineraryRow }))
    const parsed = z.object({ data: itinerarySchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the day { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: dayRow }))
    const parsed = z.object({ data: daySchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the day-service { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: dayServiceRow }))
    const parsed = z.object({ data: dayServiceSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the day-translation { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: dayTranslationRow }))
    const parsed = z.object({ data: dayTranslationSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the version { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: versionRow }))
    const parsed = z.object({ data: versionSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the note { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: noteRow }))
    const parsed = z.object({ data: noteSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the itinerary-translation { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: itineraryTranslationRow }))
    const parsed = z.object({ data: itineraryTranslationSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the day-service-translation { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: dayServiceTranslationRow }))
    const parsed = z.object({ data: dayServiceTranslationSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the success envelope satisfies the declared OpenAPI schema", () => {
    const parsed = z.object({ success: z.boolean() }).safeParse({ success: true })
    expect(parsed.success).toBe(true)
  })
})
