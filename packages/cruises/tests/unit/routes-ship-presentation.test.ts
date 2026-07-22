import { OpenAPIHono } from "@hono/zod-openapi"
import { beforeEach, describe, expect, it, vi } from "vitest"

const presentationMocks = vi.hoisted(() => ({
  clearCruiseShipOverlay: vi.fn(async () => ({
    entity_module: "cruise-ships",
    entity_id: "crsh_123",
    field_path: "name",
    locale: "ro-RO",
    audience: "customer",
    market: "RO",
  })),
  cruiseShipOverlayInvalidationScope: vi.fn(
    (_fieldPath: string, scope: Record<string, string>) => scope,
  ),
  findExistingExternalCruiseShipSubject: vi.fn(async () => null),
  ingestExternalCruiseShip: vi.fn(),
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
  writeCruiseShipOverlay: vi.fn(async (
    _db: unknown,
    _shipId: string,
    input: {
      origin: unknown
      field_path: string
      scope: { locale: string; audience: string; market: string }
    },
  ) => ({
    id: "ovl_1",
    origin: input.origin,
    entity_module: "cruise-ships",
    entity_id: "crsh_123",
    field_path: input.field_path,
    locale: input.scope.locale,
    audience: input.scope.audience,
    market: input.scope.market,
  })),
}))

vi.mock("../../src/service-presentation-subjects.js", () => presentationMocks)

import { cruisePublicRoutes } from "../../src/routes-public.js"
import { registerCruiseShipRoutes } from "../../src/routes-ships.js"

function buildAdminApp(userId?: string, eventBus?: { emit: ReturnType<typeof vi.fn> }) {
  const app = new OpenAPIHono()
  app.onError((error, c) => {
    const status = (error as { status?: number }).status ?? 500
    return c.json({ error: error.message }, status as never)
  })
  app.use("*", async (c, next) => {
    // biome-ignore lint/suspicious/noExplicitAny: route unit test injects only context variables used by the handler. -- owner: cruises
    ;(c as any).set("db", {})
    if (eventBus) {
      // biome-ignore lint/suspicious/noExplicitAny: route unit test injects only context variables used by the handler. -- owner: cruises
      ;(c as any).set("eventBus", eventBus)
    }
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

  it("rejects staff and supplier audiences on the public effective route", async () => {
    const staff = await cruisePublicRoutes.request(
      "/ships/crsh_123/effective?locale=ro-RO&audience=staff",
    )
    const supplier = await cruisePublicRoutes.request(
      "/ships/crsh_123/effective?locale=ro-RO&audience=supplier",
    )

    expect(staff.status).toBe(400)
    expect(supplier.status).toBe(400)
    expect(presentationMocks.readPublicCruiseShipProjection).not.toHaveBeenCalled()
  })

  it("attributes admin overlay writes to the authenticated user", async () => {
    const eventBus = { emit: vi.fn(async () => undefined) }
    const app = buildAdminApp("usr_editor", eventBus)

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
    expect(eventBus.emit).toHaveBeenCalledTimes(1)
    expect(eventBus.emit).toHaveBeenCalledWith(
      "catalog.entity.overlay.changed",
      expect.objectContaining({
        entity_module: "cruise-ships",
        entity_id: "crsh_123",
        field_path: "name",
        locale: "ro-RO",
        audience: "customer",
        market: "RO",
      }),
      expect.objectContaining({ category: "internal", source: "service" }),
    )
  })

  it("emits exactly once after a successful clear", async () => {
    const eventBus = { emit: vi.fn(async () => undefined) }
    const app = buildAdminApp("usr_editor", eventBus)

    const res = await app.request(
      "/ships/crsh_123/editorial-overlays?fieldPath=name&locale=ro-RO&audience=customer&market=RO",
      { method: "DELETE" },
    )

    expect(res.status).toBe(200)
    expect(eventBus.emit).toHaveBeenCalledTimes(1)
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
