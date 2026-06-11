import { describe, expect, it, vi } from "vitest"
import {
  createHonoApiRequest,
  dispatchHonoApiRequest,
  isHonoApiRequest,
  isHonoAuthApiRequest,
} from "./hono-api-dispatch"

type FetchApp = {
  fetch: (request: Request, env?: unknown, ctx?: ExecutionContext) => Response | Promise<Response>
}

describe("Hono API dispatch", () => {
  it("matches only the /api prefix", () => {
    expect(isHonoApiRequest("/api")).toBe(true)
    expect(isHonoApiRequest("/api/v1/products")).toBe(true)
    expect(isHonoApiRequest("/apiary")).toBe(false)
    expect(isHonoApiRequest("/shop/api")).toBe(false)
  })

  it("matches auth requests under the API prefix", () => {
    expect(isHonoAuthApiRequest("/api/auth")).toBe(true)
    expect(isHonoAuthApiRequest("/api/auth/me")).toBe(true)
    expect(isHonoAuthApiRequest("/api/auth/sign-in/email")).toBe(true)
    expect(isHonoAuthApiRequest("/api/v1/admin/auth")).toBe(false)
    expect(isHonoAuthApiRequest("/api/authz")).toBe(false)
  })

  it("strips the /api prefix and preserves the query string", () => {
    const request = new Request("https://example.test/api/v1/admin/settings?tab=profile")

    const forwarded = createHonoApiRequest(request)

    expect(forwarded.url).toBe("https://example.test/v1/admin/settings?tab=profile")
  })

  it("maps bare /api to the Hono root", () => {
    const request = new Request("https://example.test/api?ready=1")

    const forwarded = createHonoApiRequest(request)

    expect(forwarded.url).toBe("https://example.test/?ready=1")
  })

  it("preserves non-GET request method, headers, and body", async () => {
    const request = new Request("https://example.test/api/v1/public/checkout", {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": "req_123" },
      body: JSON.stringify({ bookingId: "bk_123" }),
    })

    const forwarded = createHonoApiRequest(request)

    expect(forwarded.method).toBe("POST")
    expect(forwarded.headers.get("content-type")).toBe("application/json")
    expect(forwarded.headers.get("x-request-id")).toBe("req_123")
    await expect(forwarded.json()).resolves.toEqual({ bookingId: "bk_123" })
  })

  it("loads the Hono app and forwards request, env, and execution context", async () => {
    const request = new Request("https://example.test/api/health")
    const env = { APP_URL: "https://example.test" } as CloudflareBindings
    const ctx: ExecutionContext = {
      props: undefined,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
    }
    const fetch = vi.fn(async (_request: Request, _env?: unknown, _ctx?: ExecutionContext) =>
      Response.json({ ok: true }),
    )

    const response = await dispatchHonoApiRequest(request, env, ctx, async () => ({ fetch }))

    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(fetch).toHaveBeenCalledOnce()
    const [forwardedRequest, forwardedEnv, forwardedCtx] = fetch.mock.calls[0]!
    expect((forwardedRequest as Request).url).toBe("https://example.test/health")
    expect(forwardedEnv).toBe(env)
    expect(forwardedCtx).toBe(ctx)
  })

  it("dispatches auth requests through the lightweight auth app and warms the full app", async () => {
    const request = new Request("https://example.test/api/auth/me")
    const env = { APP_URL: "https://example.test" } as CloudflareBindings
    const ctx: ExecutionContext = {
      props: undefined,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
    }
    const fullFetch = vi.fn<FetchApp["fetch"]>(async () => Response.json({ full: true }))
    const authFetch = vi.fn<FetchApp["fetch"]>(async () => Response.json({ user: true }))
    const loadFull = vi.fn(async () => ({ fetch: fullFetch }))
    const loadAuth = vi.fn(async () => ({ fetch: authFetch }))

    const response = await dispatchHonoApiRequest(request, env, ctx, loadFull, loadAuth)

    await expect(response.json()).resolves.toEqual({ user: true })
    expect(loadAuth).toHaveBeenCalledOnce()
    expect(authFetch).toHaveBeenCalledOnce()
    expect(loadFull).toHaveBeenCalledOnce()
    expect(ctx.waitUntil).toHaveBeenCalledOnce()
    expect(fullFetch).not.toHaveBeenCalled()
    const [forwardedRequest, forwardedEnv, forwardedCtx] = authFetch.mock.calls[0]!
    expect((forwardedRequest as Request).url).toBe("https://example.test/auth/me")
    expect(forwardedEnv).toBe(env)
    expect(forwardedCtx).toBe(ctx)
  })

  it("does not wait for full API warmup before returning auth responses", async () => {
    const request = new Request("https://example.test/api/auth/me")
    const env = { APP_URL: "https://example.test" } as CloudflareBindings
    const ctx: ExecutionContext = {
      props: undefined,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
    }
    const authFetch = vi.fn<FetchApp["fetch"]>(async () => Response.json({ ok: true }))
    const loadFull = vi.fn<() => Promise<FetchApp>>(() => new Promise<FetchApp>(() => undefined))

    const response = await dispatchHonoApiRequest(request, env, ctx, loadFull, async () => ({
      fetch: authFetch,
    }))

    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(loadFull).toHaveBeenCalledOnce()
    expect(ctx.waitUntil).toHaveBeenCalledOnce()
  })

  it("handles auth CORS preflight without loading the full API app", async () => {
    const request = new Request("https://example.test/api/auth/me", {
      method: "OPTIONS",
      headers: {
        origin: "https://dashboard.example",
        "access-control-request-method": "GET",
        "access-control-request-headers": "content-type",
      },
    })
    const env = {
      APP_URL: "https://example.test",
      CORS_ALLOWLIST: "https://dashboard.example",
    } as CloudflareBindings
    const ctx: ExecutionContext = {
      props: undefined,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
    }
    const loadFull = vi.fn(async () => ({
      fetch: vi.fn<FetchApp["fetch"]>(async () => Response.json({ full: true })),
    }))

    const response = await dispatchHonoApiRequest(request, env, ctx, loadFull)

    expect(response.status).toBe(204)
    expect(response.headers.get("access-control-allow-origin")).toBe("https://dashboard.example")
    expect(response.headers.get("access-control-allow-credentials")).toBe("true")
    expect(response.headers.get("access-control-allow-methods")).toBe("GET")
    expect(response.headers.get("access-control-allow-headers")).toBe("content-type")
    expect(response.headers.get("vary")).toBe("Origin")
    expect(loadFull).not.toHaveBeenCalled()
    expect(ctx.waitUntil).not.toHaveBeenCalled()
  })
})
