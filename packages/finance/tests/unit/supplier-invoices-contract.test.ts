import type { InferSelectModel } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import type {
  supplierInvoiceAttachments,
  supplierInvoiceLines,
  supplierInvoices,
  supplierPayments,
} from "../../src/schema/supplier-invoices.js"

/**
 * Response contract tests (voyant#2114 / voyant#2208 — finance sub-batch 9E)
 * for the finance supplier-invoice + document/booking-finance admin routes.
 * Each fixture is typed as the real Drizzle row so column drift breaks
 * compilation; the JSON round-trip (Date → ISO string) mirrors `c.json` so a
 * declared/actual mismatch breaks the test. The schemas below mirror the
 * response shapes declared in `routes-supplier-invoices.ts` / `routes-documents.ts`
 * / `routes-booking-reads.ts`.
 */

const isoString = z.string()
const unknownJsonb = z.unknown().nullable()

const supplierInvoiceSchema = z.object({
  id: z.string(),
  supplierId: z.string(),
  supplierInvoiceNo: z.string(),
  internalRef: z.string().nullable(),
  status: z.enum(["draft", "received", "approved", "partially_paid", "paid", "disputed", "void"]),
  currency: z.string(),
  baseCurrency: z.string().nullable(),
  fxRateSetId: z.string().nullable(),
  subtotalCents: z.number().int(),
  taxCents: z.number().int(),
  totalCents: z.number().int(),
  baseSubtotalCents: z.number().int().nullable(),
  baseTaxCents: z.number().int().nullable(),
  baseTotalCents: z.number().int().nullable(),
  paidCents: z.number().int(),
  balanceDueCents: z.number().int(),
  taxRegimeId: z.string().nullable(),
  issueDate: isoString,
  dueDate: isoString.nullable(),
  receivedAt: isoString.nullable(),
  approvedAt: isoString.nullable(),
  approvedBy: z.string().nullable(),
  storageKey: z.string().nullable(),
  extractionId: z.string().nullable(),
  notes: z.string().nullable(),
  voidedAt: isoString.nullable(),
  voidReason: z.string().nullable(),
  createdAt: isoString,
  updatedAt: isoString,
  deletedAt: isoString.nullable(),
})

const supplierInvoiceLineSchema = z.object({
  id: z.string(),
  supplierInvoiceId: z.string(),
  description: z.string(),
  serviceType: z.enum([
    "transport",
    "flight",
    "accommodation",
    "guide",
    "meal",
    "experience",
    "insurance",
    "other",
  ]),
  costCategoryId: z.string().nullable(),
  supplierServiceId: z.string().nullable(),
  quantity: z.number().int(),
  unitAmountCents: z.number().int(),
  taxRateBps: z.number().int().nullable(),
  taxAmountCents: z.number().int(),
  totalAmountCents: z.number().int(),
  sortOrder: z.number().int(),
  createdAt: isoString,
  updatedAt: isoString,
})

const supplierPaymentSchema = z.object({
  id: z.string(),
  bookingId: z.string().nullable(),
  supplierId: z.string().nullable(),
  bookingSupplierStatusId: z.string().nullable(),
  supplierInvoiceId: z.string().nullable(),
  amountCents: z.number().int(),
  currency: z.string(),
  baseCurrency: z.string().nullable(),
  baseAmountCents: z.number().int().nullable(),
  fxRateSetId: z.string().nullable(),
  paymentMethod: z.enum([
    "bank_transfer",
    "credit_card",
    "debit_card",
    "cash",
    "cheque",
    "wallet",
    "direct_bill",
    "voucher",
    "other",
  ]),
  paymentInstrumentId: z.string().nullable(),
  status: z.enum(["pending", "completed", "failed", "refunded"]),
  referenceNumber: z.string().nullable(),
  paymentDate: isoString,
  notes: z.string().nullable(),
  createdAt: isoString,
  updatedAt: isoString,
})

const supplierInvoiceAttachmentSchema = z.object({
  id: z.string(),
  supplierInvoiceId: z.string(),
  kind: z.string(),
  name: z.string(),
  mimeType: z.string().nullable(),
  fileSize: z.number().int().nullable(),
  storageKey: z.string().nullable(),
  checksum: z.string().nullable(),
  metadata: unknownJsonb,
  createdAt: isoString,
})

