import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

import { createAppsAppApiRoutes } from "./app-api-routes.js"

type TestEnv = {
  Bindings: Record<string, never>
  Variables: {
    db: PostgresJsDatabase
    callerType: string
    appId: string
    appInstallationId: string
    appReleaseId: string
    appTokenMode: "offline" | "online"
    scopes: string[]
  }
}

describe("managed Marketplace setup App API", () => {
  it("derives every completion coordinate from the verified app token context", async () => {
    const completeMarketplaceSetup = vi.fn(async () => undefined)
    const app = authenticatedApp({ completeMarketplaceSetup })

    const response = await app.request("/v1/app/marketplace/setup-completion", {
      method: "POST",
      headers: { "content-type": "application/json" },
      // Caller-selected identity fields are deliberately not parsed.
      body: JSON.stringify({
        appId: "app_attacker",
        installationId: "apin_attacker",
        releaseId: "rel_attacker",
      }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: { acknowledged: true },
    })
    expect(completeMarketplaceSetup).toHaveBeenCalledWith({
      appId: "app_1",
      installationId: "apin_1",
      releaseId: "rel_1",
      tokenMode: "offline",
      viewerId: undefined,
      contextConstraint: undefined,
      scopes: [],
      apiVersion: undefined,
    })
  })

  it("does not expose the completion operation in a self-hosted runtime", async () => {
    const app = authenticatedApp()

    const response = await app.request("/v1/app/marketplace/setup-completion", { method: "POST" })

    expect(response.status).toBe(404)
  })

  it("rejects requests without an App API access-token context", async () => {
    const completeMarketplaceSetup = vi.fn(async () => undefined)
    const app = new Hono<TestEnv>()
    app.use("*", async (c, next) => {
      c.set("db", {} as PostgresJsDatabase)
      c.set("callerType", "staff")
      await next()
    })
    app.route("/", createAppsAppApiRoutes({ completeMarketplaceSetup }))

    const response = await app.request("/v1/app/marketplace/setup-completion", { method: "POST" })

    expect(response.status).toBe(401)
    expect(completeMarketplaceSetup).not.toHaveBeenCalled()
  })
})

function authenticatedApp(
  options: {
    completeMarketplaceSetup?: Parameters<
      typeof createAppsAppApiRoutes
    >[0]["completeMarketplaceSetup"]
  } = {},
) {
  const app = new Hono<TestEnv>()
  app.use("*", async (c, next) => {
    c.set("db", {} as PostgresJsDatabase)
    c.set("callerType", "app")
    c.set("appId", "app_1")
    c.set("appInstallationId", "apin_1")
    c.set("appReleaseId", "rel_1")
    c.set("appTokenMode", "offline")
    c.set("scopes", [])
    await next()
  })
  app.route("/", createAppsAppApiRoutes(options))
  return app
}
