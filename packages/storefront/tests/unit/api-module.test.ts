import { createContainer } from "@voyant-travel/core"
import { describe, expect, it, vi } from "vitest"

import {
  createStorefrontApiModule,
  STOREFRONT_BOOKING_BOOTSTRAP_RUNTIME_KEY,
  storefrontAnonymousPublicPaths,
} from "../../src/index.js"

describe("createStorefrontApiModule", () => {
  it("declares anonymous storefront offer paths next to the owned public routes", () => {
    const module = createStorefrontApiModule()

    expect(module.publicPath).toBe("/")
    expect(module.anonymous).toBe(storefrontAnonymousPublicPaths)
    expect(module.anonymous).toContain("/offers")
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
