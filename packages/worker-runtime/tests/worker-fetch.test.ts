import { describe, expect, it, vi } from "vitest"
import { createApiDispatch } from "../src/api-dispatch.js"
import type { WaitUntilContext } from "../src/types.js"
import { createWorkerFetch } from "../src/worker-fetch.js"

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
