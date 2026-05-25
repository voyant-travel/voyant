import { describe, expect, it, vi } from "vitest"

import {
  invoiceExternalRefs,
  invoiceLineItems,
  invoiceNumberSeries,
  invoices,
} from "../../src/schema.js"
import {
  financeService,
  type InvoiceFromBookingData,
  type InvoiceFromBookingValidationError,
  type InvoiceLineItemsPersistenceError,
  type InvoiceNumberAllocationError,
  type InvoiceNumberConflictError,
} from "../../src/service.js"

const bookingData: InvoiceFromBookingData = {
  booking: {
    id: "book_123",
    bookingNumber: "BK-123",
    personId: null,
    organizationId: null,
    sellCurrency: "RON",
    baseCurrency: null,
    fxRateSetId: null,
    sellAmountCents: 12000,
    baseSellAmountCents: null,
  },
  items: [],
}

function series(overrides: Record<string, unknown> = {}) {
  return {
    id: "ins_123",
    code: "default",
    name: "Default",
    prefix: "INV",
    separator: "-",
    padLength: 4,
    currentSequence: 9,
    resetStrategy: "never",
    resetAt: null,
    scope: "invoice",
    isDefault: true,
    externalProvider: null,
    externalConfigKey: null,
    active: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  }
}

function makeDb(options: {
  explicitSeries?: Record<string, unknown> | null
  defaultSeries?: Record<string, unknown> | null
  invoiceInsertError?: unknown
  invoiceLineItemsReturning?: Array<Record<string, unknown>>
}) {
  const insertedInvoices: Array<Record<string, unknown>> = []
  const insertedInvoiceExternalRefs: Array<Record<string, unknown>> = []
  const insertedInvoiceLineItems: Array<Record<string, unknown>> = []
  const execute = vi.fn(async () => {
    const row = options.explicitSeries ?? options.defaultSeries
    return row
      ? [
          {
            id: row.id,
            prefix: row.prefix,
            separator: row.separator,
            pad_length: row.padLength,
            current_sequence: row.currentSequence,
            reset_strategy: row.resetStrategy,
            reset_at: row.resetAt,
            active: row.active,
          },
        ]
      : []
  })

  const tx = {
    execute,
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => []),
      })),
    })),
    insert: vi.fn((table) => ({
      values: vi.fn((values) => {
        if (table === invoices) {
          if (options.invoiceInsertError) {
            throw options.invoiceInsertError
          }
          insertedInvoices.push(values)
          return {
            returning: vi.fn(async () => [
              {
                id: "inv_123",
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                updatedAt: new Date("2026-01-01T00:00:00.000Z"),
                ...values,
              },
            ]),
          }
        }
        if (table === invoiceLineItems) {
          insertedInvoiceLineItems.push(...values)
          return {
            returning: vi.fn(async () => options.invoiceLineItemsReturning ?? values),
          }
        }
        if (table === invoiceExternalRefs) {
          insertedInvoiceExternalRefs.push(...values)
          return Promise.resolve(values)
        }
        return { returning: vi.fn(async () => []) }
      }),
    })),
  }

  const db = {
    transaction: vi.fn(async (callback) => callback(tx)),
    select: vi.fn((selection?: unknown) => ({
      from: vi.fn((table) => {
        if (table !== invoiceNumberSeries) {
          const rows: Array<Record<string, unknown>> = []
          if (selection) {
            return {
              where: vi.fn(() => ({
                orderBy: vi.fn(() => ({
                  limit: vi.fn(async () => rows),
                })),
              })),
            }
          }
          return { where: vi.fn(async () => rows) }
        }
        return {
          where: vi.fn(() => ({
            limit: vi.fn(async () =>
              options.explicitSeries === undefined
                ? []
                : options.explicitSeries
                  ? [options.explicitSeries]
                  : [],
            ),
            orderBy: vi.fn(() => ({
              limit: vi.fn(async () =>
                options.defaultSeries === undefined
                  ? []
                  : options.defaultSeries
                    ? [options.defaultSeries]
                    : [],
              ),
            })),
          })),
        }
      }),
    })),
  }

  return {
    db: db as never,
    tx,
    insertedInvoices,
    insertedInvoiceExternalRefs,
    insertedInvoiceLineItems,
  }
}

