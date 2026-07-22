import { OpenAPIHono } from "@hono/zod-openapi"
import { beforeEach, describe, expect, it, vi } from "vitest"

const presentationMocks = vi.hoisted(() => ({
  clearCruiseShipOverlay: vi.fn(),
  listCruiseShipOverlayHistory: vi.fn(async () => []),
  readCruiseShipOverlayState: vi.fn(async () => ({
    subject: { module: "cruise-ships", id: "crsh_123" },
    source: { name: "Source Ship" },
    effective: { name: "Effective Ship" },
  })),
  readPublicCruiseShipProjection: vi.fn(async () => ({
    subject: { module: "cruise-ships", id: "crsh_123" },
    locale: { requestedLocale: "ro-RO", servedLocale: "ro-RO" },
    content: { name: "Nava", description: "Descriere" },
  })),
  writeCruiseShipOverlay: vi.fn(async (_db, _shipId, input) => ({
    id: "ovl_1",
    origin: input.origin,
  })),
}))

vi.mock("../../src/service-presentation-subjects.js", () => presentationMocks)

import { cruisePublicRoutes } from "../../src/routes-public.js"
import { registerCruiseShipRoutes } from "../../src/routes-ships.js"

function buildAdminApp(userId?: string) {
  const app = new OpenAPIHono()
  app.onError((error, c) => {
    const status = (error as { status?: number }).status ?? 500
    return c.json({ error: error.message }, status as never)
  })
  app.use("*", async (c, next) => {
    // biome-ignore lint/suspicious/noExplicitAny: route unit test injects only context variables used by the handler. -- owner: cruises
    ;(c as any).set("db", {})
    if (userId) {
      // biome-ignore lint/suspicious/noExplicitAny: route unit test injects only context variables used by the handler. -- owner: cruises
      ;(c as any).set("userId", userId)
    }
    await next()
  })
  registerCruiseShipRoutes(app as never)
  return app
}

describe("cruise ship presentation routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("redacts source and provenance from the public effective projection", async () => {
    const res = await cruisePublicRoutes.request("/ships/crsh_123/effective?locale=ro-RO")

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.content.name).toBe("Nava")
    expect(body.data.source).toBeUndefined()
    expect(body.data.provenance).toBeUndefined()
    expect(body.data.content["source.ref"]).toBeUndefined()
  })

  it("attributes admin overlay writes to the authenticated user", async () => {
    const app = buildAdminApp("usr_editor")

    const res = await app.request("/ships/crsh_123/editorial-overlays", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fieldPath: "name",
        locale: "ro-RO",
        audience: "customer",
        market: "RO",
        value: "Nava",
      }),
    })

    expect(res.status).toBe(200)
    expect(presentationMocks.writeCruiseShipOverlay).toHaveBeenCalledWith(
      expect.anything(),
      "crsh_123",
      expect.objectContaining({
        origin: { kind: "admin-ui", user_id: "usr_editor" },
      }),
    )
  })

  it("does not write unauthenticated admin overlays", async () => {
    const app = buildAdminApp()

    const res = await app.request("/ships/crsh_123/editorial-overlays", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fieldPath: "name",
        locale: "ro-RO",
        audience: "customer",
        market: "RO",
        value: "Nava",
      }),
    })

    expect(res.status).toBe(401)
    expect(presentationMocks.writeCruiseShipOverlay).not.toHaveBeenCalled()
  })
})