const createdAt = new Date("2026-01-01T00:00:00.000Z")
const updatedAt = new Date("2026-01-02T00:00:00.000Z")

const supplierInvoiceRow: InferSelectModel<typeof supplierInvoices> = {
  id: "supplier_invoices_00000000000000000000",
  supplierId: "supplier_0000000000000000000000",
  supplierInvoiceNo: "INV-2026-001",
  internalRef: null,
  status: "received",
  currency: "EUR",
  baseCurrency: "RON",
  fxRateSetId: null,
  subtotalCents: 10000,
  taxCents: 1900,
  totalCents: 11900,
  baseSubtotalCents: 50000,
  baseTaxCents: 9500,
  baseTotalCents: 59500,
  paidCents: 0,
  balanceDueCents: 11900,
  taxRegimeId: null,
  issueDate: "2026-01-01",
  dueDate: "2026-02-01",
  receivedAt: createdAt,
  approvedAt: null,
  approvedBy: null,
  storageKey: null,
  extractionId: null,
  notes: null,
  voidedAt: null,
  voidReason: null,
  createdAt,
  updatedAt,
  deletedAt: null,
}

const supplierInvoiceLineRow: InferSelectModel<typeof supplierInvoiceLines> = {
  id: "supplier_invoice_lines_0000000000000000",
  supplierInvoiceId: supplierInvoiceRow.id,
  description: "Coach transfer",
  serviceType: "transport",
  costCategoryId: null,
  supplierServiceId: null,
  quantity: 1,
  unitAmountCents: 10000,
  taxRateBps: 1900,
  taxAmountCents: 1900,
  totalAmountCents: 11900,
  sortOrder: 0,
  createdAt,
  updatedAt,
}

const supplierPaymentRow: InferSelectModel<typeof supplierPayments> = {
  id: "supplier_payments_0000000000000000000",
  bookingId: null,
  supplierId: "supplier_0000000000000000000000",
  bookingSupplierStatusId: null,
  supplierInvoiceId: supplierInvoiceRow.id,
  amountCents: 11900,
  currency: "EUR",
  baseCurrency: "RON",
  baseAmountCents: 59500,
  fxRateSetId: null,
  paymentMethod: "bank_transfer",
  paymentInstrumentId: null,
  status: "completed",
  referenceNumber: "WIRE-001",
  paymentDate: "2026-01-15",
  notes: null,
  createdAt,
  updatedAt,
}

const supplierInvoiceAttachmentRow: InferSelectModel<typeof supplierInvoiceAttachments> = {
  id: "supplier_invoice_attachments_0000000000",
  supplierInvoiceId: supplierInvoiceRow.id,
  kind: "supporting_document",
  name: "received-invoice.pdf",
  mimeType: "application/pdf",
  fileSize: 24576,
  storageKey: "finance/supplier-invoices/received-invoice.pdf",
  checksum: null,
  metadata: { source: "email" },
  createdAt,
}

const cases = [
  ["supplier invoice", supplierInvoiceSchema, supplierInvoiceRow],
  ["supplier invoice line", supplierInvoiceLineSchema, supplierInvoiceLineRow],
  ["supplier payment", supplierPaymentSchema, supplierPaymentRow],
  ["supplier invoice attachment", supplierInvoiceAttachmentSchema, supplierInvoiceAttachmentRow],
] as const

