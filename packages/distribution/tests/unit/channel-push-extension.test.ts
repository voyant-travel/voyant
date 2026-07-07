import { createSourceAdapterRegistry } from "@voyant-travel/catalog/booking-engine"
import { Hono } from "hono"
import { afterEach, describe, expect, it } from "vitest"

import { createChannelPushExtension } from "../../src/channel-push/extension.js"
import {
  type ChannelPushDeps,
  clearChannelPushDeps,
  getChannelPushDeps,
} from "../../src/channel-push/types.js"

describe("channel-push extension", () => {
  afterEach(() => {
    clearChannelPushDeps()
  })

  it("mounts package-owned admin routes and wires channel-push deps per request", async () => {
    const db = new Proxy(
      {},
      {
        get() {
          throw new Error("db should not be called by this route")
        },
      },
    ) as ChannelPushDeps["db"]
    const registry = createSourceAdapterRegistry()
    const extension = createChannelPushExtension({
      resolveDb: () => db,
      resolveRegistry: () => registry,
    })
    const app = new Hono()
    if (extension.adminRoutes) {
      app.route("/", extension.adminRoutes)
    }

    const response = await app.request("/reconcile/not-a-flow", { method: "POST" })

    expect(extension.extension).toEqual({ name: "channel-push", module: "distribution" })
    expect(extension.adminRoutes?.routes.length).toBeGreaterThan(0)
    expect(extension.lazyAdminRoutes).toBeUndefined()
    expect(response.status).toBe(400)
    expect(getChannelPushDeps()?.db).toBe(db)
    expect(getChannelPushDeps()?.registry).toBe(registry)
  })
})