describe("financeService.createInvoiceFromBooking number allocation", () => {
  it("uses a caller-supplied invoice number without allocating a series", async () => {
    const { db, tx, insertedInvoices } = makeDb({})

    await financeService.createInvoiceFromBooking(
      db,
      {
        bookingId: "book_123",
        invoiceNumber: "MANUAL-1",
        issueDate: "2026-05-23",
        dueDate: "2026-06-23",
      },
      bookingData,
    )

    expect(tx.execute).not.toHaveBeenCalled()
    expect(insertedInvoices[0]).toMatchObject({
      invoiceNumber: "MANUAL-1",
      seriesId: null,
      sequence: null,
      status: "draft",
    })
  })

  it("allocates from an explicit local series when invoiceNumber is omitted", async () => {
    const { db, insertedInvoices } = makeDb({ explicitSeries: series() })

    await financeService.createInvoiceFromBooking(
      db,
      {
        bookingId: "book_123",
        seriesId: "ins_123",
        issueDate: "2026-05-23",
        dueDate: "2026-06-23",
      },
      bookingData,
    )

    expect(insertedInvoices[0]).toMatchObject({
      invoiceNumber: "INV-0010",
      seriesId: "ins_123",
      sequence: 10,
      status: "draft",
    })
  })

  it("allocates from the default active series when no seriesId is supplied", async () => {
    const { db, insertedInvoices } = makeDb({ defaultSeries: series({ id: "ins_default" }) })

    await financeService.createInvoiceFromBooking(
      db,
      {
        bookingId: "book_123",
        issueDate: "2026-05-23",
        dueDate: "2026-06-23",
      },
      bookingData,
    )

    expect(insertedInvoices[0]).toMatchObject({
      invoiceNumber: "INV-0010",
      seriesId: "ins_default",
      sequence: 10,
    })
  })

  it("returns a structured error when no active series exists for omitted numbers", async () => {
    const { db } = makeDb({ defaultSeries: null })

    await expect(
      financeService.createInvoiceFromBooking(
        db,
        {
          bookingId: "book_123",
          issueDate: "2026-05-23",
          dueDate: "2026-06-23",
        },
        bookingData,
      ),
    ).rejects.toMatchObject({
      code: "no_active_series_for_scope",
      scope: "invoice",
    } satisfies Partial<InvoiceNumberAllocationError>)
  })

  it("uses a pending placeholder for external-provider series", async () => {
    const { db, tx, insertedInvoices } = makeDb({
      explicitSeries: series({ externalProvider: "smartbill" }),
    })

    await financeService.createInvoiceFromBooking(
      db,
      {
        bookingId: "book_123",
        seriesId: "ins_123",
        issueDate: "2026-05-23",
        dueDate: "2026-06-23",
      },
      bookingData,
    )

    expect(tx.execute).not.toHaveBeenCalled()
    expect(insertedInvoices[0]?.invoiceNumber).toMatch(/^PENDING-INVOICE-/)
    expect(insertedInvoices[0]).toMatchObject({
      seriesId: "ins_123",
      sequence: null,
      status: "pending_external_allocation",
    })
  })

  it("normalizes duplicate invoice numbers into a typed conflict", async () => {
    const { db } = makeDb({
      invoiceInsertError: {
        code: "23505",
        constraint: "invoices_invoice_number_unique",
      },
    })

    await expect(
      financeService.createInvoiceFromBooking(
        db,
        {
          bookingId: "book_123",
          invoiceNumber: "MANUAL-1",
          issueDate: "2026-05-23",
          dueDate: "2026-06-23",
        },
        bookingData,
      ),
    ).rejects.toMatchObject({
      name: "InvoiceNumberConflictError",
      code: "invoice_number_conflict",
      invoiceNumber: "MANUAL-1",
    } satisfies Partial<InvoiceNumberConflictError>)
  })

  it("uses override line items and computes cross-currency base totals", async () => {
    const { db, insertedInvoices, insertedInvoiceLineItems } = makeDb({})

    await financeService.createInvoiceFromBooking(
      db,
      {
        bookingId: "book_123",
        invoiceNumber: "MANUAL-1",
        issueDate: "2026-05-23",
        dueDate: "2026-06-23",
        currency: "RON",
        baseCurrency: "EUR",
        lineItems: [
          {
            description: "SmartBill fiscal line",
            quantity: 1,
            unitAmountCents: 50_000,
            taxRateBps: 1_900,
          },
        ],
      },
      {
        booking: {
          ...bookingData.booking,
          sellCurrency: "EUR",
        },
        items: [
          {
            id: "bkit_123",
            title: "Catalog line that should be replaced",
            quantity: 1,
            unitSellAmountCents: 12_000,
            totalSellAmountCents: 12_000,
          },
        ],
      },
      {
        resolveInvoiceExchangeRate: vi.fn(async () => ({ rate: 0.2, fxRateSetId: "fxrs_123" })),
      },
    )

    expect(insertedInvoices[0]).toMatchObject({
      currency: "RON",
      baseCurrency: "EUR",
      fxRateSetId: "fxrs_123",
      subtotalCents: 50_000,
      taxCents: 9_500,
      totalCents: 59_500,
      baseTotalCents: 11_900,
      balanceDueCents: 59_500,
      baseBalanceDueCents: 11_900,
    })
    expect(insertedInvoiceLineItems).toEqual([
      expect.objectContaining({
        bookingItemId: null,
        description: "SmartBill fiscal line",
        quantity: 1,
        unitPriceCents: 50_000,
        totalCents: 50_000,
        taxRate: 19,
        sortOrder: 0,
      }),
    ])
  })

  it("persists external refs in the invoice transaction", async () => {
    const { db, insertedInvoiceExternalRefs } = makeDb({})

    await financeService.createInvoiceFromBooking(
      db,
      {
        bookingId: "book_123",
        invoiceNumber: "SB-42",
        issueDate: "2026-05-23",
        dueDate: "2026-06-23",
        externalRefs: [
          {
            provider: "smartbill",
            externalId: "remote_42",
            externalNumber: "42",
            externalUrl: "https://smartbill.test/invoices/42",
            status: "issued",
            metadata: { companyVatCode: "RO12345678" },
            syncedAt: "2026-05-23T10:30:00.000Z",
          },
        ],
      },
      bookingData,
    )

    expect(insertedInvoiceExternalRefs).toEqual([
      expect.objectContaining({
        invoiceId: "inv_123",
        provider: "smartbill",
        externalId: "remote_42",
        externalNumber: "42",
        externalUrl: "https://smartbill.test/invoices/42",
        status: "issued",
        metadata: { companyVatCode: "RO12345678" },
        syncedAt: new Date("2026-05-23T10:30:00.000Z"),
        syncError: null,
      }),
    ])
  })

  it("fails the transaction when override line items are not persisted", async () => {
    const { db } = makeDb({ invoiceLineItemsReturning: [] })

    await expect(
      financeService.createInvoiceFromBooking(
        db,
        {
          bookingId: "book_123",
          invoiceNumber: "SB-42",
          issueDate: "2026-05-23",
          dueDate: "2026-06-23",
          lineItems: [
            {
              description: "SmartBill fiscal line",
              quantity: 1,
              unitAmountCents: 50_000,
              taxRateBps: 1_900,
            },
          ],
          externalRefs: [
            {
              provider: "smartbill",
              externalNumber: "42",
              status: "issued",
            },
          ],
        },
        bookingData,
      ),
    ).rejects.toMatchObject({
      name: "InvoiceLineItemsPersistenceError",
      code: "invoice_line_items_not_persisted",
      invoiceId: "inv_123",
      expectedCount: 1,
      actualCount: 0,
    } satisfies Partial<InvoiceLineItemsPersistenceError>)
  })

  it("rejects cross-currency overrides without the booking sell currency as base", async () => {
    const { db } = makeDb({})

    await expect(
      financeService.createInvoiceFromBooking(
        db,
        {
          bookingId: "book_123",
          invoiceNumber: "MANUAL-1",
          issueDate: "2026-05-23",
          dueDate: "2026-06-23",
          currency: "RON",
          lineItems: [
            {
              description: "SmartBill fiscal line",
              quantity: 1,
              unitAmountCents: 50_000,
            },
          ],
        },
        {
          booking: {
            ...bookingData.booking,
            sellCurrency: "EUR",
          },
          items: [],
        },
      ),
    ).rejects.toMatchObject({
      code: "invalid_invoice_from_booking",
    } satisfies Partial<InvoiceFromBookingValidationError>)
  })

  it("rejects cross-currency overrides without replacement line items", async () => {
    const { db } = makeDb({})

    await expect(
      financeService.createInvoiceFromBooking(
        db,
        {
          bookingId: "book_123",
          invoiceNumber: "MANUAL-1",
          issueDate: "2026-05-23",
          dueDate: "2026-06-23",
          currency: "RON",
          baseCurrency: "EUR",
        },
        {
          booking: {
            ...bookingData.booking,
            sellCurrency: "EUR",
          },
          items: [
            {
              id: "bkit_123",
              title: "Catalog line that must not be relabeled",
              quantity: 1,
              unitSellAmountCents: 12_000,
              totalSellAmountCents: 12_000,
            },
          ],
        },
      ),
    ).rejects.toMatchObject({
      code: "invalid_invoice_from_booking",
      message: "Cross-currency invoice overrides require replacement line items",
    } satisfies Partial<InvoiceFromBookingValidationError>)
  })

  it("rejects override totals that do not match the supplied line items", async () => {
    const { db } = makeDb({})

    await expect(
      financeService.createInvoiceFromBooking(
        db,
        {
          bookingId: "book_123",
          invoiceNumber: "MANUAL-1",
          issueDate: "2026-05-23",
          dueDate: "2026-06-23",
          subtotalCents: 40_000,
          lineItems: [
            {
              description: "SmartBill fiscal line",
              quantity: 1,
              unitAmountCents: 50_000,
            },
          ],
        },
        bookingData,
      ),
    ).rejects.toMatchObject({
      code: "invalid_invoice_from_booking",
    } satisfies Partial<InvoiceFromBookingValidationError>)
  })
})