describe("finance supplier-invoice single-entity response contracts", () => {
  for (const [label, schema, row] of cases) {
    it(`the serialized ${label} { data } envelope satisfies the declared OpenAPI schema`, () => {
      const wire = JSON.parse(JSON.stringify({ data: row }))
      const parsed = z.object({ data: schema }).safeParse(wire)
      expect(parsed.success ? null : parsed.error.toString()).toBeNull()
    })
  }

  it("the supplier-invoice detail (header + lines + allocations) envelope satisfies the declared schema", () => {
    const detail = {
      ...supplierInvoiceRow,
      lines: [supplierInvoiceLineRow],
      allocations: [
        {
          id: "supplier_cost_allocations_000000000000",
          supplierInvoiceId: supplierInvoiceRow.id,
          supplierInvoiceLineId: null,
          targetType: "departure" as const,
          departureId: "departure_0000000000000000000000",
          productId: null,
          bookingId: null,
          bookingItemId: null,
          travelerId: null,
          amountCents: 11900,
          baseAmountCents: 59500,
          splitMethod: "manual" as const,
          createdAt,
          updatedAt,
          targetLabel: "Paris — 2026-06-01",
        },
      ],
    }
    const detailSchema = supplierInvoiceSchema.extend({
      lines: z.array(supplierInvoiceLineSchema),
      allocations: z.array(
        z.object({
          id: z.string(),
          supplierInvoiceId: z.string(),
          supplierInvoiceLineId: z.string().nullable(),
          targetType: z.enum(["departure", "product", "booking", "traveler", "unattributed"]),
          departureId: z.string().nullable(),
          productId: z.string().nullable(),
          bookingId: z.string().nullable(),
          bookingItemId: z.string().nullable(),
          travelerId: z.string().nullable(),
          amountCents: z.number().int(),
          baseAmountCents: z.number().int().nullable(),
          splitMethod: z.enum(["manual", "per_pax", "equal", "weighted"]),
          createdAt: isoString,
          updatedAt: isoString,
          targetLabel: z.string().nullable(),
        }),
      ),
    })
    const wire = JSON.parse(JSON.stringify({ data: detail }))
    const parsed = z.object({ data: detailSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the list envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify({ data: [supplierInvoiceRow], total: 1, limit: 50, offset: 0 }),
    )
    const parsed = z
      .object({
        data: z.array(supplierInvoiceSchema),
        total: z.number().int(),
        limit: z.number().int(),
        offset: z.number().int(),
      })
      .safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the delete envelope (id only) satisfies the declared OpenAPI schema", () => {
    const parsed = z
      .object({ data: z.object({ id: z.string() }) })
      .safeParse({ data: { id: supplierInvoiceRow.id } })
    expect(parsed.success).toBe(true)
  })
})

/**
 * Booking-finance read (`routes-booking-reads.ts`) reuses the public
 * `publicBookingFinancePaymentsSchema`. A representative row asserts the admin
 * mirror serializes the same shape.
 */
describe("finance booking-finance read response contract", () => {
  const bookingPaymentSchema = z.object({
    id: z.string(),
    source: z.enum(["payment", "travel_credit_redemption"]).default("payment"),
    invoiceId: z.string().nullable(),
    invoiceNumber: z.string().nullable(),
    invoiceType: z.enum(["invoice", "proforma", "credit_note"]).nullable(),
    status: z.enum(["pending", "completed", "failed", "refunded"]),
    paymentMethod: z.string(),
    amountCents: z.number().int(),
    currency: z.string(),
    baseCurrency: z.string().nullable(),
    baseAmountCents: z.number().int().nullable(),
    paymentDate: z.string(),
    referenceNumber: z.string().nullable(),
    notes: z.string().nullable(),
  })

  it("the booking payments { data } envelope satisfies the declared schema", () => {
    const wire = {
      data: {
        bookingId: "bkg_0000000000000000000000000",
        payments: [
          {
            id: "payments_00000000000000000000000",
            source: "payment",
            invoiceId: "invoices_00000000000000000000000",
            invoiceNumber: "2026-0001",
            invoiceType: "invoice",
            status: "completed",
            paymentMethod: "bank_transfer",
            amountCents: 11900,
            currency: "EUR",
            baseCurrency: null,
            baseAmountCents: null,
            paymentDate: "2026-01-15",
            referenceNumber: null,
            notes: null,
          },
          {
            id: "vred_000000000000000000000000",
            source: "travel_credit_redemption",
            invoiceId: null,
            invoiceNumber: null,
            invoiceType: null,
            status: "completed",
            paymentMethod: "travel_credit",
            amountCents: 5000,
            currency: "EUR",
            baseCurrency: null,
            baseAmountCents: null,
            paymentDate: "2026-01-16T10:00:00.000Z",
            referenceNumber: "GIFT-2026",
            notes: null,
          },
        ],
      },
    }
    const parsed = z
      .object({
        data: z.object({ bookingId: z.string(), payments: z.array(bookingPaymentSchema) }),
      })
      .safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })
})
