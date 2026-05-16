import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

import { sha256Base64Url } from "../../src/auth/crypto.js"
import { requireAuth } from "../../src/middleware/auth.js"
import type { VoyantBindings } from "../../src/types.js"

const TEST_ENV: VoyantBindings = { DATABASE_URL: "postgres://test" }

describe("requireAuth API keys", () => {
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