describe("financeService.ensureExternalInvoiceNumberSeries", () => {
  it("creates default external-provider placeholder series per scope", async () => {
    const insertedRows: Array<Record<string, unknown>> = []
    const updates: Array<Record<string, unknown>> = []
    const tx = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(async () => []),
            })),
            limit: vi.fn(async () => []),
          })),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((values) => ({
          where: vi.fn(async () => {
            updates.push(values)
            return []
          }),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn((values) => ({
          returning: vi.fn(async () => {
            const row = {
              id: `ins_${insertedRows.length + 1}`,
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
              updatedAt: new Date("2026-01-01T00:00:00.000Z"),
              ...values,
            }
            insertedRows.push(row)
            return [row]
          }),
        })),
      })),
    }
    const db = {
      transaction: vi.fn(async (callback) => callback(tx)),
    } as never

    const rows = await financeService.ensureExternalInvoiceNumberSeries(db, [
      {
        provider: "smartbill",
        scope: "invoice",
        code: "smartbill-invoice",
        name: "SmartBill invoices",
        externalConfigKey: "FCT",
      },
      {
        provider: "smartbill",
        scope: "proforma",
        code: "smartbill-proforma",
        name: "SmartBill proformas",
        externalConfigKey: "PRO",
      },
    ])

    expect(rows).toHaveLength(2)
    expect(insertedRows).toEqual([
      expect.objectContaining({
        code: "smartbill-invoice",
        scope: "invoice",
        name: "SmartBill invoices",
        externalProvider: "smartbill",
        externalConfigKey: "FCT",
        isDefault: true,
        active: true,
        padLength: 0,
        currentSequence: 0,
      }),
      expect.objectContaining({
        code: "smartbill-proforma",
        scope: "proforma",
        name: "SmartBill proformas",
        externalProvider: "smartbill",
        externalConfigKey: "PRO",
        isDefault: true,
        active: true,
        padLength: 0,
        currentSequence: 0,
      }),
    ])
    expect(updates).toEqual([
      expect.objectContaining({ isDefault: false }),
      expect.objectContaining({ isDefault: false }),
    ])
  })
})
