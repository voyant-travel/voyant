import { handleApiError } from "@voyant-travel/hono"
import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import { createStorefrontPublicRoutes } from "../../src/routes-public.js"
import {
  describeStorefrontBootstrapError,
  STOREFRONT_BOOTSTRAP_ERROR_CODES,
} from "../../src/service-booking-session-bootstrap.js"

describe("storefront booking bootstrap error contract (issue voyant#1984)", () => {
  it("maps every known bootstrap status to a stable, machine-readable code", () => {
    expect(describeStorefrontBootstrapError("departure_not_found")).toMatchObject({
      code: "DEPARTURE_NOT_FOUND",
      httpStatus: 404,
      retryable: false,
    })
    expect(describeStorefrontBootstrapError("product_mismatch")).toMatchObject({
      code: "PRODUCT_MISMATCH",
      httpStatus: 409,
      retryable: false,
    })
    expect(describeStorefrontBootstrapError("invalid_slot")).toMatchObject({
      code: "SLOT_DEPARTURE_MISMATCH",
      httpStatus: 400,
    })
    // Reserve-time slot/item mismatches surfaced by the compat bootstrap path
    // (#2833) must map to their own codes instead of collapsing into the
    // generic BOOTSTRAP_FAILED fallback.
    expect(describeStorefrontBootstrapError("slot_product_mismatch")).toMatchObject({
      code: "SLOT_PRODUCT_MISMATCH",
      httpStatus: 409,
      retryable: false,
    })
    expect(describeStorefrontBootstrapError("slot_option_mismatch")).toMatchObject({
      code: "SLOT_OPTION_MISMATCH",
      httpStatus: 409,
      retryable: false,
    })
    // The one expected, retryable rejection — the caller re-quotes and retries.
    expect(describeStorefrontBootstrapError("stale_quote")).toMatchObject({
      code: "QUOTE_STALE",
      httpStatus: 409,
      retryable: true,
    })
  })

  it("falls back to BOOTSTRAP_FAILED for unrecognized statuses", () => {
    expect(describeStorefrontBootstrapError("some_unmapped_status")).toEqual({
      code: "BOOTSTRAP_FAILED",
      httpStatus: 409,
      retryable: false,
      message: "Unable to bootstrap booking session",
    })
  })

  it("only emits documented error codes", () => {
    const documented = new Set([
      "DEPARTURE_NOT_FOUND",
      "SLOT_NOT_FOUND",
      "PRODUCT_MISMATCH",
      "SLOT_PRODUCT_MISMATCH",
      "SLOT_OPTION_MISMATCH",
      "SLOT_DEPARTURE_MISMATCH",
      "PRICING_UNAVAILABLE",
      "QUOTE_STALE",
      "SLOT_UNAVAILABLE",
      "INSUFFICIENT_CAPACITY",
      "BOOTSTRAP_FAILED",
    ])
    for (const descriptor of Object.values(STOREFRONT_BOOTSTRAP_ERROR_CODES)) {
      expect(documented.has(descriptor.code)).toBe(true)
    }
  })

  it("validates the minimal compat-bootstrap contract before touching the database", async () => {
    const app = new Hono().onError(handleApiError).route("/", createStorefrontPublicRoutes())

    // Missing pax/productId — schema rejection happens before any DB access,
    // so this exercises the route without a live Postgres.
    const res = await app.request("/bookings/sessions/compat-bootstrap", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ departureId: "slot_123" }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ code: "invalid_request" })
  })
})
