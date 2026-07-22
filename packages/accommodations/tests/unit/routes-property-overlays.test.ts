import { OpenAPIHono } from "@hono/zod-openapi"
import type { EventBus } from "@voyant-travel/core"
import { beforeEach, describe, expect, it, vi } from "vitest"

const presentationMocks = vi.hoisted(() => ({
  accommodationPropertyOverlayInvalidationScope: vi.fn((_fieldPath, scope) => scope),
  clearAccommodationPropertyOverlay: vi.fn(
    async (): Promise<{ id: string } | null> => ({ id: "ovl_1" }),
  ),
  listAccommodationPropertyOverlayHistory: vi.fn(async () => []),
  readAccommodationPropertyOverlayState: vi.fn(async () => ({
    subject: { module: "accommodation-properties", id: "prop_1" },
  })),
  readPublicAccommodationPropertyProjection: vi.fn(async () => ({
    subject: { module: "accommodation-properties", id: "prop_1" },
    locale: {
      requestedLocale: "ro-RO",
      sourceLocale: "en-GB",
      servedLocale: "ro-RO",
      matchKind: "mixed",
    },
    content: { id: "prop_1", name: "Hotelul" },
  })),
  writeAccommodationPropertyOverlay: vi.fn(async () => ({ id: "ovl_1" })),
}))

vi.mock("../../src/service-presentation-subjects.js", async () => {
  const { z } = await import("zod")
  return {
    ...presentationMocks,
    ACCOMMODATION_PROPERTY_SUBJECT_MODULE: "accommodation-properties",
    publicAccommodationPropertyProjectionSchema: z.object({
      id: z.string(),
      name: z.string().nullable().optional(),
    }),
  }
})

import { createAccommodationContentRoutes } from "../../src/routes-content.js"

const registry = {} as never

function buildApp(input: { public?: boolean; userId?: string; eventBus?: EventBus } = {}) {
  const app = new OpenAPIHono()
  app.onError((error, c) => {
    const status = (error as { status?: number }).status ?? 500
    return c.json({ error: error.message }, status as never)
  })
  app.use("*", async (c, next) => {
    // biome-ignore lint/suspicious/noExplicitAny: focused route test injects request context capabilities. -- owner: accommodations
    ;(c as any).set("db", {})
    if (input.userId) {
      // biome-ignore lint/suspicious/noExplicitAny: focused route test injects request context capabilities. -- owner: accommodations
      ;(c as any).set("userId", input.userId)
    }
    if (input.eventBus) {
      // biome-ignore lint/suspicious/noExplicitAny: focused route test injects request context capabilities. -- owner: accommodations
      ;(c as any).set("eventBus", input.eventBus)
    }
    await next()
  })
  app.route(
    "/",
    createAccommodationContentRoutes({
      resolveRegistry: () => registry,
      allowEditorialWrites: !input.public,
    }),
  )
  return app
}

describe("accommodation property overlay routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    presentationMocks.clearAccommodationPropertyOverlay.mockResolvedValue({ id: "ovl_1" })
  })

  it.each([
    "staff",
    "supplier",
    "default",
  ])("rejects the untrusted %s audience on the public effective route", async (audience) => {
    const response = await buildApp({ public: true }).request(
      `/properties/prop_1/effective?locale=ro-RO&audience=${audience}`,
    )

    expect(response.status).toBe(400)
    expect(presentationMocks.readPublicAccommodationPropertyProjection).not.toHaveBeenCalled()
  })

  it("allows partner storefront projections and returns no source envelope", async () => {
    const response = await buildApp({ public: true }).request(
      "/properties/prop_1/effective?locale=ro-RO&audience=partner",
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.content).toEqual({ id: "prop_1", name: "Hotelul" })
    expect(body.data.source).toBeUndefined()
    expect(body.data.provenance).toBeUndefined()
    expect(presentationMocks.readPublicAccommodationPropertyProjection).toHaveBeenCalledWith(
      expect.anything(),
      "prop_1",
      { locale: "ro-RO", audience: "partner", market: "default" },
    )
  })

  it("validates field values before invoking the write service", async () => {
    const response = await buildApp({ userId: "usr_editor" }).request(
      "/properties/prop_1/editorial-overlays",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fieldPath: "highlights", value: "not-an-array" }),
      },
    )

    expect(response.status).toBe(400)
    expect(presentationMocks.writeAccommodationPropertyOverlay).not.toHaveBeenCalled()
  })

  it("emits one canonical overlay event after a successful write", async () => {
    const emit = vi.fn(async () => undefined)
    const response = await buildApp({
      userId: "usr_editor",
      eventBus: { emit } as never,
    }).request("/properties/prop_1/editorial-overlays", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fieldPath: "name",
        locale: "ro-RO",
        audience: "customer",
        market: "RO",
        value: "Hotelul",
      }),
    })

    expect(response.status).toBe(200)
    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith(
      "catalog.entity.overlay.changed",
      expect.objectContaining({
        entity_module: "accommodation-properties",
        entity_id: "prop_1",
        field_path: "name",
        locale: "ro-RO",
        audience: "customer",
        market: "RO",
      }),
      expect.objectContaining({ category: "internal", source: "service" }),
    )
  })

  it("does not emit when persistence rejects a write", async () => {
    const emit = vi.fn(async () => undefined)
    presentationMocks.writeAccommodationPropertyOverlay.mockRejectedValueOnce(
      new Error("invalid merged projection"),
    )

    const response = await buildApp({
      userId: "usr_editor",
      eventBus: { emit } as never,
    }).request("/properties/prop_1/editorial-overlays", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fieldPath: "name", value: "Hotelul" }),
    })

    expect(response.status).toBe(400)
    expect(emit).not.toHaveBeenCalled()
  })

  it("emits once for a changed clear and not for an idempotent clear", async () => {
    const emit = vi.fn(async () => undefined)
    const app = buildApp({ userId: "usr_editor", eventBus: { emit } as never })
    const path =
      "/properties/prop_1/editorial-overlays?fieldPath=name&locale=ro-RO&audience=customer&market=RO"

    expect((await app.request(path, { method: "DELETE" })).status).toBe(200)
    expect(emit).toHaveBeenCalledTimes(1)

    presentationMocks.clearAccommodationPropertyOverlay.mockResolvedValueOnce(null)
    expect((await app.request(path, { method: "DELETE" })).status).toBe(200)
    expect(emit).toHaveBeenCalledTimes(1)
  })
})
