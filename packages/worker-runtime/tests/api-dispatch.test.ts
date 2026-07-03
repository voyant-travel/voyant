import { describe, expect, it, vi } from "vitest"
import { createApiDispatch, lazyApp } from "../src/api-dispatch.js"
import type { FetchApp, WaitUntilContext } from "../src/types.js"

type Env = { APP_URL: string }

function makeCtx(): WaitUntilContext & { waitUntil: ReturnType<typeof vi.fn> } {
  return { waitUntil: vi.fn() }
}

describe("createApiDispatch", () => {
  const noopLoader = async (): Promise<FetchApp<Env>> => ({
    fetch: async () => Response.json({ ok: true }),
  })

  it("matches only the API prefix", () => {
    const dispatch = createApiDispatch<Env>({ loadApiApp: noopLoader })

    expect(dispatch.isApiRequest("/api")).toBe(true)
    expect(dispatch.isApiRequest("/api/v1/products")).toBe(true)
    expect(dispatch.isApiRequest("/apiary")).toBe(false)
    expect(dispatch.isApiRequest("/shop/api")).toBe(false)
  })

  it("matches auth requests under the API prefix", () => {
    const dispatch = createApiDispatch<Env>({ loadApiApp: noopLoader })

    expect(dispatch.isAuthRequest("/api/auth")).toBe(true)
    expect(dispatch.isAuthRequest("/api/auth/me")).toBe(true)
    expect(dispatch.isAuthRequest("/api/auth/sign-in/email")).toBe(true)
    expect(dispatch.isAuthRequest("/api/v1/admin/auth")).toBe(false)
    expect(dispatch.isAuthRequest("/api/authz")).toBe(false)
  })

  it("supports a custom API prefix", () => {
    const dispatch = createApiDispatch<Env>({ loadApiApp: noopLoader, apiPrefix: "/backend" })

    expect(dispatch.isApiRequest("/backend/v1/products")).toBe(true)
    expect(dispatch.isApiRequest("/api/v1/products")).toBe(false)
    expect(dispatch.isAuthRequest("/backend/auth/me")).toBe(true)
  })

  it("strips the API prefix and preserves the query string", () => {
    const dispatch = createApiDispatch<Env>({ loadApiApp: noopLoader })
    const request = new Request("https://example.test/api/v1/admin/settings?tab=profile")

    const forwarded = dispatch.toAppRequest(request)

    expect(forwarded.url).toBe("https://example.test/v1/admin/settings?tab=profile")
  })

  it("maps the bare prefix to the app root", () => {
    const dispatch = createApiDispatch<Env>({ loadApiApp: noopLoader })
    const request = new Request("https://example.test/api?ready=1")

    const forwarded = dispatch.toAppRequest(request)

    expect(forwarded.url).toBe("https://example.test/?ready=1")
  })

  it("can rewrite stripped app paths before forwarding", () => {
    const dispatch = createApiDispatch<Env>({
      loadApiApp: noopLoader,
      rewriteAppPath: (pathname) =>
        pathname.startsWith("/v1/media/")
          ? pathname.replace("/v1/media/", "/v1/admin/media/")
          : pathname,
    })
    const request = new Request("https://example.test/api/v1/media/uploads/photo.png?size=thumb")

    const forwarded = dispatch.toAppRequest(request)

    expect(forwarded.url).toBe("https://example.test/v1/admin/media/uploads/photo.png?size=thumb")
  })

  it("preserves non-GET request method, headers, and body", async () => {
    const dispatch = createApiDispatch<Env>({ loadApiApp: noopLoader })
    const request = new Request("https://example.test/api/v1/public/checkout", {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": "req_123" },
      body: JSON.stringify({ bookingId: "bk_123" }),
    })

    const forwarded = dispatch.toAppRequest(request)

    expect(forwarded.method).toBe("POST")
    expect(forwarded.headers.get("content-type")).toBe("application/json")
    expect(forwarded.headers.get("x-request-id")).toBe("req_123")
    await expect(forwarded.json()).resolves.toEqual({ bookingId: "bk_123" })
  })

  it("loads the API app and forwards request, env, and context", async () => {
    const env: Env = { APP_URL: "https://example.test" }
    const ctx = makeCtx()
    const fetch = vi.fn(async (_request: Request, _env?: Env, _ctx?: WaitUntilContext) =>
      Response.json({ ok: true }),
    )
    const dispatch = createApiDispatch<Env>({ loadApiApp: async () => ({ fetch }) })

    const response = await dispatch.dispatch(
      new Request("https://example.test/api/health"),
      env,
      ctx,
    )

    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(fetch).toHaveBeenCalledOnce()
    const [forwardedRequest, forwardedEnv, forwardedCtx] = fetch.mock.calls[0]!
    expect((forwardedRequest as Request).url).toBe("https://example.test/health")
    expect(forwardedEnv).toBe(env)
    expect(forwardedCtx).toBe(ctx)
  })

  it("dispatches auth requests through the lean auth app without warming the full app by default", async () => {
    const env: Env = { APP_URL: "https://example.test" }
    const ctx = makeCtx()
    const fullFetch = vi.fn(async () => Response.json({ full: true }))
    const authFetch = vi.fn(async () => Response.json({ user: true }))
    const loadApiApp = vi.fn(async () => ({ fetch: fullFetch }))
    const loadAuthApp = vi.fn(async () => ({ fetch: authFetch }))
    const dispatch = createApiDispatch<Env>({ loadApiApp, loadAuthApp })

    const response = await dispatch.dispatch(
      new Request("https://example.test/api/auth/me"),
      env,
      ctx,
    )

    await expect(response.json()).resolves.toEqual({ user: true })
    expect(loadAuthApp).toHaveBeenCalledOnce()
    expect(authFetch).toHaveBeenCalledOnce()
    expect(loadApiApp).not.toHaveBeenCalled()
    expect(ctx.waitUntil).not.toHaveBeenCalled()
    expect(fullFetch).not.toHaveBeenCalled()
  })

  it("warms the full app on auth requests when enabled", async () => {
    const env: Env = { APP_URL: "https://example.test" }
    const ctx = makeCtx()
    const authFetch = vi.fn(async () => Response.json({ ok: true }))
    const loadApiApp = vi.fn(() => new Promise<FetchApp<Env>>(() => undefined))
    const dispatch = createApiDispatch<Env>({
      loadApiApp,
      loadAuthApp: async () => ({ fetch: authFetch }),
      warmApiOnAuth: true,
    })

    const response = await dispatch.dispatch(
      new Request("https://example.test/api/auth/me"),
      env,
      ctx,
    )

    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(loadApiApp).toHaveBeenCalledOnce()
    expect(ctx.waitUntil).toHaveBeenCalledOnce()
  })

  it("does not warm the full app on auth OPTIONS preflight", async () => {
    const env: Env = { APP_URL: "https://example.test" }
    const ctx = makeCtx()
    const loadApiApp = vi.fn(
      async (): Promise<FetchApp<Env>> => ({
        fetch: async () => Response.json({ full: true }),
      }),
    )
    const dispatch = createApiDispatch<Env>({
      loadApiApp,
      loadAuthApp: async () => ({ fetch: async () => new Response(null, { status: 204 }) }),
      warmApiOnAuth: true,
    })

    const response = await dispatch.dispatch(
      new Request("https://example.test/api/auth/me", { method: "OPTIONS" }),
      env,
      ctx,
    )

    expect(response.status).toBe(204)
    expect(loadApiApp).not.toHaveBeenCalled()
    expect(ctx.waitUntil).not.toHaveBeenCalled()
  })

  it("reports background warm failures through onWarmError", async () => {
    const env: Env = { APP_URL: "https://example.test" }
    const warmFailure = new Error("warm failed")
    const onWarmError = vi.fn()
    let warmPromise: Promise<unknown> | undefined
    const ctx: WaitUntilContext = {
      waitUntil: (promise) => {
        warmPromise = promise
      },
    }
    const dispatch = createApiDispatch<Env>({
      loadApiApp: async () => {
        throw warmFailure
      },
      loadAuthApp: async () => ({ fetch: async () => Response.json({ ok: true }) }),
      warmApiOnAuth: true,
      onWarmError,
    })

    await dispatch.dispatch(new Request("https://example.test/api/auth/me"), env, ctx)
    await warmPromise

    expect(onWarmError).toHaveBeenCalledWith(warmFailure)
  })
})

describe("lazyApp", () => {
  it("loads the app once across concurrent calls", async () => {
    const load = vi.fn(
      async (): Promise<FetchApp> => ({
        fetch: async () => Response.json({ ok: true }),
      }),
    )
    const loader = lazyApp(load)

    const [first, second] = await Promise.all([loader(), loader()])

    expect(load).toHaveBeenCalledOnce()
    expect(first).toBe(second)
  })
})
