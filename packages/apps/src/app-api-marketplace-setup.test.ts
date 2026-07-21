import { handleApiError } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

import { createAppsAppApiRoutes } from "./app-api-routes.js"

type RouteOptions = NonNullable<Parameters<typeof createAppsAppApiRoutes>[0]>

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

  it("accepts a zero-byte POST represented by an empty request stream", async () => {
    const completeMarketplaceSetup = vi.fn(async () => undefined)
    const app = authenticatedApp({ completeMarketplaceSetup })
    const request = new Request("http://test/v1/app/marketplace/setup-completion", {
      method: "POST",
      body: "",
    })

    expect(request.body).not.toBeNull()
    const response = await app.request(request)

    expect(response.status).toBe(200)
    expect(completeMarketplaceSetup).toHaveBeenCalledOnce()
  })

  it("rejects caller-selected identity fields instead of parsing them", async () => {
    const completeMarketplaceSetup = vi.fn(async () => undefined)
    const app = authenticatedApp({ completeMarketplaceSetup })

    const response = await app.request("/v1/app/marketplace/setup-completion", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        appId: "app_attacker",
        installationId: "apin_attacker",
        releaseId: "rel_attacker",
      }),
    })

    expect(response.status).toBe(400)
    expect(completeMarketplaceSetup).not.toHaveBeenCalled()
  })

  it("does not expose the completion operation in a self-hosted runtime", async () => {
    const app = authenticatedApp()

    const response = await app.request("/v1/app/marketplace/setup-completion", { method: "POST" })

    expect(response.status).toBe(404)
  })

  it("rejects requests without an App API access-token context", async () => {
    const completeMarketplaceSetup = vi.fn(async () => undefined)
    const app = new Hono<TestEnv>()
    app.onError((error, c) => handleApiError(error, c))
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
  options: { completeMarketplaceSetup?: RouteOptions["completeMarketplaceSetup"] } = {},
) {
  const app = new Hono<TestEnv>()
  app.onError((error, c) => handleApiError(error, c))
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
