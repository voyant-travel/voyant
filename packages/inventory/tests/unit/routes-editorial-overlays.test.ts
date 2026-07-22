import { OpenAPIHono } from "@hono/zod-openapi"
import type { SourceAdapterRegistry } from "@voyant-travel/catalog/booking-engine"
import { beforeEach, describe, expect, it, vi } from "vitest"

const serviceMocks = vi.hoisted(() => ({
  clearProductEditorialOverlay: vi.fn(),
  listProductEditorialOverlayHistory: vi.fn(async () => []),
  readProductEditorialOverlayState: vi.fn(async () => ({
    subject: { module: "products", id: "prod_1" },
  })),
  writeProductEditorialOverlay: vi.fn(async (_db, _productId, input) => ({
    id: "ovl_1",
    origin: input.origin,
  })),
  OverlayVersionConflictError: class OverlayVersionConflictError extends Error {
    currentVersion = null
  },
}))

vi.mock("../../src/service-editorial-overlays.js", () => serviceMocks)

import { createProductEditorialOverlayRoutes } from "../../src/routes-editorial-overlays.js"

function makeRegistry(): SourceAdapterRegistry {
  return {
    register: vi.fn(),
    resolveByConnection: vi.fn(() => undefined),
    resolveByConnectionOrThrow: vi.fn(),
    resolveOrThrow: vi.fn(),
    byKind: vi.fn(() => []),
    connections: vi.fn(() => []),
    kinds: vi.fn(() => []),
    has: vi.fn(() => false),
    hasKind: vi.fn(() => false),
  } as never
}

function buildApp(userId?: string) {
  const app = new OpenAPIHono()
  app.onError((error, c) => {
    const status = (error as { status?: number }).status ?? 500
    return c.json({ error: error.message }, status as never)
  })
  app.use("*", async (c, next) => {
    // biome-ignore lint/suspicious/noExplicitAny: route unit test injects only context variables used by the handler. -- owner: products
    ;(c as any).set("db", {})
    if (userId) {
      // biome-ignore lint/suspicious/noExplicitAny: route unit test injects only context variables used by the handler. -- owner: products
      ;(c as any).set("userId", userId)
    }
    await next()
  })
  app.route("/", createProductEditorialOverlayRoutes({ resolveRegistry: () => makeRegistry() }))
  return app
}

describe("createProductEditorialOverlayRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("attributes admin-ui writes to the authenticated user id", async () => {
    const app = buildApp("usr_editor")

    const res = await app.request("/prod_1/editorial-overlays", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fieldPath: "name",
        locale: "ro-RO",
        audience: "customer",
        market: "RO",
        value: "Nume",
      }),
    })

    expect(res.status).toBe(200)
    expect(serviceMocks.writeProductEditorialOverlay).toHaveBeenCalledWith(
      expect.anything(),
      "prod_1",
      expect.objectContaining({
        origin: { kind: "admin-ui", user_id: "usr_editor" },
      }),
      expect.anything(),
    )
  })

  it("rejects the default scope sentinel as a localized overlay locale", async () => {
    const app = buildApp("usr_editor")

    const res = await app.request("/prod_1/editorial-overlays", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fieldPath: "name",
        locale: "default",
        audience: "customer",
        market: "RO",
        value: "Nume",
      }),
    })

    expect(res.status).toBe(400)
    expect(serviceMocks.writeProductEditorialOverlay).not.toHaveBeenCalled()
  })

  it("does not attribute unauthenticated writes to system", async () => {
    const app = buildApp()

    const res = await app.request("/prod_1/editorial-overlays", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fieldPath: "name",
        locale: "ro-RO",
        audience: "customer",
        market: "RO",
        value: "Nume",
      }),
    })

    expect(res.status).toBe(401)
    expect(serviceMocks.writeProductEditorialOverlay).not.toHaveBeenCalled()
  })
})
