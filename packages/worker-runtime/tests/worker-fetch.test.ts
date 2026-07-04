import { describe, expect, it, vi } from "vitest"
import { createApiDispatch } from "../src/api-dispatch.js"
import type { WaitUntilContext } from "../src/types.js"
import { createWorkerFetch, lazySsr } from "../src/worker-fetch.js"

type Env = { APP_URL: string }

const env: Env = { APP_URL: "https://example.test" }
const ctx: WaitUntilContext = { waitUntil: vi.fn() }

describe("createWorkerFetch", () => {
  it("routes API-prefixed requests to the dispatch and the rest to SSR", async () => {
    const apiFetch = vi.fn(async () => Response.json({ api: true }))
    const ssr = vi.fn(async () => new Response("<html>ssr</html>"))
    const fetch = createWorkerFetch<Env>({
      api: { loadApiApp: async () => ({ fetch: apiFetch }) },
      ssr,
    })

    const apiResponse = await fetch(new Request("https://example.test/api/health"), env, ctx)
    const ssrResponse = await fetch(new Request("https://example.test/bookings"), env, ctx)

    await expect(apiResponse.json()).resolves.toEqual({ api: true })
    await expect(ssrResponse.text()).resolves.toBe("<html>ssr</html>")
    expect(apiFetch).toHaveBeenCalledOnce()
    expect(ssr).toHaveBeenCalledOnce()
  })

  it("accepts a prebuilt ApiDispatch", async () => {
    const apiFetch = vi.fn(async () => Response.json({ api: true }))
    const api = createApiDispatch<Env>({ loadApiApp: async () => ({ fetch: apiFetch }) })
    const fetch = createWorkerFetch<Env>({ api, ssr: async () => new Response("ssr") })

    const response = await fetch(new Request("https://example.test/api/v1/products"), env, ctx)

    await expect(response.json()).resolves.toEqual({ api: true })
    const forwarded = apiFetch.mock.calls[0]?.[0] as Request | undefined
    expect(forwarded?.url).toBe("https://example.test/v1/products")
  })

  it("forwards env and ctx to the SSR handler", async () => {
    const ssr = vi.fn(async () => new Response("ssr"))
    const fetch = createWorkerFetch<Env>({
      api: { loadApiApp: async () => ({ fetch: async () => new Response("api") }) },
      ssr,
    })
    const request = new Request("https://example.test/")

    await fetch(request, env, ctx)

    expect(ssr).toHaveBeenCalledWith(request, env, ctx)
  })
})

describe("lazySsr", () => {
  it("does not run the loader until a request arrives, then memoizes it", async () => {
    const handler = vi.fn(async () => new Response("ssr"))
    const load = vi.fn(async () => handler)
    const ssr = lazySsr<Env>(load)

    // Constructing the handler must not import the SSR graph.
    expect(load).not.toHaveBeenCalled()

    const request = new Request("https://example.test/")
    const a = await ssr(request, env, ctx)
    const b = await ssr(request, env, ctx)

    await expect(a.text()).resolves.toBe("ssr")
    await expect(b.text()).resolves.toBe("ssr")
    expect(load).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledTimes(2)
    expect(handler).toHaveBeenLastCalledWith(request, env, ctx)
  })

  it("loads the SSR handler exactly once even when requests race", async () => {
    const handler = vi.fn(async () => new Response("ssr"))
    const load = vi.fn(async () => handler)
    const ssr = lazySsr<Env>(load)
    const request = new Request("https://example.test/")

    await Promise.all([ssr(request, env, ctx), ssr(request, env, ctx), ssr(request, env, ctx)])

    expect(load).toHaveBeenCalledOnce()
  })
})
