import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

import {
  createPaymentLinkApiModule,
  createPaymentLinkRoutes,
  PAYMENT_LINK_ROUTE_PATHS,
  type PaymentLinkRoutesOptions,
} from "../../src/payment-link/routes.js"

/**
 * A tiny chainable stub that mimics the drizzle query-builder surface the
 * handlers use: `db.select(...).from(...).where(...).limit(...)` (awaitable),
 * optionally `.orderBy(...)`. Each call shifts the next queued result off
 * `rows`, so a test seeds the rows in the order the handler queries them.
 */
function makeDb(rows: unknown[][]) {
  let cursor = 0
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = chain
  builder.from = chain
  builder.where = chain
  builder.orderBy = chain
  builder.limit = chain
  // Make the builder awaitable — resolves to the next queued result set.
  // biome-ignore lint/suspicious/noThenProperty: test stub mimics a thenable drizzle query builder -- owner: storefront.
  ;(builder as { then: unknown }).then = (
    resolve: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => {
    try {
      const value = rows[cursor++] ?? []
      return Promise.resolve(value).then(resolve, reject)
    } catch (err) {
      return Promise.reject(err)
    }
  }
  return builder
}

function mountApp(options: PaymentLinkRoutesOptions, db: unknown) {
  const app = new Hono()
  app.use("*", async (c, next) => {
    c.set("db" as never, db as never)
    await next()
  })
  app.route("/", createPaymentLinkRoutes(options))
  return app
}

function stubOptions(overrides: Partial<PaymentLinkRoutesOptions> = {}): PaymentLinkRoutesOptions {
  return {
    resolveBankTransferDetails: vi.fn(async () => ({
      beneficiary: "Acme Travel SRL",
      iban: "RO49AAAA1B31007593840000",
      bankName: "Acme Bank",
    })),
    resolvePublicCheckoutBaseUrl: vi.fn(() => "https://checkout.example.com"),
    startCardPayment: vi.fn(async () => ({ configured: false }) as const),
    resolveTripData: vi.fn(async () => null),
    ...overrides,
  }
}

describe("createPaymentLinkRoutes", () => {
  it("describes the package-owned anonymous lazy route module", () => {
    const module = createPaymentLinkApiModule(stubOptions())

    expect(module).toMatchObject({
      module: { name: "payment-link" },
      publicPath: "/",
      anonymous: ["payment-link-config", "payment-link"],
    })
    expect(module.lazyRoutes?.paths).toBe(PAYMENT_LINK_ROUTE_PATHS)
    expect(module.lazyRoutes?.load).toBeTypeOf("function")
  })

  it("payment-link-config returns instructions + checkout base url with cache header", async () => {
    const options = stubOptions()
    const app = mountApp(options, makeDb([]))

    const res = await app.request("/v1/public/payment-link-config")

    expect(res.status).toBe(200)
    expect(res.headers.get("Cache-Control")).toBe(
      "public, s-maxage=300, stale-while-revalidate=600",
    )
    expect(await res.json()).toEqual({
      data: {
        publicCheckoutBaseUrl: "https://checkout.example.com",
        bankTransfer: {
          beneficiary: "Acme Travel SRL",
          iban: "RO49AAAA1B31007593840000",
          bankName: "Acme Bank",
        },
      },
    })
  })

  it("resolve returns the matched session id", async () => {
    const db = makeDb([[{ id: "ps_resolved" }]])
    const app = mountApp(stubOptions(), db)

    const res = await app.request("/v1/public/payment-link/resolve?ref=client-123")

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: { sessionId: "ps_resolved" } })
  })

  it("resolve 400s without a ref query param", async () => {
    const app = mountApp(stubOptions(), makeDb([]))

    const res = await app.request("/v1/public/payment-link/resolve")

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "ref query param is required" })
  })

  it("resolve 404s when no session matches", async () => {
    const app = mountApp(stubOptions(), makeDb([[]]))

    const res = await app.request("/v1/public/payment-link/resolve?ref=missing")

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: "Payment session not found" })
  })

  it("start-card 503s when the card processor is not configured", async () => {
    // First queued row: the session lookup (no redirectUrl → falls through to start).
    const db = makeDb([
      [
        {
          id: "ps_1",
          status: "pending",
          redirectUrl: null,
          payerName: null,
          payerEmail: null,
          notes: null,
        },
      ],
    ])
    const startCardPayment = vi.fn(async () => ({ configured: false }) as const)
    const app = mountApp(stubOptions({ startCardPayment }), db)

    const res = await app.request("/v1/public/payment-link/ps_1/start-card", { method: "POST" })

    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: "Card processor not configured" })
    expect(startCardPayment).toHaveBeenCalledOnce()
  })

  it("start-card refreshes a pre-completion redirect instead of reusing the stored url", async () => {
    const db = makeDb([
      [
        {
          id: "ps_1",
          status: "requires_redirect",
          redirectUrl: "https://pay.example.com/stale",
          payerName: "Ada Lovelace",
          payerEmail: "ada@example.com",
          notes: "Deposit",
        },
      ],
    ])
    const startCardPayment = vi.fn(
      async () =>
        ({
          configured: true,
          redirectUrl: "https://pay.example.com/fresh",
        }) as const,
    )
    const app = mountApp(stubOptions({ startCardPayment }), db)

    const res = await app.request("/v1/public/payment-link/ps_1/start-card", { method: "POST" })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      data: { redirectUrl: "https://pay.example.com/fresh" },
    })
    expect(startCardPayment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: "ps_1",
        payerName: "Ada Lovelace",
        payerEmail: "ada@example.com",
        notes: "Deposit",
        redirectUrl: "https://pay.example.com/stale",
      }),
    )
  })

  it("start-card preserves successful sessions without invoking the provider", async () => {
    const db = makeDb([
      [
        {
          id: "ps_1",
          status: "paid",
          redirectUrl: "https://pay.example.com/success",
        },
      ],
    ])
    const startCardPayment = vi.fn(async () => ({ configured: false }) as const)
    const app = mountApp(stubOptions({ startCardPayment }), db)

    const res = await app.request("/v1/public/payment-link/ps_1/start-card", { method: "POST" })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      data: { redirectUrl: "https://pay.example.com/success" },
    })
    expect(startCardPayment).not.toHaveBeenCalled()
  })

  it("start-card does not restart terminal failed sessions", async () => {
    const db = makeDb([
      [
        {
          id: "ps_1",
          status: "failed",
          redirectUrl: "https://pay.example.com/failed",
        },
      ],
    ])
    const startCardPayment = vi.fn(
      async () =>
        ({
          configured: true,
          redirectUrl: "https://pay.example.com/fresh",
        }) as const,
    )
    const app = mountApp(stubOptions({ startCardPayment }), db)

    const res = await app.request("/v1/public/payment-link/ps_1/start-card", { method: "POST" })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: { redirectUrl: null } })
    expect(startCardPayment).not.toHaveBeenCalled()
  })

  it("start-card 404s when the session is missing", async () => {
    const app = mountApp(stubOptions(), makeDb([[]]))

    const res = await app.request("/v1/public/payment-link/ps_missing/start-card", {
      method: "POST",
    })

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: "Session not found" })
  })

  it("checkout-status reports pending and surfaces the latest session", async () => {
    const db = makeDb([
      // booking lookup
      [
        {
          id: "bk_1",
          bookingNumber: "B-1001",
          status: "awaiting_payment",
          updatedAt: new Date("2026-06-15T10:00:00Z"),
        },
      ],
      // payment sessions lookup
      [
        {
          id: "ps_latest",
          status: "pending",
          amountCents: 12000,
          currency: "RON",
          invoiceId: null,
          paymentMethod: "credit_card",
          completedAt: null,
          failedAt: null,
          updatedAt: new Date("2026-06-15T11:00:00Z"),
        },
      ],
    ])
    const app = mountApp(stubOptions(), db)

    const res = await app.request("/v1/public/bookings/bk_1/checkout-status")

    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: Record<string, unknown> }
    expect(body.data).toMatchObject({
      bookingId: "bk_1",
      bookingNumber: "B-1001",
      bookingStatus: "awaiting_payment",
      paymentStatus: "pending",
      bankTransferInstructions: null,
    })
    expect((body.data.session as { id: string }).id).toBe("ps_latest")
  })

  it("checkout-status reports paid when a session is authorized and attaches bank-transfer instructions", async () => {
    const db = makeDb([
      // booking lookup
      [
        {
          id: "bk_2",
          bookingNumber: "B-2002",
          status: "awaiting_payment",
          updatedAt: new Date("2026-06-15T10:00:00Z"),
        },
      ],
      // payment sessions lookup (bank_transfer + invoice present)
      [
        {
          id: "ps_bt",
          status: "authorized",
          amountCents: 50000,
          currency: "RON",
          invoiceId: "inv_1",
          paymentMethod: "bank_transfer",
          completedAt: null,
          failedAt: null,
          updatedAt: new Date("2026-06-15T12:00:00Z"),
        },
      ],
      // invoice lookup inside buildPublicBankTransferInstructions
      [
        {
          invoiceNumber: "PRO-1",
          dueDate: "2026-07-01",
          balanceDueCents: 50000,
          currency: "RON",
        },
      ],
    ])
    const app = mountApp(stubOptions(), db)

    const res = await app.request("/v1/public/bookings/bk_2/checkout-status")

    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: Record<string, unknown> }
    expect(body.data.paymentStatus).toBe("paid")
    expect(body.data.bankTransferInstructions).toMatchObject({
      beneficiary: "Acme Travel SRL",
      iban: "RO49AAAA1B31007593840000",
      reference: "BOOK-B-2002",
      proformaNumber: "PRO-1",
    })
  })

  it("checkout-status 404s when the booking is missing", async () => {
    const app = mountApp(stubOptions(), makeDb([[]]))

    const res = await app.request("/v1/public/bookings/bk_missing/checkout-status")

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: "Booking not found" })
  })
})
