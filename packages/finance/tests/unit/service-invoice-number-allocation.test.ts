import { describe, expect, it, vi } from "vitest"

import { invoiceLineItems, invoiceNumberSeries, invoices } from "../../src/schema.js"
import {
  financeService,
  type InvoiceFromBookingData,
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
}) {
  const insertedInvoices: Array<Record<string, unknown>> = []
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
          return Promise.resolve(values)
        }
        return { returning: vi.fn(async () => []) }
      }),
    })),
  }

  const db = {
    transaction: vi.fn(async (callback) => callback(tx)),
    select: vi.fn(() => ({
      from: vi.fn((table) => {
        if (table !== invoiceNumberSeries) {
          return { where: vi.fn(async () => []) }
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

  return { db: db as never, tx, insertedInvoices }
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
})
