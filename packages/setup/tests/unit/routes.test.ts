import { OpenAPIHono } from "@hono/zod-openapi"
import { handleApiError, type VoyantDb } from "@voyant-travel/hono"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { createSetupRoutes } from "../../src/routes.js"
import type { SetupStore } from "../../src/service.js"

const store = {
  transaction: vi.fn(async (run: (store: SetupStore) => Promise<unknown>) => run(store)),
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
  app.route(
    "/",
    createSetupRoutes({
      createStore: () => store,
      steps: [
        { id: "acme.profile", skippable: true },
        { id: "acme.required", skippable: false },
      ],
    }),
  )
  app.onError((error, c) => handleApiError(error, c))
  return app
}

describe("setup routes", () => {
  beforeEach(() => vi.clearAllMocks())

  it("requires an authenticated staff user", async () => {
    const response = await app().request("/v1/admin/setup")
    expect(response.status).toBe(401)
  })

  it("initializes setup for an authenticated user", async () => {
    const response = await app("user_1").request("/v1/admin/setup/initialize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stepIds: ["acme.profile", "acme.required"], fresh: true }),
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ data: { shouldRedirect: true } })
  })

  it("rejects initialization ids that differ from the selected graph", async () => {
    const response = await app("user_1").request("/v1/admin/setup/initialize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stepIds: ["acme.profile"], fresh: true }),
    })
    expect(response.status).toBe(400)
    expect(store.createOrganization).not.toHaveBeenCalled()
  })

  it("rejects unknown completion and a non-skippable skip", async () => {
    const unknown = await app("user_1").request("/v1/admin/setup/steps/not-selected/complete", {
      method: "POST",
    })
    const required = await app("user_1").request("/v1/admin/setup/steps/acme.required/skip", {
      method: "POST",
    })

    expect(unknown.status).toBe(400)
    expect(required.status).toBe(400)
    expect(store.markCompleted).not.toHaveBeenCalled()
    expect(store.markSkipped).not.toHaveBeenCalled()
  })
})
