import { describe, expect, it, vi } from "vitest"

import {
  createHonoApiRequest,
  dispatchHonoApiRequest,
  isHonoApiRequest,
} from "./hono-api-dispatch.js"

describe("Hono API dispatch adapter", () => {
  it("matches only /api and /api/* paths", () => {
    expect(isHonoApiRequest("/api")).toBe(true)
    expect(isHonoApiRequest("/api/")).toBe(true)
    expect(isHonoApiRequest("/api/v1/bookings")).toBe(true)

    expect(isHonoApiRequest("/apiary")).toBe(false)
    expect(isHonoApiRequest("/_workspace")).toBe(false)
  })

  it("strips the /api prefix before forwarding to Hono", () => {
    const forwarded = createHonoApiRequest(
      new Request("https://operator.test/api/v1/admin/settings?tab=profile"),
    )

    expect(forwarded.url).toBe("https://operator.test/v1/admin/settings?tab=profile")
  })

  it("forwards bare /api requests to the Hono root", () => {
    const forwarded = createHonoApiRequest(new Request("https://operator.test/api?ready=1"))

    expect(forwarded.url).toBe("https://operator.test/?ready=1")
  })

  it("preserves method, headers, and body when creating the Hono request", async () => {
    const forwarded = createHonoApiRequest(
      new Request("https://operator.test/api/v1/uploads", {
        method: "POST",
        headers: { "content-type": "application/json", "x-request-id": "req_123" },
        body: JSON.stringify({ file: "brochure.pdf" }),
      }),
    )

    expect(forwarded.method).toBe("POST")
    expect(forwarded.headers.get("content-type")).toBe("application/json")
    expect(forwarded.headers.get("x-request-id")).toBe("req_123")
    await expect(forwarded.json()).resolves.toEqual({ file: "brochure.pdf" })
  })

  it("loads the Hono app and forwards request, env, and execution context", async () => {
    const env = { DATABASE_URL: "postgres://example" } as CloudflareBindings
    const ctx: ExecutionContext = {
      props: undefined,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
    }
    const fetch = vi.fn().mockResolvedValue(Response.json({ ok: true }))
    const loadHonoApp = vi.fn().mockResolvedValue({ fetch })

    const response = await dispatchHonoApiRequest(
      new Request("https://operator.test/api/v1/admin/action-ledger/health"),
      env,
      ctx,
      loadHonoApp,
    )

    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(loadHonoApp).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledOnce()
    const [forwardedRequest, forwardedEnv, forwardedCtx] = fetch.mock.calls[0] ?? []
    expect(forwardedRequest).toBeInstanceOf(Request)
    expect((forwardedRequest as Request).url).toBe(
      "https://operator.test/v1/admin/action-ledger/health",
    )
    expect(forwardedEnv).toBe(env)
    expect(forwardedCtx).toBe(ctx)
  })
})
