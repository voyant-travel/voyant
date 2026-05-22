import { Hono } from "hono"
import { beforeEach, describe, expect, it, vi } from "vitest"

const serviceMocks = vi.hoisted(() => ({
  bootstrapCheckoutCollection: vi.fn(),
  initiateCheckoutCollection: vi.fn(),
  listBookingReminderRuns: vi.fn(),
  previewCheckoutCollection: vi.fn(),
}))

vi.mock("../../src/service.js", () => ({
  bootstrapCheckoutCollection: serviceMocks.bootstrapCheckoutCollection,
  initiateCheckoutCollection: serviceMocks.initiateCheckoutCollection,
  listBookingReminderRuns: serviceMocks.listBookingReminderRuns,
  previewCheckoutCollection: serviceMocks.previewCheckoutCollection,
}))

import { createCheckoutRoutes } from "../../src/routes.js"

describe("createCheckoutRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("passes resolved payment starters and bank transfer details to checkout initiation", async () => {
    serviceMocks.initiateCheckoutCollection.mockResolvedValue({
      plan: {
        bookingId: "book_123",
        method: "card",
        stage: "initial",
        paymentSessionTarget: "invoice",
        documentType: "invoice",
        willCreateDefaultPaymentPlan: false,
        selectedSchedule: null,
        selectedInvoice: null,
        amountCents: 12345,
        currency: "EUR",
        recommendedAction: "create_invoice_then_payment_session",
      },
      invoice: null,
      paymentSession: null,
      invoiceNotification: null,
      paymentSessionNotification: null,
      bankTransferInstructions: null,
      providerStart: null,
    })

    const paymentStarter = vi.fn()
    const routes = createCheckoutRoutes({
      resolvePaymentStarters: () => ({ netopia: paymentStarter }),
      resolvePublicCheckoutBaseUrl: () => "https://brand.example.com",
      resolveBankTransferDetails: () => ({
        provider: "manual",
        beneficiary: "Program Travel",
        iban: "RO49RNCB0857180852250001",
      }),
    })

    const app = new Hono()
    app.use("*", async (c, next) => {
      c.set("db", {} as never)
      await next()
    })
    app.route("/", routes)

    const res = await app.request(
      "/bookings/book_123/initiate-collection",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          method: "card",
          startProvider: {
            provider: "netopia",
            payload: {
              billing: {
                email: "traveler@example.com",
                phone: "0712345678",
                firstName: "Ana",
                lastName: "Ionescu",
                city: "Bucharest",
                country: 642,
                state: "B",
                postalCode: "010101",
                details: "Main street 1",
              },
            },
          },
        }),
      },
      { APP_URL: "https://example.com" },
    )

    expect(res.status).toBe(201)
    expect(serviceMocks.initiateCheckoutCollection).toHaveBeenCalledTimes(1)

    const runtime = serviceMocks.initiateCheckoutCollection.mock.calls[0]?.[5]
    expect(runtime).toMatchObject({
      bankTransferDetails: {
        provider: "manual",
        beneficiary: "Program Travel",
        iban: "RO49RNCB0857180852250001",
      },
      publicCheckoutBaseUrl: "https://brand.example.com",
    })
    expect(runtime.paymentStarters.netopia).toBe(paymentStarter)
  })

  it("bootstraps checkout from a session id with the unified route", async () => {
    serviceMocks.bootstrapCheckoutCollection.mockResolvedValue({
      bookingId: "book_123",
      sessionId: "book_123",
      sourceType: "session",
      intent: "custom",
      plan: {
        bookingId: "book_123",
        method: "card",
        stage: "manual",
        paymentSessionTarget: "invoice",
        documentType: "invoice",
        willCreateDefaultPaymentPlan: false,
        selectedSchedule: null,
        selectedInvoice: null,
        amountCents: 25000,
        currency: "EUR",
        recommendedAction: "create_invoice_then_payment_session",
      },
      invoice: null,
      paymentSession: null,
      invoiceNotification: null,
      paymentSessionNotification: null,
      bankTransferInstructions: null,
      providerStart: null,
    })

    const routes = createCheckoutRoutes()
    const app = new Hono()
    app.use("*", async (c, next) => {
      c.set("db", {} as never)
      await next()
    })
    app.route("/", routes)

    const res = await app.request("/collections/bootstrap", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: "book_123",
        method: "card",
        stage: "manual",
        amountCents: 25000,
      }),
    })

    expect(res.status).toBe(201)
    expect(serviceMocks.bootstrapCheckoutCollection).toHaveBeenCalledTimes(1)
    expect(serviceMocks.bootstrapCheckoutCollection.mock.calls[0]?.[1]).toMatchObject({
      sessionId: "book_123",
      method: "card",
      stage: "manual",
      amountCents: 25000,
    })
  })
})
