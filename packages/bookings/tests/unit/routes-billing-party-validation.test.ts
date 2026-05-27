import { createEventBus } from "@voyantjs/core"
import { newId } from "@voyantjs/db/lib/typeid"
import { handleApiError } from "@voyantjs/hono"
import { Hono } from "hono"
import { afterEach, describe, expect, it, vi } from "vitest"

import { BOOKING_ROUTE_RUNTIME_CONTAINER_KEY } from "../../src/route-runtime.js"
import { bookingRoutes } from "../../src/routes.js"
import { bookingsService, normalizeBookingBillingPartyUpdate } from "../../src/service.js"

const json = (body: Record<string, unknown>) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

function createAppWithMissingBillingPartyReferences() {
  return new Hono()
    .onError(handleApiError)
    .use("*", async (c, next) => {
      c.set("db" as never, {})
      c.set("eventBus" as never, createEventBus())
      c.set("userId" as never, "test-user")
      c.set("actor" as never, "staff")
      c.set("container" as never, {
        resolve: (key: string) => {
          if (key !== BOOKING_ROUTE_RUNTIME_CONTAINER_KEY) return undefined

          return {
            resolveBillingOrganizationById: vi.fn(async () => false),
            resolveBillingPersonById: vi.fn(async () => false),
          }
        },
      })
      await next()
    })
    .route("/", bookingRoutes)
}

describe("booking route billing-party validation", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("rejects nonexistent organization references for reservation creates", async () => {
    const reserveSpy = vi.spyOn(bookingsService, "reserveBooking")
    const app = createAppWithMissingBillingPartyReferences()

    const res = await app.request("/reserve", {
      method: "POST",
      ...json({
        bookingNumber: "BK-RES-BILLING-001",
        sellCurrency: "USD",
        organizationId: newId("organizations"),
        items: [
          {
            title: "Adult ticket",
            availabilitySlotId: "slot_abc",
          },
        ],
      }),
    })

    expect(res.status).toBe(400)
    expect(reserveSpy).not.toHaveBeenCalled()
  })

  it("rejects nonexistent person references for product creates", async () => {
    const createFromProductSpy = vi.spyOn(bookingsService, "createBookingFromProduct")
    const app = createAppWithMissingBillingPartyReferences()

    const res = await app.request("/from-product", {
      method: "POST",
      ...json({
        productId: "prod_abc",
        bookingNumber: "BK-PROD-BILLING-001",
        personId: newId("people"),
      }),
    })

    expect(res.status).toBe(400)
    expect(createFromProductSpy).not.toHaveBeenCalled()
  })
})

describe("normalizeBookingBillingPartyUpdate", () => {
  it("clears organizationId when switching to a person billing party", () => {
    const personId = newId("people")

    expect(normalizeBookingBillingPartyUpdate({ personId })).toEqual({
      personId,
      organizationId: null,
    })
  })

  it("clears personId when switching to an organization billing party", () => {
    const organizationId = newId("organizations")

    expect(normalizeBookingBillingPartyUpdate({ organizationId })).toEqual({
      organizationId,
      personId: null,
    })
  })
})
