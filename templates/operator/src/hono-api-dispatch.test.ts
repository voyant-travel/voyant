import { describe, expect, it, vi } from "vitest"
import { createHonoApiRequest, dispatchHonoApiRequest, isHonoApiRequest } from "./hono-api-dispatch"

describe("Hono API dispatch", () => {
  it("matches only the /api prefix", () => {
    expect(isHonoApiRequest("/api")).toBe(true)
    expect(isHonoApiRequest("/api/v1/products")).toBe(true)
    expect(isHonoApiRequest("/apiary")).toBe(false)
    expect(isHonoApiRequest("/shop/api")).toBe(false)
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
})
