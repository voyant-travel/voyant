import { createEventBus, type EventEnvelope } from "@voyantjs/core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { financeService } from "../../src/service.js"
import { type InvoiceIssuedEvent, issueInvoiceFromBooking } from "../../src/service-issue.js"

vi.mock("../../src/service.js", () => ({
  financeService: {
    createInvoiceFromBooking: vi.fn(),
  },
}))

describe("issueInvoiceFromBooking", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("emits invoice.issued with booking contact fields and invoice line items", async () => {
    const draftInvoice = {
      id: "inv_123",
      invoiceNumber: "INV-1",
      invoiceType: "invoice",
      bookingId: "book_123",
      totalCents: 13500,
      currency: "RON",
      convertedFromInvoiceId: null,
      issueDate: "2026-05-13",
      dueDate: "2026-05-20",
    }
    const issuedInvoice = { ...draftInvoice, status: "sent" }
    const booking = {
      bookingNumber: "BK-1",
      contactFirstName: "Ana",
      contactLastName: "Popescu",
      contactEmail: "ana@example.com",
      contactPhone: "+40720000000",
      contactAddressLine1: "Strada 1",
      contactCity: "Cluj-Napoca",
      contactRegion: "Cluj",
      contactCountry: "RO",
    }
    const lineRows = [
      {
        description: "City tour",
        quantity: 2,
        unitPriceCents: 6000,
        taxRate: 19,
      },
      {
        description: "Booking fee",
        quantity: 1,
        unitPriceCents: 1500,
        taxRate: null,
      },
    ]
    vi.mocked(financeService.createInvoiceFromBooking).mockResolvedValue(
      draftInvoice as Awaited<ReturnType<typeof financeService.createInvoiceFromBooking>>,
    )

    const db = {
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => [issuedInvoice]),
          })),
        })),
      })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [booking]),
            orderBy: vi.fn(async () => lineRows),
          })),
        })),
      })),
    } as PostgresJsDatabase

    const eventBus = createEventBus()
    const emitted: Array<EventEnvelope<InvoiceIssuedEvent>> = []
    eventBus.subscribe<InvoiceIssuedEvent>("invoice.issued", (event) => {
      emitted.push(event)
    })

    await issueInvoiceFromBooking(
      db,
      {
        invoiceNumber: "INV-1",
        bookingId: "book_123",
        issueDate: "2026-05-13",
        dueDate: "2026-05-20",
      },
      {
        booking: {
          id: "book_123",
          bookingNumber: "BK-1",
          personId: null,
          organizationId: null,
          sellCurrency: "RON",
          baseCurrency: null,
          fxRateSetId: null,
          sellAmountCents: 13500,
          baseSellAmountCents: null,
        },
        items: [],
      },
      { eventBus },
    )

    expect(emitted).toHaveLength(1)
    expect(emitted[0]?.data).toMatchObject({
      invoiceId: "inv_123",
      invoiceNumber: "INV-1",
      invoiceType: "invoice",
      bookingId: "book_123",
      totalCents: 13500,
      currency: "RON",
      convertedFromInvoiceId: null,
      clientName: "Ana Popescu",
      clientEmail: "ana@example.com",
      clientPhone: "+40720000000",
      clientAddress: "Strada 1",
      clientCity: "Cluj-Napoca",
      clientCounty: "Cluj",
      clientCountry: "RO",
      clientVatCode: null,
      clientRegCom: null,
      bookingNumber: "BK-1",
      issueDate: "2026-05-13",
      dueDate: "2026-05-20",
      lineItems: [
        {
          description: "City tour",
          quantity: 2,
          unitPrice: 60,
          currency: "RON",
          taxPercentage: 19,
          isService: true,
        },
        {
          description: "Booking fee",
          quantity: 1,
          unitPrice: 15,
          currency: "RON",
          isService: true,
        },
      ],
    })
  })

  it("enriches issued invoice events with operator FX settings", async () => {
    const draftInvoice = {
      id: "inv_fx",
      invoiceNumber: "INV-FX",
      invoiceType: "invoice",
      bookingId: "book_fx",
      totalCents: 10000,
      currency: "EUR",
      baseCurrency: null,
      convertedFromInvoiceId: null,
      issueDate: "2026-05-22",
      dueDate: "2026-05-29",
    }
    const issuedInvoice = { ...draftInvoice, status: "sent" }
    vi.mocked(financeService.createInvoiceFromBooking).mockResolvedValue(
      draftInvoice as Awaited<ReturnType<typeof financeService.createInvoiceFromBooking>>,
    )

    const db = {
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => [issuedInvoice]),
          })),
        })),
      })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{ bookingNumber: "BK-FX" }]),
            orderBy: vi.fn(async () => []),
          })),
        })),
      })),
    } as PostgresJsDatabase

    const eventBus = createEventBus()
    const emitted: Array<EventEnvelope<InvoiceIssuedEvent>> = []
    eventBus.subscribe<InvoiceIssuedEvent>("invoice.issued", (event) => {
      emitted.push(event)
    })
    const resolveInvoiceExchangeRate = vi.fn(async () => 4.97)

    await issueInvoiceFromBooking(
      db,
      {
        invoiceNumber: "INV-FX",
        bookingId: "book_fx",
        issueDate: "2026-05-22",
        dueDate: "2026-05-29",
      },
      {
        booking: {
          id: "book_fx",
          bookingNumber: "BK-FX",
          personId: null,
          organizationId: null,
          sellCurrency: "EUR",
          baseCurrency: null,
          fxRateSetId: null,
          sellAmountCents: 10000,
          baseSellAmountCents: null,
        },
        items: [],
      },
      {
        eventBus,
        invoiceFxSettings: {
          baseCurrency: "RON",
          fxCommissionBps: 200,
          fxCommissionInvoiceMention: "2% comision curs risc valutar",
        },
        resolveInvoiceExchangeRate,
      },
    )

    expect(resolveInvoiceExchangeRate).toHaveBeenCalledWith({
      baseCurrency: "EUR",
      quoteCurrency: "RON",
      date: "2026-05-22",
    })
    expect(emitted[0]?.data).toMatchObject({
      baseCurrency: "RON",
      fxRate: 4.97,
      fxCommissionBps: 200,
      effectiveRate: 5.0694,
      fxCommissionInvoiceMention: "2% comision curs risc valutar",
    })
  })
})
