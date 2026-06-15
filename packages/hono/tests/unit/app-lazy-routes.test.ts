import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

import { createApp } from "../../src/app.js"
import type { HonoModule } from "../../src/module.js"
import type { VoyantBindings } from "../../src/types.js"

const TEST_ENV: VoyantBindings = { DATABASE_URL: "postgres://test" }
const TEST_CTX = {
  waitUntil: () => {},
  passThroughOnException: () => {},
  // biome-ignore lint/suspicious/noExplicitAny: mock ExecutionContext for tests -- owner: hono.
} as any

describe("createApp lazy route mounting", () => {
  it("mounts lazyAdminRoutes under /v1/admin/{name} and bridges the request context", async () => {
    const marker = { name: "leased-db" }
    const load = vi.fn(async () =>
      // Relative routes, exactly like eager adminRoutes.
      new Hono().get("/ping", (c) =>
        c.json({ surface: "lazy-admin", db: (c.get("db") as { name: string }).name }),
      ),
    )
    const mod: HonoModule = { module: { name: "flights" }, lazyAdminRoutes: load }

    const app = createApp({
      // biome-ignore lint/suspicious/noExplicitAny: structural db client -- owner: hono.
      db: () => marker as any,
      modules: [mod],
      auth: { resolve: () => ({ userId: "u1", actor: "staff" }) },
    })

    // Not loaded until the first matching request.
    expect(load).not.toHaveBeenCalled()

    const res = await app.request("/v1/admin/flights/ping", {}, TEST_ENV, TEST_CTX)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { surface: string; db: string }
    expect(body.surface).toBe("lazy-admin")
    // Context bridged: the lazy route saw the db the createApp middleware leased.
    expect(body.db).toBe("leased-db")
    expect(load).toHaveBeenCalledTimes(1)
  })

  it("caches the loaded sub-app across requests (load once per isolate)", async () => {
    const load = vi.fn(async () => new Hono().get("/ping", (c) => c.json({ ok: true })))
    const app = createApp({
      // biome-ignore lint/suspicious/noExplicitAny: test doesn't use db -- owner: hono.
      db: () => ({}) as any,
      modules: [{ module: { name: "flights" }, lazyAdminRoutes: load }],
      auth: { resolve: () => ({ userId: "u1", actor: "staff" }) },
    })

    for (let i = 0; i < 3; i++) {
      const res = await app.request("/v1/admin/flights/ping", {}, TEST_ENV, TEST_CTX)
      expect(res.status).toBe(200)
    }
    expect(load).toHaveBeenCalledTimes(1)
  })

  it("mounts lazyPublicRoutes under /v1/public/{name} for customer-facing actors", async () => {
    const app = createApp({
      // biome-ignore lint/suspicious/noExplicitAny: test doesn't use db -- owner: hono.
      db: () => ({}) as any,
      modules: [
        {
          module: { name: "checkout" },
          lazyPublicRoutes: async () =>
            new Hono().get("/ping", (c) => c.json({ surface: "lazy-public" })),
        },
      ],
      auth: { resolve: () => ({ userId: "u1", actor: "customer" }) },
    })

    const res = await app.request("/v1/public/checkout/ping", {}, TEST_ENV, TEST_CTX)
    expect(res.status).toBe(200)
    expect(((await res.json()) as { surface: string }).surface).toBe("lazy-public")
  })

  it("applies actor guards to lazy routes (blocks customer on /v1/admin/*)", async () => {
    const load = vi.fn(async () => new Hono().get("/ping", (c) => c.json({ ok: true })))
    const app = createApp({
      // biome-ignore lint/suspicious/noExplicitAny: test doesn't use db -- owner: hono.
      db: () => ({}) as any,
      modules: [{ module: { name: "flights" }, lazyAdminRoutes: load }],
      auth: { resolve: () => ({ userId: "u1", actor: "customer" }) },
    })

    const res = await app.request("/v1/admin/flights/ping", {}, TEST_ENV, TEST_CTX)
    expect(res.status).toBe(403)
    // Guard rejects before the route bundle is ever imported.
    expect(load).not.toHaveBeenCalled()
  })

  it("does not cache a failed load — a later request can recover", async () => {
    let attempt = 0
    const load = vi.fn(async () => {
      attempt += 1
      if (attempt === 1) throw new Error("transient import failure")
      return new Hono().get("/ping", (c) => c.json({ ok: true }))
    })
    const app = createApp({
      // biome-ignore lint/suspicious/noExplicitAny: test doesn't use db -- owner: hono.
      db: () => ({}) as any,
      modules: [{ module: { name: "flights" }, lazyAdminRoutes: load }],
      auth: { resolve: () => ({ userId: "u1", actor: "staff" }) },
    })

    const first = await app.request("/v1/admin/flights/ping", {}, TEST_ENV, TEST_CTX)
    expect(first.status).toBe(500)

    const second = await app.request("/v1/admin/flights/ping", {}, TEST_ENV, TEST_CTX)
    expect(second.status).toBe(200)
    expect(load).toHaveBeenCalledTimes(2)
  })
})
