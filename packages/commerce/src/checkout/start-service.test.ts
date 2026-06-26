import { handleApiError } from "@voyant-travel/hono"
import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"
import type { CheckoutStartOptions } from "./options.js"
import { createCatalogCheckoutRoutes } from "./routes.js"
import { CatalogCheckoutStartError, startCatalogCheckout } from "./start-service.js"

function stubOptions(overrides: Partial<CheckoutStartOptions> = {}): CheckoutStartOptions {
  return {
    resolveBookingTaxSettings: vi.fn(),
    getOwnedProductName: vi.fn().mockResolvedValue(null),
    resolveBankTransferInstructions: vi
      .fn()
      .mockResolvedValue({ beneficiary: "Acme", iban: "RO00", bankName: "Bank" }),
    ...overrides,
  }
}

/** Stub db whose first `select().from().where().limit()` returns `bookingRows`. */
function stubDb(bookingRows: unknown[]) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => bookingRows }),
      }),
    }),
  } as never
}

describe("startCatalogCheckout", () => {
  it("places a hold for an existing booking", async () => {
    const booking = { id: "bk_1", status: "on_hold", holdExpiresAt: null }
    const result = await startCatalogCheckout(
      {
        db: stubDb([booking]),
        env: {},
        options: stubOptions(),
      },
      { bookingId: "bk_1", paymentIntent: "hold" },
    )
    expect(result).toEqual({ kind: "hold_placed", bookingId: "bk_1" })
  })

  it("throws booking_not_found when no booking + no snapshot materializes", async () => {
    // No booking row, and the snapshot lookup (dynamic import of catalog)
    // returns nothing → materializeBookingFromSnapshot yields null.
    const db = stubDb([])
    const err = await startCatalogCheckout(
      { db, env: {}, options: stubOptions() },
      { bookingId: "missing", paymentIntent: "hold" },
    ).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(CatalogCheckoutStartError)
    expect(err).toMatchObject({ code: "booking_not_found", status: 404 })
  })
})

describe("createCatalogCheckoutRoutes", () => {
  it("returns 400 on an invalid checkout body", async () => {
    // Invalid body fails schema validation before the handler reads `db`,
    // so no db wiring is needed for the 400 path. The `@hono/zod-openapi`
    // validation hook throws a `RequestValidationError`; the framework's
    // `handleApiError` (wired via `onError` as `createApp` does) normalizes it to
    // the shared `{ error, code: "invalid_request", ... }` 400 contract.
    const app = new Hono()
      .onError(handleApiError)
      .route("/v1/public/catalog", createCatalogCheckoutRoutes(stubOptions()))

    const res = await app.request("/v1/public/catalog/checkout/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookingId: "", paymentIntent: "nope" }),
    })
    expect(res.status).toBe(400)
  })
})
