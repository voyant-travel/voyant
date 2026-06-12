import { handleApiError } from "@voyantjs/hono"
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

import {
  issueCheckoutCapability,
  issueGuestBookingAccess,
} from "@voyantjs/bookings/checkout-capability"
import { createCheckoutRoutes } from "../../src/routes.js"

const TEST_CAPABILITY_ENV = {
  SESSION_CLAIMS_SECRET: "checkout-capability-test-secret-32chars",
}

async function capabilityHeaders(bookingId = "book_123") {
  const capability = await issueCheckoutCapability(bookingId, TEST_CAPABILITY_ENV)
  return { "X-Voyant-Checkout-Capability": capability.token }
}

async function guestAccessHeaders(bookingId = "book_123") {
  const capability = await issueGuestBookingAccess(bookingId, TEST_CAPABILITY_ENV)
  return { "X-Voyant-Guest-Booking-Access": capability.token }
}

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
    app.onError(handleApiError)
    app.use("*", async (c, next) => {
      c.set("db", {} as never)
      await next()
    })
    app.route("/", routes)

    const res = await app.request(
      "/bookings/book_123/initiate-collection",
      {
        method: "POST",
        headers: { "content-type": "application/json", ...(await capabilityHeaders()) },
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
      { APP_URL: "https://example.com", ...TEST_CAPABILITY_ENV },
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

  it("rejects booking collection routes without a checkout capability", async () => {
    const routes = createCheckoutRoutes()
    const app = new Hono()
    app.onError(handleApiError)
    app.use("*", async (c, next) => {
      c.set("db", {} as never)
      await next()
    })
    app.route("/", routes)

    const res = await app.request(
      "/bookings/book_123/collection-plan",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      },
      TEST_CAPABILITY_ENV,
    )

    expect(res.status).toBe(401)
    expect(serviceMocks.previewCheckoutCollection).not.toHaveBeenCalled()
  })

  it("accepts guest booking access for booking-scoped collection routes", async () => {
    serviceMocks.previewCheckoutCollection.mockResolvedValue({
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
    })

    const routes = createCheckoutRoutes()
    const app = new Hono()
    app.onError(handleApiError)
    app.use("*", async (c, next) => {
      c.set("db", {} as never)
      await next()
    })
    app.route("/", routes)

    const res = await app.request(
      "/bookings/book_123/collection-plan",
      {
        method: "POST",
        headers: { "content-type": "application/json", ...(await guestAccessHeaders()) },
        body: JSON.stringify({ method: "card" }),
      },
      TEST_CAPABILITY_ENV,
    )

    expect(res.status).toBe(200)
    expect(serviceMocks.previewCheckoutCollection).toHaveBeenCalledTimes(1)
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

  it("replays a duplicate bootstrap with the same Idempotency-Key instead of bootstrapping twice", async () => {
    serviceMocks.bootstrapCheckoutCollection.mockResolvedValue({
      bookingId: "book_123",
      sessionId: "book_123",
      sourceType: "session",
      intent: "custom",
      plan: null,
      invoice: null,
      paymentSession: null,
      invoiceNotification: null,
      paymentSessionNotification: null,
      bankTransferInstructions: null,
      providerStart: null,
    })

    // In-memory fake of the drizzle chain the idempotencyKey middleware
    // uses. Predicates are ignored — this test exercises a single
    // (scope, key) pair, so "first stored row" is the matched row.
    // biome-ignore lint/suspicious/noExplicitAny: structural fake of drizzle's chain -- owner: checkout; existing suppression is intentional pending typed cleanup.
    const storedRows: any[] = []
    const dbFake = {
      select: () => ({
        from: () => ({
          where: () => ({ limit: async () => storedRows.slice(0, 1) }),
        }),
      }),
      insert: () => ({
        // biome-ignore lint/suspicious/noExplicitAny: structural fake of drizzle's chain -- owner: checkout; existing suppression is intentional pending typed cleanup.
        values: (value: any) => ({
          onConflictDoNothing: async () => {
            storedRows.push(value)
          },
        }),
      }),
      delete: () => ({
        where: async () => {
          storedRows.length = 0
        },
      }),
    }

    const routes = createCheckoutRoutes()
    const app = new Hono()
    app.use("*", async (c, next) => {
      c.set("db", dbFake as never)
      await next()
    })
    app.route("/", routes)

    const request = () =>
      app.request("/collections/bootstrap", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": "bootstrap-once",
        },
        body: JSON.stringify({
          sessionId: "book_123",
          method: "card",
          stage: "manual",
          amountCents: 25000,
        }),
      })

    const first = await request()
    expect(first.status).toBe(201)
    expect(serviceMocks.bootstrapCheckoutCollection).toHaveBeenCalledTimes(1)
    expect(storedRows).toHaveLength(1)

    const second = await request()
    expect(second.status).toBe(201)
    expect(second.headers.get("Idempotency-Replayed")).toBe("true")
    expect(serviceMocks.bootstrapCheckoutCollection).toHaveBeenCalledTimes(1)

    const firstBody = await first.clone().json()
    const secondBody = await second.json()
    expect(secondBody).toEqual(firstBody)
  })
})
