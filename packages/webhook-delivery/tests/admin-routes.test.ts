import { ApiHttpError } from "@voyant-travel/hono"
import { Hono } from "hono"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createOperatorWebhookAdminRoutes } from "../src/admin-routes.js"
import type { OperatorWebhookAdminService } from "../src/admin-service.js"

const service: OperatorWebhookAdminService = {
  listEvents: () => [],
  listSubscriptions: vi.fn(async () => []),
  getSubscription: vi.fn(async () => null),
  createSubscription: vi.fn(),
  updateSubscription: vi.fn(),
  deleteSubscription: vi.fn(),
  setSubscriptionActive: vi.fn(),
  rotateSubscriptionSecret: vi.fn(),
  testSubscription: vi.fn(),
  listDeliveries: vi.fn(async () => []),
  getDelivery: vi.fn(),
  replayDelivery: vi.fn(),
}

function app(scopes: string[] | null) {
  const app = new Hono()
  app.onError((error, context) =>
    error instanceof ApiHttpError
      ? context.json({ error: error.message }, error.status as 400)
      : context.json({ error: "Internal error" }, 500),
  )
  if (scopes) {
    app.use("*", async (context, next) => {
      context.set("userId", "usr_admin")
      context.set("scopes", scopes)
      await next()
    })
  }
  app.route("/", createOperatorWebhookAdminRoutes({ contracts: [], service }))
  return app
}

describe("operator webhook admin route authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("rejects unauthenticated subscription reads", async () => {
    const response = await app(null).request("http://localhost/subscriptions")
    expect(response.status).toBe(401)
    expect(service.listSubscriptions).not.toHaveBeenCalled()
  })

  it("allows subscription reads with webhooks:read", async () => {
    const response = await app(["webhooks:read"]).request("http://localhost/subscriptions")
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: [] })
  })

  it("rejects reads without webhooks:read", async () => {
    const response = await app(["webhooks:write"]).request("http://localhost/subscriptions")
    expect(response.status).toBe(403)
    expect(service.listSubscriptions).not.toHaveBeenCalled()
  })

  it("rejects writes without webhooks:write", async () => {
    const response = await app(["webhooks:read"]).request("http://localhost/subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: "https://partner.example.test/hooks",
        events: ["booking.created"],
      }),
    })
    expect(response.status).toBe(403)
    expect(service.createSubscription).not.toHaveBeenCalled()
  })

  it("rejects deletion without webhooks:delete", async () => {
    const response = await app(["webhooks:write"]).request("http://localhost/subscriptions/sub_1", {
      method: "DELETE",
    })
    expect(response.status).toBe(403)
    expect(service.deleteSubscription).not.toHaveBeenCalled()
  })

  it("does not expose unexpected service errors", async () => {
    vi.mocked(service.createSubscription).mockRejectedValueOnce(
      new Error("DATABASE_URL=postgres://private"),
    )
    const response = await app(["webhooks:write"]).request("http://localhost/subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: "https://partner.example.test/hooks",
        events: ["booking.created"],
      }),
    })
    const body = await response.text()
    expect(response.status).toBe(500)
    expect(body).toContain("Internal error")
    expect(body).not.toContain("DATABASE_URL")
    expect(body).not.toContain("postgres://private")
  })
})
