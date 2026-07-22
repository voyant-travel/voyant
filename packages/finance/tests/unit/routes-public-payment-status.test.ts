import { handleApiError } from "@voyant-travel/hono"
import { PAYMENT_ADAPTER_CONTRACT_VERSION, type PaymentAdapter } from "@voyant-travel/payments"
import { Hono } from "hono"
import { beforeEach, describe, expect, it, vi } from "vitest"

const routeMocks = vi.hoisted(() => ({
  getPaymentSession: vi.fn(),
  refreshPaymentSessionFromPaymentAdapterStatus: vi.fn(),
}))

vi.mock("../../src/service-public.js", () => ({
  publicFinanceService: {
    getPaymentSession: routeMocks.getPaymentSession,
  },
}))

vi.mock("../../src/payment-adapter-status.js", () => ({
  refreshPaymentSessionFromPaymentAdapterStatus:
    routeMocks.refreshPaymentSessionFromPaymentAdapterStatus,
}))

import { createPublicFinanceRoutes } from "../../src/routes-public.js"

const paymentSession = {
  id: "psess_0000000000000000000000000",
  target: null,
  provenance: null,
  targetType: "invoice",
  targetId: "inv_0000000000000000000000000",
  bookingId: "book_000000000000000000000000",
  legacyOrderId: null,
  invoiceId: "inv_0000000000000000000000000",
  bookingPaymentScheduleId: null,
  bookingGuaranteeId: null,
  status: "processing",
  provider: "netopia",
  providerConnectionId: "payment_connection_123",
  providerSessionId: "provider_session_123",
  providerPaymentId: "provider_payment_123",
  externalReference: null,
  clientReference: null,
  currency: "EUR",
  amountCents: 12000,
  paymentMethod: "credit_card",
  payerEmail: null,
  payerName: null,
  redirectUrl: null,
  returnUrl: null,
  cancelUrl: null,
  expiresAt: null,
  completedAt: null,
  failureCode: null,
  failureMessage: null,
  notes: null,
}

describe("createPublicFinanceRoutes payment-session status refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routeMocks.getPaymentSession.mockResolvedValue(paymentSession)
    routeMocks.refreshPaymentSessionFromPaymentAdapterStatus.mockResolvedValue(null)
  })

  it("invokes the selected adapter status refresher before returning the public session", async () => {
    const db = {}
    const adapter = stubAdapter()
    const app = createApp(db, adapter)

    const res = await app.request(
      `/payment-sessions/${paymentSession.id}`,
      {},
      { APP_URL: "https://checkout.example.com" },
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: paymentSession })
    expect(routeMocks.refreshPaymentSessionFromPaymentAdapterStatus).toHaveBeenCalledWith(
      db,
      paymentSession.id,
      expect.objectContaining({
        adapter,
        context: {
          env: expect.objectContaining({ APP_URL: "https://checkout.example.com" }),
        },
      }),
    )
    expect(routeMocks.getPaymentSession).toHaveBeenCalledWith(db, paymentSession.id)
  })

  it("preserves read behavior when the selected adapter status refresh fails", async () => {
    routeMocks.refreshPaymentSessionFromPaymentAdapterStatus.mockRejectedValueOnce(
      new Error("provider timeout with private details"),
    )
    const db = {}
    const app = createApp(db, stubAdapter())

    const res = await app.request(`/payment-sessions/${paymentSession.id}`)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: paymentSession })
  })
})

function createApp(db: unknown, adapter: PaymentAdapter) {
  const app = new Hono()
  app.onError(handleApiError)
  app.use("*", async (c, next) => {
    c.set("db" as never, db)
    await next()
  })
  app.route(
    "/",
    createPublicFinanceRoutes({
      resolveSelectedPaymentAdapter: () => adapter,
    }),
  )
  return app
}

function stubAdapter(): PaymentAdapter {
  return {
    id: "selected-test-adapter",
    label: "Selected Test Adapter",
    contractVersion: PAYMENT_ADAPTER_CONTRACT_VERSION,
    mode: "test",
    capabilities: {
      hostedCheckout: true,
      redirectCheckout: true,
      authorize: false,
      capture: false,
      void: false,
      refund: false,
      status: true,
      callbackSignatureVerification: true,
      idempotencyKeys: true,
      retrySafeInitiation: true,
    },
    initiate: vi.fn(async (_context, input) => ({
      nextState: "processing",
      idempotencyKey: input.idempotencyKey,
    })),
    verifyCallback: vi.fn(async () => ({ verified: false, reason: "malformed" })),
    health: vi.fn(async () => ({
      status: "ok",
      checkedAt: "2026-07-18T00:00:00.000Z",
    })),
    status: vi.fn(async () => ({ nextState: "processing" })),
  }
}
