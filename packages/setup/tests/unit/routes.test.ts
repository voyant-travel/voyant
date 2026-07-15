import { OpenAPIHono } from "@hono/zod-openapi"
import { handleApiError, type VoyantDb } from "@voyant-travel/hono"
import { describe, expect, it, vi } from "vitest"

import { createSetupRoutes } from "../../src/routes.js"
import type { SetupStore } from "../../src/service.js"

const store = {
  createOrganization: vi.fn(async () => true),
  getOrganization: vi.fn(async () => ({
    id: "organization",
    startedAt: new Date("2026-07-15T08:00:00.000Z"),
    firstRunOpenedAt: null,
  })),
  ensureStep: vi.fn(async () => undefined),
  listSteps: vi.fn(async () => []),
  markCompleted: vi.fn(),
  markSkipped: vi.fn(),
} satisfies SetupStore

function app(userId?: string) {
  const app = new OpenAPIHono()
  app.use("*", async (c, next) => {
    c.set("db", {} as VoyantDb)
    if (userId) c.set("userId", userId)
    await next()
  })
  app.route("/", createSetupRoutes({ createStore: () => store }))
  app.onError((error, c) => handleApiError(error, c))
  return app
}

describe("setup routes", () => {
  it("requires an authenticated staff user", async () => {
    const response = await app().request("/v1/admin/setup")
    expect(response.status).toBe(401)
  })

  it("initializes setup for an authenticated user", async () => {
    const response = await app("user_1").request("/v1/admin/setup/initialize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stepIds: ["acme.profile"], fresh: true }),
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ data: { shouldRedirect: true } })
  })
})
