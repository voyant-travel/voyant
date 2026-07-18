import { listResponse, listResponseSchema } from "@voyant-travel/types"
import type { InferSelectModel } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import type {
  invoiceAttachments,
  invoiceExternalRefs,
  invoiceRenditions,
} from "../../src/schema/invoice-documents.js"
import type { invoices } from "../../src/schema/receivables.js"

/**
 * Response contract tests (voyant#2114 / voyant#2208 — finance sub-batch 9B)
 * for the finance invoice admin routes. Each fixture is typed as the real
 * Drizzle row so column drift breaks compilation; the JSON round-trip (Date →
 * ISO string, `date` columns already strings) mirrors `c.json` so a
 * declared/actual mismatch breaks the test. The schemas below mirror the row
 * shapes declared in `routes-invoice-schemas.ts`.
 */

const isoString = z.string()
const unknownJsonb = z.unknown().nullable()

const invoiceSchema = z.object({
  id: z.string(),
  invoiceNumber: z.string(),
  invoiceType: z.enum(["invoice", "proforma", "credit_note"]),
  convertedFromInvoiceId: z.string().nullable(),
  seriesId: z.string().nullable(),
  sequence: z.number().int().nullable(),
  templateId: z.string().nullable(),
  taxRegimeId: z.string().nullable(),
  language: z.string().nullable(),
  bookingId: z.string(),
  personId: z.string().nullable(),
  organizationId: z.string().nullable(),
  status: z.enum([
    "draft",
    "pending_external_allocation",
    "issued",
    "partially_paid",
    "paid",
    "overdue",
    "void",
  ]),
  currency: z.string(),
  baseCurrency: z.string().nullable(),
  fxRateSetId: z.string().nullable(),
  subtotalCents: z.number().int(),
  baseSubtotalCents: z.number().int().nullable(),
  taxCents: z.number().int(),
  baseTaxCents: z.number().int().nullable(),
  totalCents: z.number().int(),
  baseTotalCents: z.number().int().nullable(),
  paidCents: z.number().int(),
  basePaidCents: z.number().int().nullable(),
  balanceDueCents: z.number().int(),
  baseBalanceDueCents: z.number().int().nullable(),
  commissionPercent: z.number().int().nullable(),
  commissionAmountCents: z.number().int().nullable(),
  issueDate: isoString,
  dueDate: isoString,
  notes: z.string().nullable(),
  voidedAt: isoString.nullable(),
  voidReason: z.string().nullable(),
  createdAt: isoString,
  updatedAt: isoString,
})

const invoiceListItemSchema = invoiceSchema.extend({
  bookingPaymentScheduleIds: z.array(z.string()),
})

const invoiceRenditionSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  templateId: z.string().nullable(),
  format: z.enum(["html", "pdf", "xml", "json"]),
  status: z.enum(["pending", "ready", "failed", "stale"]),
  storageKey: z.string().nullable(),
  fileSize: z.number().int().nullable(),
  checksum: z.string().nullable(),
  language: z.string().nullable(),
  errorMessage: z.string().nullable(),
  generatedAt: isoString.nullable(),
  metadata: unknownJsonb,
  createdAt: isoString,
  updatedAt: isoString,
})

const invoiceAttachmentSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  kind: z.string(),
  name: z.string(),
  mimeType: z.string().nullable(),
  fileSize: z.number().int().nullable(),
  storageKey: z.string().nullable(),
  checksum: z.string().nullable(),
  metadata: unknownJsonb,
  createdAt: isoString,
})

const invoiceExternalRefSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  provider: z.string(),
  externalId: z.string().nullable(),
  externalNumber: z.string().nullable(),
  externalUrl: z.string().nullable(),
  status: z.string().nullable(),
  metadata: unknownJsonb,
  syncedAt: isoString.nullable(),
  syncError: z.string().nullable(),
  createdAt: isoString,
  updatedAt: isoString,
})

const createdAt = new Date("2026-01-01T00:00:00.000Z")
const updatedAt = new Date("2026-01-02T00:00:00.000Z")

