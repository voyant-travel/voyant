import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import { createStorefrontPublicRoutes } from "../../src/routes-public.js"
import { storefrontBookingSessionBootstrapInputSchema } from "../../src/validation-booking-bootstrap.js"

function validBootstrapInput() {
  return {
    departureId: "avsl_departure",
    slotId: "avsl_departure",
    quote: {
      currency: "eur",
      totalSellAmountCents: 100000,
      quotedAt: "2026-05-14T10:00:00.000Z",
      expiresAt: "2026-12-31T00:00:00.000Z",
    },
    session: {
      sellCurrency: "EUR",
      items: [
        {
          title: "Booking bootstrap",
          availabilitySlotId: "avsl_departure",
          quantity: 1,
        },
      ],
    },
  }
}

describe("storefront booking session bootstrap validation", () => {
  it("requires session, departure, and slot inputs", () => {
    expect(
      storefrontBookingSessionBootstrapInputSchema.safeParse({
        ...validBootstrapInput(),
        session: undefined,
      }).success,
    ).toBe(false)
    expect(
      storefrontBookingSessionBootstrapInputSchema.safeParse({
        ...validBootstrapInput(),
        departureId: "",
      }).success,
    ).toBe(false)
    expect(
      storefrontBookingSessionBootstrapInputSchema.safeParse({
        ...validBootstrapInput(),
        slotId: "",
      }).success,
    ).toBe(false)
  })

  it("normalizes quote currency and validates repricing selection shape", () => {
    const result = storefrontBookingSessionBootstrapInputSchema.safeParse({
      ...validBootstrapInput(),
      reprice: {
        selections: [
          {
            itemIndex: 0,
            optionUnitId: "ount_double",
            quantity: 1,
          },
        ],
      },
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.quote.currency).toBe("EUR")
      expect(result.data.reprice?.applyToSession).toBe(true)
      expect(result.data.reprice?.selections[0]?.itemIndex).toBe(0)
    }
  })

  it("rejects stale quote bootstrap requests before touching storage", async () => {
    const app = new Hono().route("/", createStorefrontPublicRoutes())

    const res = await app.request("/bookings/sessions/bootstrap", {
      method: "POST",
      body: JSON.stringify({
        ...validBootstrapInput(),
        quote: {
          currency: "EUR",
          totalSellAmountCents: 100000,
          expiresAt: "2020-01-01T00:00:00.000Z",
        },
      }),
      headers: { "content-type": "application/json" },
    })

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: "Storefront quote has expired" })
  })
})
