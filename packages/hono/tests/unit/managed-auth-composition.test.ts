import { Hono } from "hono"
import { describe, expect, it } from "vitest"
import { mountApp } from "../../src/app.js"
import type { ApiModule } from "../../src/module.js"
import type { VoyantBindings } from "../../src/types.js"

const TEST_ENV: VoyantBindings = { DATABASE_URL: "postgres://test" }

describe("managed auth composition", () => {
  it("opens only the exact declared client-authenticated method and path", async () => {
    const routes = new Hono()
      .post("/oauth/token", (c) => c.json({ route: "token" }))
      .get("/oauth/token", (c) => c.json({ route: "token-get" }))
      .post("/oauth/token/extra", (c) => c.json({ route: "token-extra" }))
      .post("/oauth/authorize", (c) => c.json({ route: "authorize" }))
    const mod: ApiModule = {
      module: { name: "apps" },
      adminRoutes: routes,
      clientAuthenticated: [{ method: "POST", path: "/oauth/token" }],
    }
    const app = mountApp({
      // biome-ignore lint/suspicious/noExplicitAny: test doesn't use db -- owner: hono.
      db: () => ({}) as any,
      modules: [mod],
    })

    const token = await app.request("/v1/admin/apps/oauth/token", { method: "POST" }, TEST_ENV)
    const wrongMethod = await app.request("/v1/admin/apps/oauth/token", {}, TEST_ENV)
    const sibling = await app.request(
      "/v1/admin/apps/oauth/token/extra",
      { method: "POST" },
      TEST_ENV,
    )
    const authorize = await app.request(
      "/v1/admin/apps/oauth/authorize",
      { method: "POST" },
      TEST_ENV,
    )

    expect(token.status).toBe(200)
    expect(wrongMethod.status).toBe(401)
    expect(sibling.status).toBe(401)
    expect(authorize.status).toBe(401)
  })

  it("augments app-token auth without replacing the host staff resolver", async () => {
    const appApi = new Hono().get("/v1/app/ping", (c) =>
      c.json({ callerType: c.get("callerType") }),
    )
    const mod: ApiModule = {
      module: { name: "apps" },
      adminRoutes: new Hono().get("/ping", (c) => c.json({ callerType: c.get("callerType") })),
      lazyRoutes: {
        paths: ["/v1/app", "/v1/app/*"],
        load: async () => appApi,
      },
      authAugmentation: {
        resolveAppToken: ({ token }) =>
          token === "app_access_test"
            ? {
                callerType: "app",
                actor: "staff",
                appInstallationId: "installation-1",
                scopes: ["apps:read"],
              }
            : null,
      },
    }
    const app = mountApp({
      // biome-ignore lint/suspicious/noExplicitAny: test doesn't use db -- owner: hono.
      db: () => ({}) as any,
      modules: [mod],
      auth: {
        resolve: ({ request }) =>
          request.headers.get("cookie") === "staff=1"
            ? { userId: "staff-1", actor: "staff" }
            : null,
      },
    })

    const appToken = await app.request(
      "/v1/app/ping",
      { headers: { Authorization: "Bearer app_access_test" } },
      TEST_ENV,
    )
    const appTokenOnAdmin = await app.request(
      "/v1/admin/apps/ping",
      { headers: { Authorization: "Bearer app_access_test" } },
      TEST_ENV,
    )
    const staff = await app.request(
      "/v1/admin/apps/ping",
      { headers: { Cookie: "staff=1" } },
      TEST_ENV,
    )

    expect(appToken.status).toBe(200)
    expect(await appToken.json()).toEqual({ callerType: "app" })
    expect(appTokenOnAdmin.status).toBe(401)
    expect(staff.status).toBe(200)
  })

  it("applies the public-write rate limit to client-authenticated exchanges", async () => {
    let hits = 0
    const mod: ApiModule = {
      module: { name: "apps" },
      adminRoutes: new Hono().post("/oauth/token", (c) => c.json({ ok: true })),
      clientAuthenticated: [{ method: "POST", path: "/oauth/token" }],
    }
    const app = mountApp({
      // biome-ignore lint/suspicious/noExplicitAny: test doesn't use db -- owner: hono.
      db: () => ({}) as any,
      modules: [mod],
      rateLimit: {
        auth: false,
        publicWrite: { max: 1, windowSeconds: 60 },
        store: {
          limit: async () => {
            hits += 1
            return { allowed: hits <= 1, remaining: Math.max(0, 1 - hits) }
          },
        },
      },
    })

    const first = await app.request("/v1/admin/apps/oauth/token", { method: "POST" }, TEST_ENV)
    const second = await app.request("/v1/admin/apps/oauth/token", { method: "POST" }, TEST_ENV)

    expect(first.status).toBe(200)
    expect(second.status).toBe(429)
  })
})
