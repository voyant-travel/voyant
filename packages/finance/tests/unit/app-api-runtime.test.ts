import { bookings } from "@voyant-travel/bookings/schema"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it, vi } from "vitest"
import { createFinanceAppApiRuntime } from "../../src/app-api-runtime.js"
import { invoiceLineItems, invoiceNumberSeries, invoices, taxRegimes } from "../../src/schema.js"

function postgresStub(implementation: object): PostgresJsDatabase {
  const db = Object.create(null) as PostgresJsDatabase
  Object.assign(db, implementation)
  return db
}

describe("finance App API runtime", () => {
  it("hydrates provider-neutral accounting fields required for remote issuance", async () => {
    const rows = new Map<unknown, unknown[]>([
      [
        invoices,
        [
          {
            id: "inv_1",
            invoiceNumber: "PENDING-1",
            invoiceType: "invoice",
            bookingId: "book_1",
            status: "pending_external_allocation",
            seriesId: "series_1",
            taxRegimeId: "tax_1",
            language: "ro",
            currency: "EUR",
            baseCurrency: "RON",
            fxRateSetId: "fxset_1",
            subtotalCents: 8_000,
            baseSubtotalCents: 40_000,
            taxCents: 1_900,
            baseTaxCents: 9_500,
            totalCents: 9_900,
            baseTotalCents: 49_500,
            issueDate: "2026-07-18",
            dueDate: "2026-07-25",
            convertedFromInvoiceId: null,
          },
        ],
      ],
      [
        bookings,
        [
          {
            id: "book_1",
            bookingNumber: "B-1",
            contactFirstName: "Ana",
            contactLastName: "Popescu",
            contactEmail: "ana@example.test",
            contactPhone: "+40123456789",
            contactAddressLine1: "Strada Test 1",
            contactAddressLine2: null,
            contactCity: "Bucuresti",
            contactRegion: "B",
            contactCountry: "RO",
            contactTaxId: "RO123",
          },
        ],
      ],
      [
        invoiceNumberSeries,
        [
          {
            id: "series_1",
            code: "F",
            name: "Fiscal",
            scope: "invoice",
            externalProvider: "internal-provider-routing",
          },
        ],
      ],
      [
        taxRegimes,
        [
          {
            id: "tax_1",
            code: "margin_scheme_art311",
            name: "Regim marja",
            legalReference: "Art. 311 Cod Fiscal",
          },
        ],
      ],
      [
        invoiceLineItems,
        [
          {
            id: "line_1",
            invoiceId: "inv_1",
            bookingItemId: null,
            bookingPaymentScheduleId: null,
            description: "Servicii turistice",
            quantity: 1,
            unitPriceCents: 9_900,
            totalCents: 9_900,
            taxRate: 19,
            sortOrder: 0,
          },
        ],
      ],
    ])
    const db = postgresStub({
      select: () => ({
        from: (table: unknown) => {
          const tableRows = rows.get(table) ?? []
          const query = {
            where: () => query,
            limit: async () => tableRows,
            orderBy: async () => tableRows,
          }
          return query
        },
      }),
    })

    const document = await createFinanceAppApiRuntime().getIssuanceDocument(db, "inv_1")

    expect(document).toMatchObject({
      language: "ro",
      billing: {
        name: "Ana Popescu",
        address: "Strada Test 1",
        vatCode: "RO123",
      },
      currency: { document: "EUR", base: "RON" },
      fx: { rateSetId: "fxset_1", rate: 5, effectiveRate: 5 },
      taxRegime: {
        code: "margin_scheme_art311",
        legalReference: "Art. 311 Cod Fiscal",
        specialRegime: true,
        marginSchemeArticle311: true,
      },
      series: { id: "series_1", code: "F" },
      allocation: { required: true, pending: true, placeholderNumber: "PENDING-1" },
      lines: [{ description: "Servicii turistice", tax: { ratePercent: 19 } }],
    })
    expect(document?.series).not.toHaveProperty("externalProvider")
    expect(document).not.toHaveProperty("skipExternalSync")
  })

  it("rejects replacing an already allocated provider-owned number", async () => {
    const runtime = createFinanceAppApiRuntime()
    const db = postgresStub({
      execute: async () => [{ invoice_number: "SB-41", status: "issued" }],
    })

    await expect(
      runtime.upsertExternalReference?.(db, "inv_1", "accounting-provider", {
        reference: {
          externalId: null,
          externalNumber: null,
          externalUrl: null,
          status: null,
          metadata: null,
          syncedAt: null,
          syncError: null,
        },
        allocation: { invoiceNumber: "SB-42" },
      }),
    ).resolves.toEqual({
      status: "allocation_conflict",
      currentNumber: "SB-41",
      currentStatus: "issued",
    })
  })

  it("rejects allocation when the caller does not own the external series", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce([
        {
          invoice_number: "PENDING-INVOICE-1",
          series_id: "series_1",
          status: "pending_external_allocation",
        },
      ])
      .mockResolvedValueOnce([{ external_provider: "another-provider" }])
    const runtime = createFinanceAppApiRuntime()
    const db = postgresStub({ execute })

    await expect(
      runtime.upsertExternalReference?.(db, "inv_1", "accounting-provider", {
        reference: {
          externalId: "remote_1",
          externalNumber: "SB-42",
          externalUrl: null,
          status: "issued",
          metadata: null,
          syncedAt: null,
          syncError: null,
        },
        allocation: { invoiceNumber: "SB-42" },
      }),
    ).resolves.toEqual({
      status: "allocation_conflict",
      currentNumber: "PENDING-INVOICE-1",
      currentStatus: "pending_external_allocation",
    })
    expect(execute).toHaveBeenCalledTimes(2)
  })

  it("treats the same allocation and provider reference as an idempotent replay", async () => {
    const now = new Date("2026-07-18T09:00:00.000Z")
    const existing = {
      id: "ref_1",
      invoiceId: "inv_1",
      provider: "accounting-provider",
      externalId: "remote_1",
      externalNumber: "SB-42",
      externalUrl: null,
      status: "issued",
      metadata: null,
      syncedAt: now,
      syncError: null,
      createdAt: now,
      updatedAt: now,
    }
    const runtime = createFinanceAppApiRuntime()
    const db = postgresStub({
      execute: async () => [{ invoice_number: "SB-42", status: "issued" }],
      select: () => ({
        from: () => ({ where: () => ({ limit: async () => [existing] }) }),
      }),
    })

    const result = await runtime.upsertExternalReference?.(db, "inv_1", "accounting-provider", {
      reference: {
        externalId: "remote_1",
        externalNumber: "SB-42",
        externalUrl: null,
        status: "issued",
        metadata: null,
        syncedAt: now.toISOString(),
        syncError: null,
      },
      allocation: { invoiceNumber: "SB-42" },
    })

    expect(result).toMatchObject({
      status: "ok",
      referenceOutcome: "unchanged",
      allocationOutcome: "already_applied",
    })
  })
})
