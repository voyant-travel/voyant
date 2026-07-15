import { OpenAPIHono } from "@hono/zod-openapi"
import { handleApiError } from "@voyant-travel/hono"
import { describe, expect, it, vi } from "vitest"

import {
  createNavigationPreferencesRoutes,
  type NavigationPreferencesRouteService,
} from "../../src/routes.js"

function createService(): NavigationPreferencesRouteService {
  return {
    get: vi.fn(async () => ({
      organization: { finance: false },
      member: { bookings: true },
      effective: { finance: false, bookings: true },
    })),
    setOrganization: vi.fn(async (_db, visibility) => visibility),
    setMember: vi.fn(async (_db, _memberId, visibility) => visibility),
  }
}

function createApp(
  service: NavigationPreferencesRouteService,
  scopes: string[] = [],
  userId?: string,
) {
  const app = new OpenAPIHono()
  app.use("*", async (c, next) => {
    c.set("db", {} as never)
    c.set("scopes", scopes)
    if (userId) c.set("userId", userId)
    await next()
  })
  app.route("/", createNavigationPreferencesRoutes({ service }))
  app.onError((error, c) => handleApiError(error, c))
  return app
}

describe("navigation preference routes", () => {
  it("returns organization and current-member maps to an authenticated member", async () => {
    const service = createService()
    const response = await createApp(service, ["*:read"], "user_1").request(
      "/v1/admin/navigation-preferences",
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: {
        organization: { finance: false },
        member: { bookings: true },
        effective: { finance: false, bookings: true },
        canManageOrganization: false,
      },
    })
  })

  it("allows only organization writers to replace organization defaults", async () => {
    const deniedService = createService()
    const denied = await createApp(deniedService, ["*:read"], "user_1").request(
      "/v1/admin/navigation-preferences/organization",
      { method: "PUT", headers: { "content-type": "application/json" }, body: '{"visibility":{}}' },
    )
    expect(denied.status).toBe(403)
    expect(deniedService.setOrganization).not.toHaveBeenCalled()

    const allowedService = createService()
    const allowed = await createApp(allowedService, ["admin-navigation:write"]).request(
      "/v1/admin/navigation-preferences/organization",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: '{"visibility":{"finance":false,"future-module":true}}',
      },
    )
    expect(allowed.status).toBe(200)
    expect(allowedService.setOrganization).toHaveBeenCalledWith(
      {},
      { finance: false, "future-module": true },
    )
  })

  it("always writes member preferences for the authenticated member", async () => {
    const service = createService()
    const response = await createApp(service, ["*:read"], "user_1").request(
      "/v1/admin/navigation-preferences/me",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: '{"memberId":"user_2","visibility":{"bookings":false}}',
      },
    )

    expect(response.status).toBe(200)
    expect(service.setMember).toHaveBeenCalledWith({}, "user_1", { bookings: false })
  })

  it("rejects a member-layer write without an authenticated member", async () => {
    const service = createService()
    const response = await createApp(service, ["admin-navigation:write"]).request(
      "/v1/admin/navigation-preferences/me",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: '{"visibility":{"bookings":false}}',
      },
    )

    expect(response.status).toBe(401)
    expect(service.setMember).not.toHaveBeenCalled()
  })
})
