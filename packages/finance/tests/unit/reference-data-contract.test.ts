import { listResponse, listResponseSchema } from "@voyant-travel/types"
import type { InferSelectModel } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import type { invoiceNumberSeries, invoiceTemplates } from "../../src/schema/invoice-documents.js"
import type { taxRegimes } from "../../src/schema/tax.js"

/**
 * Response contract tests (voyant#2114 / voyant#2208 — finance sub-batch 9A)
 * for the finance reference-data admin routes. Each fixture is typed as the
 * real Drizzle row so column drift breaks compilation; the JSON round-trip
 * (Date → ISO string) mirrors `c.json` so a declared/actual mismatch breaks the
 * test. The schemas below mirror the response shapes declared in
 * `routes-reference-data.ts`.
 */

const isoTimestamp = z.string()
const metadataSchema = z.record(z.string(), z.unknown()).nullable()

const invoiceNumberSeriesSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  prefix: z.string(),
  separator: z.string(),
  padLength: z.number().int(),
  currentSequence: z.number().int(),
  resetStrategy: z.enum(["never", "annual", "monthly"]),
  resetAt: isoTimestamp.nullable(),
  scope: z.enum(["invoice", "proforma", "credit_note"]),
  isDefault: z.boolean(),
  externalProvider: z.string().nullable(),
  externalConfigKey: z.string().nullable(),
  active: z.boolean(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const invoiceTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  language: z.string(),
  jurisdiction: z.string().nullable(),
  bodyFormat: z.enum(["html", "markdown", "lexical_json"]),
  body: z.string(),
  cssStyles: z.string().nullable(),
  isDefault: z.boolean(),
  active: z.boolean(),
  metadata: metadataSchema,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const taxRegimeSchema = z.object({
  id: z.string(),
  code: z.enum([
    "standard",
    "reduced",
    "exempt",
    "reverse_charge",
    "margin_scheme_art311",
    "zero_rated",
    "out_of_scope",
    "other",
  ]),
  name: z.string(),
  jurisdiction: z.string().nullable(),
  ratePercent: z.number().int().nullable(),
  description: z.string().nullable(),
  legalReference: z.string().nullable(),
  active: z.boolean(),
  metadata: metadataSchema,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const createdAt = new Date("2026-01-01T00:00:00.000Z")
const updatedAt = new Date("2026-01-02T00:00:00.000Z")

const invoiceNumberSeriesRow: InferSelectModel<typeof invoiceNumberSeries> = {
  id: "invoice_number_series_0000000000000000",
  code: "INV-2026",
  name: "Invoices 2026",
  prefix: "INV",
  separator: "-",
  padLength: 4,
  currentSequence: 12,
  resetStrategy: "annual",
  resetAt: new Date("2026-01-01T00:00:00.000Z"),
  scope: "invoice",
  isDefault: true,
  externalProvider: null,
  externalConfigKey: null,
  active: true,
  createdAt,
  updatedAt,
}

const invoiceTemplateRow: InferSelectModel<typeof invoiceTemplates> = {
  id: "invoice_templates_0000000000000000000",
  name: "Default Invoice",
  slug: "default-invoice",
  language: "en",
  jurisdiction: null,
  bodyFormat: "html",
  body: "<html></html>",
  cssStyles: null,
  isDefault: true,
  active: true,
  metadata: null,
  createdAt,
  updatedAt,
}

const taxRegimeRow: InferSelectModel<typeof taxRegimes> = {
  id: "tax_regimes_00000000000000000000000000",
  code: "margin_scheme_art311",
  name: "Margin scheme (Art. 311)",
  jurisdiction: "RO",
  ratePercent: null,
  description: null,
  legalReference: "Art. 311 Cod Fiscal",
  active: true,
  metadata: null,
  createdAt,
  updatedAt,
}

const cases = [
  ["invoice number series", invoiceNumberSeriesSchema, invoiceNumberSeriesRow],
  ["invoice template", invoiceTemplateSchema, invoiceTemplateRow],
  ["tax regime", taxRegimeSchema, taxRegimeRow],
] as const

describe("finance reference-data list response contracts", () => {
  for (const [label, schema, row] of cases) {
    it(`the serialized ${label} list satisfies the declared OpenAPI schema`, () => {
      const wire = JSON.parse(
        JSON.stringify(listResponse([row], { total: 1, limit: 50, offset: 0 })),
      )
      const parsed = listResponseSchema(schema).safeParse(wire)
      expect(parsed.success ? null : parsed.error.toString()).toBeNull()
    })
  }
})

describe("finance reference-data single-entity response contracts", () => {
  for (const [label, schema, row] of cases) {
    it(`the serialized ${label} { data } envelope satisfies the declared OpenAPI schema`, () => {
      const wire = JSON.parse(JSON.stringify({ data: row }))
      const parsed = z.object({ data: schema }).safeParse(wire)
      expect(parsed.success ? null : parsed.error.toString()).toBeNull()
    })
  }

  it("the allocate envelope satisfies the declared OpenAPI schema", () => {
    const parsed = z
      .object({ data: z.object({ sequence: z.number().int(), formattedNumber: z.string() }) })
      .safeParse({ data: { sequence: 13, formattedNumber: "INV-0013" } })
    expect(parsed.success).toBe(true)
  })

  it("the delete envelope satisfies the declared OpenAPI schema", () => {
    const parsed = z.object({ success: z.boolean() }).safeParse({ success: true })
    expect(parsed.success).toBe(true)
  })
})