const invoiceRow: InferSelectModel<typeof invoices> = {
  id: "invoices_0000000000000000000000000000",
  invoiceNumber: "INV-0001",
  invoiceType: "invoice",
  convertedFromInvoiceId: null,
  seriesId: null,
  sequence: 1,
  templateId: null,
  taxRegimeId: null,
  language: "en",
  bookingId: "bookings_000000000000000000000000000",
  personId: null,
  organizationId: null,
  status: "issued",
  currency: "EUR",
  baseCurrency: "EUR",
  fxRateSetId: null,
  subtotalCents: 10000,
  baseSubtotalCents: 10000,
  taxCents: 1900,
  baseTaxCents: 1900,
  totalCents: 11900,
  baseTotalCents: 11900,
  paidCents: 0,
  basePaidCents: 0,
  balanceDueCents: 11900,
  baseBalanceDueCents: 11900,
  commissionPercent: null,
  commissionAmountCents: null,
  issueDate: "2026-01-01",
  dueDate: "2026-01-31",
  notes: null,
  voidedAt: null,
  voidReason: null,
  createdAt,
  updatedAt,
}

const invoiceRenditionRow: InferSelectModel<typeof invoiceRenditions> = {
  id: "invoice_renditions_0000000000000000000",
  invoiceId: invoiceRow.id,
  templateId: null,
  format: "pdf",
  status: "ready",
  storageKey: "renditions/inv-0001.pdf",
  fileSize: 20480,
  checksum: null,
  language: "en",
  errorMessage: null,
  generatedAt: createdAt,
  appProvider: null,
  appIdempotencyDigest: null,
  appFileName: null,
  metadata: null,
  createdAt,
  updatedAt,
}

const invoiceAttachmentRow: InferSelectModel<typeof invoiceAttachments> = {
  id: "invoice_attachments_000000000000000000",
  invoiceId: invoiceRow.id,
  kind: "supporting_document",
  name: "receipt.pdf",
  mimeType: "application/pdf",
  fileSize: 4096,
  storageKey: "attachments/receipt.pdf",
  checksum: null,
  metadata: null,
  createdAt,
}

const invoiceExternalRefRow: InferSelectModel<typeof invoiceExternalRefs> = {
  id: "invoice_external_refs_00000000000000000",
  invoiceId: invoiceRow.id,
  provider: "smartbill",
  externalId: "ext-123",
  externalNumber: "RO-0001",
  externalUrl: null,
  status: "synced",
  metadata: null,
  syncedAt: createdAt,
  syncError: null,
  syncState: null,
  syncOperationId: null,
  syncOccurredAt: null,
  syncErrorCode: null,
  syncErrorMessage: null,
  syncMetadata: null,
  createdAt,
  updatedAt,
}

const singleCases = [
  ["invoice", invoiceSchema, invoiceRow],
  ["invoice rendition", invoiceRenditionSchema, invoiceRenditionRow],
  ["invoice attachment", invoiceAttachmentSchema, invoiceAttachmentRow],
  ["invoice external ref", invoiceExternalRefSchema, invoiceExternalRefRow],
] as const

describe("finance invoice single-entity response contracts", () => {
  for (const [label, schema, row] of singleCases) {
    it(`the serialized ${label} { data } envelope satisfies the declared OpenAPI schema`, () => {
      const wire = JSON.parse(JSON.stringify({ data: row }))
      const parsed = z.object({ data: schema }).safeParse(wire)
      expect(parsed.success ? null : parsed.error.toString()).toBeNull()
    })
  }
})

describe("finance invoice list response contract", () => {
  it("the serialized invoice list (with payment-schedule ids) satisfies the declared schema", () => {
    const listRow = {
      ...invoiceRow,
      bookingPaymentScheduleIds: ["bps_0000000000000000000000000000000"],
    }
    const wire = JSON.parse(
      JSON.stringify(listResponse([listRow], { total: 1, limit: 50, offset: 0 })),
    )
    const parsed = listResponseSchema(invoiceListItemSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })
})

describe("finance invoice nested-collection response contracts", () => {
  it("the serialized rendition array { data } envelope satisfies the declared schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: [invoiceRenditionRow] }))
    const parsed = z.object({ data: z.array(invoiceRenditionSchema) }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the delete envelope satisfies the declared schema", () => {
    const parsed = z.object({ success: z.boolean() }).safeParse({ success: true })
    expect(parsed.success).toBe(true)
  })
})
