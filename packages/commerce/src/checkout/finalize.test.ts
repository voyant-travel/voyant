import { beforeEach, describe, expect, it, vi } from "vitest"

import { buildCheckoutFinalizeDeps, finalizeCheckout } from "./finalize.js"

const mocks = vi.hoisted(() => ({
  confirmBooking: vi.fn(),
  completePaymentSession: vi.fn(),
  convertProformaToInvoice: vi.fn(),
  issueInvoiceFromBooking: vi.fn(),
  runCheckoutFinalize: vi.fn(),
  settleCoveredBookingPaymentSchedules: vi.fn(),
}))

const tables = vi.hoisted(() => ({
  bookings: {
    id: "bookings.id",
    status: "bookings.status",
  },
  invoices: {
    id: "invoices.id",
    bookingId: "invoices.bookingId",
    invoiceType: "invoices.invoiceType",
    status: "invoices.status",
    createdAt: "invoices.createdAt",
  },
  paymentSessions: {
    id: "paymentSessions.id",
    bookingId: "paymentSessions.bookingId",
    status: "paymentSessions.status",
    invoiceId: "paymentSessions.invoiceId",
  },
}))

vi.mock("@voyant-travel/bookings", () => ({
  bookingsService: { confirmBooking: mocks.confirmBooking },
}))
vi.mock("@voyant-travel/bookings/schema", () => ({
  bookingItems: { bookingId: "bookingItems.bookingId" },
  bookings: tables.bookings,
}))
vi.mock("@voyant-travel/catalog/booking-engine", () => ({
  runCheckoutFinalize: mocks.runCheckoutFinalize,
}))
vi.mock("@voyant-travel/finance", () => ({
  convertProformaToInvoice: mocks.convertProformaToInvoice,
  financeService: { completePaymentSession: mocks.completePaymentSession },
  invoices: tables.invoices,
  issueInvoiceFromBooking: mocks.issueInvoiceFromBooking,
  settleCoveredBookingPaymentSchedules: mocks.settleCoveredBookingPaymentSchedules,
}))
vi.mock("@voyant-travel/finance/schema", () => ({ paymentSessions: tables.paymentSessions }))

type QueryRows = unknown[] | (() => unknown[])

interface SelectQuery {
  from(): SelectQuery
  limit(): Promise<unknown[]>
  orderBy(): SelectQuery
  then(resolve: (rows: unknown[]) => unknown, reject: (error: unknown) => unknown): Promise<unknown>
  where(): SelectQuery
}

interface UpdateQuery {
  set(): UpdateQuery
  then(resolve: (rows: unknown[]) => unknown): Promise<unknown>
  where(): UpdateQuery
}

function databaseWithSelects(...results: QueryRows[]) {
  const queue = [...results]
  const consume = async () => {
    const next = queue.shift()
    if (!next) throw new Error("Unexpected database select")
    return typeof next === "function" ? next() : next
  }
  const chain = () => {
    const query: SelectQuery = {
      from: () => query,
      limit: () => consume(),
      orderBy: () => query,
      // biome-ignore lint/suspicious/noThenProperty: Drizzle query builders are intentionally thenable.
      then: (resolve: (rows: unknown[]) => unknown, reject: (error: unknown) => unknown) =>
        consume().then(resolve, reject),
      where: () => query,
    }
    return query
  }
  const updateChain = () => {
    const query: UpdateQuery = {
      set: () => query,
      // biome-ignore lint/suspicious/noThenProperty: Drizzle query builders are intentionally thenable.
      then: (resolve: (rows: unknown[]) => unknown) => Promise.resolve([]).then(resolve),
      where: () => query,
    }
    return query
  }
  return {
    select: vi.fn(chain),
    update: vi.fn(updateChain),
  } as never
}

describe("finalizeCheckout", () => {
  beforeEach(() => vi.clearAllMocks())

  it("runs the checkout saga directly without a generic run record", async () => {
    const db = {} as never
    const eventBus = {} as never
    const input = { bookingId: "booking_1", paymentSessionId: "session_1" }

    await finalizeCheckout({ db, eventBus, input })

    expect(mocks.runCheckoutFinalize).toHaveBeenCalledWith(
      input,
      expect.objectContaining({ db, eventBus }),
    )
  })

  it("uses booking, invoice, payment-session, and payment records as retry checkpoints", async () => {
    let bookingStatus = "awaiting_payment"
    let invoiceId: string | null = null
    const session = {
      id: "session_1",
      bookingId: "booking_1",
      status: "paid",
      invoiceId: null as string | null,
      paymentId: null as string | null,
      amountCents: 12_500,
      currency: "EUR",
      paymentMethod: "credit_card",
      paymentInstrumentId: null,
      paymentAuthorizationId: "authorization_1",
      paymentCaptureId: "capture_1",
      providerSessionId: "provider_session_1",
      providerPaymentId: "provider_payment_1",
      externalReference: null,
      completedAt: new Date("2026-07-21T10:00:00.000Z"),
    }
    const db = databaseWithSelects(
      () => [{ status: bookingStatus }],
      () => [{ status: bookingStatus }],
      () => (invoiceId ? [{ id: invoiceId }] : []),
      [
        {
          id: "booking_1",
          bookingNumber: "BK-1",
          personId: null,
          organizationId: null,
          sellCurrency: "EUR",
          baseCurrency: null,
          sellAmountCents: 12_500,
          baseSellAmountCents: null,
        },
      ],
      [],
      () => (invoiceId ? [{ id: invoiceId }] : []),
      () => [{ ...session }],
      () => [{ ...session }],
    )
    const eventBus = {} as never
    const deps = buildCheckoutFinalizeDeps(db, eventBus)
    mocks.confirmBooking.mockImplementationOnce(async () => {
      bookingStatus = "confirmed"
      return { status: "ok" }
    })
    mocks.issueInvoiceFromBooking.mockImplementationOnce(async () => {
      invoiceId = "invoice_1"
      return { id: invoiceId }
    })
    mocks.completePaymentSession.mockImplementationOnce(async () => {
      session.invoiceId = "invoice_1"
      session.paymentId = "payment_1"
      return { ...session }
    })

    await deps.confirmBooking("booking_1")
    await deps.confirmBooking("booking_1")
    expect(mocks.confirmBooking).toHaveBeenCalledOnce()

    await expect(deps.issueInvoice({ bookingId: "booking_1" })).resolves.toEqual({
      invoiceId: "invoice_1",
    })
    await expect(deps.issueInvoice({ bookingId: "booking_1" })).resolves.toEqual({
      invoiceId: "invoice_1",
    })
    expect(mocks.issueInvoiceFromBooking).toHaveBeenCalledOnce()

    await expect(
      deps.linkPaymentToInvoice?.({
        bookingId: "booking_1",
        invoiceId: "invoice_1",
        paymentSessionId: "session_1",
      }),
    ).resolves.toEqual({ paymentId: "payment_1", sessionsLinked: 1 })
    await expect(
      deps.linkPaymentToInvoice?.({
        bookingId: "booking_1",
        invoiceId: "invoice_1",
        paymentSessionId: "session_1",
      }),
    ).resolves.toEqual({ paymentId: null, sessionsLinked: 0 })
    expect(mocks.completePaymentSession).toHaveBeenCalledOnce()
  })
})
