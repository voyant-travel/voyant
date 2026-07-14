import type { Actor } from "@voyant-travel/core"
import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import { createLocalRealtimeProvider } from "../../src/providers/local.js"
import {
  buildRealtimeRouteRuntime,
  createRealtimeRoutes,
  type RealtimeRoutesOptions,
} from "../../src/routes.js"

function mountTokenApp(
  options: RealtimeRoutesOptions,
  session: { actor?: Actor; userId?: string },
) {
  const routes = createRealtimeRoutes(options)
  return new Hono()
    .use("*", async (c, next) => {
      if (session.actor) c.set("actor", session.actor)
      if (session.userId) c.set("userId", session.userId)
      await next()
    })
    .route("/", routes)
}

const provider = createLocalRealtimeProvider()

describe("createRealtimeRoutes POST /token", () => {
  it("401s when there is no session", async () => {
    const app = mountTokenApp({ providers: [provider] }, {})
    const res = await app.request("/token", { method: "POST" })
    expect(res.status).toBe(401)
  })

  it("mints a staff-scoped token", async () => {
    const app = mountTokenApp({ providers: [provider] }, { actor: "staff", userId: "usr_a" })
    const res = await app.request("/token", { method: "POST" })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      data: { token: string; capabilities: Record<string, string[]>; provider: string }
    }
    expect(body.data.capabilities.admin).toEqual(["subscribe"])
    expect(body.data.capabilities["booking:*"]).toEqual(["subscribe"])
    expect(body.data.provider).toBe("local")
    expect(body.data.token).toContain("usr_a")
  })

  it("mints a portal-scoped token using resolvePortalScope", async () => {
    const app = mountTokenApp(
      {
        providers: [provider],
        resolvePortalScope: () => ({ personId: "per_1", bookingIds: ["bk_9"] }),
      },
      { actor: "customer", userId: "usr_c" },
    )
    const res = await app.request("/token", { method: "POST" })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: { capabilities: Record<string, string[]> } }
    expect(body.data.capabilities["portal:customer:per_1"]).toEqual(["subscribe", "presence"])
    expect(body.data.capabilities["booking:bk_9"]).toEqual(["subscribe"])
    expect(body.data.capabilities.admin).toBeUndefined()
  })

  it("quietly disables realtime when no provider is configured", async () => {
    const app = mountTokenApp({}, { actor: "staff", userId: "usr_a" })
    const res = await app.request("/token", { method: "POST" })
    expect(res.status).toBe(204)
    await expect(res.text()).resolves.toBe("")
  })

  it("returns no content when resolveProviders yields an empty list", async () => {
    const app = mountTokenApp({ resolveProviders: () => [] }, { actor: "staff", userId: "usr_a" })
    const res = await app.request("/token", { method: "POST" })
    expect(res.status).toBe(204)
  })
})

describe("buildRealtimeRouteRuntime", () => {
  it("yields a null service for zero providers instead of throwing", () => {
    const runtime = buildRealtimeRouteRuntime({}, { resolveProviders: () => [] })
    expect(runtime.service).toBeNull()
  })

  it("builds a service when at least one provider is resolved", () => {
    const runtime = buildRealtimeRouteRuntime(
      {},
      { resolveProviders: () => [createLocalRealtimeProvider()] },
    )
    expect(runtime.service?.defaultProvider.name).toBe("local")
  })
})
