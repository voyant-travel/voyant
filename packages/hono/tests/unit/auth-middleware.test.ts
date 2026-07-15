import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

import { sha256Base64Url } from "../../src/auth/crypto.js"
import { requireAuth } from "../../src/middleware/auth.js"
import type { VoyantBindings } from "../../src/types.js"

const TEST_ENV: VoyantBindings = { DATABASE_URL: "postgres://test" }

describe("requireAuth API keys", () => {
  it("matches public paths under a configured deployment base path", async () => {
    const dbFactory = vi.fn(() => ({}) as never)
    const app = new Hono()
    app.use(
      "*",
      requireAuth(dbFactory, {
        basePath: "/api",
        publicPaths: ["/v1/public/media"],
      }),
    )
    app.get("/api/v1/public/media/:key", (c) => c.json({ actor: c.get("actor") }))

    const response = await app.fetch(
      new Request("http://example.com/api/v1/public/media/product.jpg"),
      TEST_ENV,
      mockExecutionCtx(),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ actor: "customer" })
    expect(dbFactory).not.toHaveBeenCalled()
  })

  it("authenticates comma-separated internal API keys with scoped staff context", async () => {
    const app = new Hono()
    app.use(
      "*",
      requireAuth(() => ({}) as never),
    )
    app.get("/secure", (c) =>
      c.json({
        callerType: c.get("callerType"),
        actor: c.get("actor"),
        audience: c.get("audience"),
        scopes: c.get("scopes"),
        isInternalRequest: c.get("isInternalRequest"),
      }),
    )

    const response = await app.fetch(
      new Request("http://example.com/secure", {
        headers: { Authorization: "Bearer new-key" },
      }),
      {
        ...TEST_ENV,
        INTERNAL_API_KEY: "old-key, new-key",
        INTERNAL_API_KEY_SCOPES: "products:read,bookings:write",
      },
      mockExecutionCtx(),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      callerType: "internal",
      actor: "staff",
      audience: "staff",
      scopes: ["products:read", "bookings:write"],
      isInternalRequest: true,
    })
  })

  it("defaults a custom resolver audience to its authenticated actor", async () => {
    const app = new Hono()
    app.use(
      "*",
      requireAuth(() => ({}) as never, {
        auth: {
          resolve: () => ({ userId: "user_123", actor: "partner" }),
        },
      }),
    )
    app.get("/secure", (c) =>
      c.json({
        userId: c.get("userId"),
        actor: c.get("actor"),
        audience: c.get("audience"),
      }),
    )

    const response = await app.fetch(
      new Request("http://example.com/secure"),
      TEST_ENV,
      mockExecutionCtx(),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      userId: "user_123",
      actor: "partner",
      audience: "partner",
    })
  })

  it("lets app auth integrations reject an otherwise valid API key", async () => {
    const token = "voy_test_api_key"
    const row = makeApiKeyRow({
      key: await sha256Base64Url(token),
      referenceId: "user_123",
    })
    const validateApiKey = vi.fn().mockResolvedValue(false)

    const app = new Hono()
    app.use(
      "*",
      requireAuth(() => makeApiKeyDb(row), {
        auth: {
          validateApiKey,
        },
      }),
    )
    app.get("/secure", (c) => c.json({ ok: true }))

    const response = await app.fetch(
      new Request("http://example.com/secure", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      TEST_ENV,
      mockExecutionCtx(),
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "Invalid API key" })
    expect(validateApiKey).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: expect.objectContaining({
          id: "key_123",
          referenceId: "user_123",
        }),
      }),
    )
  })

  it("continues API key auth when the app validator accepts the key", async () => {
    const token = "voy_test_api_key"
    const row = makeApiKeyRow({
      key: await sha256Base64Url(token),
      referenceId: "user_123",
    })

    const app = new Hono()
    app.use(
      "*",
      requireAuth(() => makeApiKeyDb(row), {
        auth: {
          validateApiKey: vi.fn().mockResolvedValue(true),
        },
      }),
    )
    app.get("/secure", (c) =>
      c.json({
        callerType: c.get("callerType"),
        apiKeyId: c.get("apiKeyId"),
      }),
    )

    const response = await app.fetch(
      new Request("http://example.com/secure", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      TEST_ENV,
      mockExecutionCtx(),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      callerType: "api_key",
      apiKeyId: "key_123",
    })
  })

  it("lets app auth integrations customize the final unauthenticated response", async () => {
    const onUnauthorized = vi.fn(
      () =>
        new Response(null, {
          status: 302,
          headers: { Location: "https://login.example.test/start" },
        }),
    )
    const app = new Hono()
    app.use(
      "*",
      requireAuth(() => ({}) as never, {
        auth: { onUnauthorized },
      }),
    )
    app.get("/secure", (c) => c.json({ ok: true }))

    const response = await app.fetch(
      new Request("http://example.com/secure", {
        headers: { Accept: "text/html" },
      }),
      TEST_ENV,
      mockExecutionCtx(),
    )

    expect(response.status).toBe(302)
    expect(response.headers.get("location")).toBe("https://login.example.test/start")
    expect(onUnauthorized).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.any(Request),
        env: TEST_ENV,
      }),
    )
  })
})

function makeApiKeyRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "key_123",
    configId: "default",
    name: "Automation",
    start: "voy_ab",
    prefix: "voy_",
    key: "hash",
    referenceId: "user_123",
    refillInterval: null,
    refillAmount: null,
    lastRefillAt: null,
    enabled: true,
    rateLimitEnabled: false,
    rateLimitTimeWindow: null,
    rateLimitMax: null,
    requestCount: 0,
    remaining: null,
    lastRequest: null,
    createdAt: new Date("2026-05-16T00:00:00.000Z"),
    updatedAt: new Date("2026-05-16T00:00:00.000Z"),
    expiresAt: null,
    permissions: JSON.stringify({ "*": ["*"] }),
    metadata: null,
    ...overrides,
  }
}

function makeApiKeyDb(row: Record<string, unknown>) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [row],
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: async () => {},
      }),
    }),
  } as never
}

function mockExecutionCtx(): ExecutionContext {
  return {
    waitUntil() {},
    passThroughOnException() {},
  }
}
