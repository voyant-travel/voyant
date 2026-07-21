import { createContainer } from "@voyant-travel/core"
import { assembleAnonymousPaths } from "@voyant-travel/hono"
import { describe, expect, it, vi } from "vitest"

import {
  createStorefrontApiModule,
  STOREFRONT_BOOKING_BOOTSTRAP_RUNTIME_KEY,
  storefrontAnonymousPublicPaths,
} from "../../src/index.js"

describe("createStorefrontApiModule", () => {
  it("declares only the guest storefront route families next to the owned public routes", () => {
    const module = createStorefrontApiModule()

    expect(module.publicPath).toBe("/")
    expect(module.anonymous).toBe(storefrontAnonymousPublicPaths)
    expect(module.anonymous).toEqual([
      "/bookings",
      "/departures",
      "/leads",
      "/newsletter",
      "/offers",
      "/settings",
    ])
    expect(assembleAnonymousPaths([module], [])).toEqual([
      "/v1/public/bookings",
      "/v1/public/departures",
      "/v1/public/leads",
      "/v1/public/newsletter",
      "/v1/public/offers",
      "/v1/public/settings",
    ])

    const anonymouslyMatchedDepartureAndSettingsRoutes = new Set(
      module.publicRoutes?.routes
        .filter(
          ({ path }) =>
            path === "/settings" ||
            path.startsWith("/settings/") ||
            path.startsWith("/departures/"),
        )
        .map(({ method, path }) => `${method} ${path}`),
    )

    expect([...anonymouslyMatchedDepartureAndSettingsRoutes]).toEqual([
      "GET /settings",
      "GET /departures/:departureId",
      "POST /departures/:departureId/price",
      "POST /departures/:departureId/eligibility",
    ])
  })

  it("registers runtime dependencies without subscribing outside graph lowering", async () => {
    const withDb = vi.fn()
    const module = createStorefrontApiModule({ bookingIntents: { withDb } })
    const container = createContainer()
    const eventBus = { subscribe: vi.fn() }

    await module.module.bootstrap?.({ bindings: {}, container, eventBus } as never)

    expect(container.has(STOREFRONT_BOOKING_BOOTSTRAP_RUNTIME_KEY)).toBe(true)
    expect(eventBus.subscribe).not.toHaveBeenCalled()
  })
})
