import { describe, expect, it } from "vitest"

import { createDemoCatalogAdapter, DEMO_SOURCE_KIND } from "../../src/adapter.js"

/**
 * Lifecycle methods all hit the demo-api over HTTP. These tests exercise
 * the static surface (kind, capabilities) plus a couple of method calls
 * with a `fetch` stub so we know the request shapes match the demo-api's
 * contract. Full end-to-end coverage runs against a live demo-api in the
 * booking-engine integration tests.
 */

interface FetchCall {
  url: string
  init: RequestInit
}

function makeFetchStub(handler: (call: FetchCall) => unknown) {
  const calls: FetchCall[] = []
  const fetchImpl: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: FetchCall = { url: String(input), init: init ?? {} }
    calls.push(call)
    const body = handler(call)
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }
  return { fetchImpl, calls }
}

describe("createDemoCatalogAdapter", () => {
  it('declares source.kind = "demo"', () => {
    const adapter = createDemoCatalogAdapter({ baseUrl: "http://demo" })
    expect(adapter.kind).toBe(DEMO_SOURCE_KIND)
    expect(adapter.kind).toBe("demo")
  })

  it("defaults to feeding the products vertical", () => {
    const adapter = createDemoCatalogAdapter({ baseUrl: "http://demo" })
    expect(adapter.capabilities.verticals).toEqual(["products"])
  })

  it("accepts an explicit products vertical list", () => {
    const adapter = createDemoCatalogAdapter({
      baseUrl: "http://demo",
      verticals: ["products"],
    })
    expect(adapter.capabilities.verticals).toEqual(["products"])
  })

  it("rejects non-product verticals because demo content is product-shaped", () => {
    expect(() =>
      createDemoCatalogAdapter({
        baseUrl: "http://demo",
        verticals: ["products", "cruises"],
      }),
    ).toThrow("catalog-demo adapter only supports the products vertical")
  })

  it("declares the booking-forwarding capability", () => {
    const adapter = createDemoCatalogAdapter({ baseUrl: "http://demo" })
    expect(adapter.capabilities.supportsBookingForwarding).toBe(true)
    expect(adapter.capabilities.supportsLiveResolution).toBe(true)
    expect(adapter.capabilities.supportsDriftDetection).toBe(false)
  })

  it("supports cancel + status post-book operations", () => {
    const adapter = createDemoCatalogAdapter({ baseUrl: "http://demo" })
    expect(adapter.capabilities.postBookOperations).toEqual(["cancel", "status"])
  })

  it("connect pings /health", async () => {
    const { fetchImpl, calls } = makeFetchStub(() => ({ ok: true }))
    const adapter = createDemoCatalogAdapter({ baseUrl: "http://demo", fetch: fetchImpl })
    await adapter.connect({ connection_id: "test" })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe("http://demo/health")
  })

  it("getState returns 'active' when /health succeeds", async () => {
    const { fetchImpl } = makeFetchStub(() => ({ ok: true }))
    const adapter = createDemoCatalogAdapter({ baseUrl: "http://demo", fetch: fetchImpl })
    await expect(adapter.getState({ connection_id: "test" })).resolves.toBe("active")
  })

  it("discover POSTs to /discover with cursor and verticals", async () => {
    const { fetchImpl, calls } = makeFetchStub(() => ({
      projections: [],
      next_cursor: undefined,
    }))
    const adapter = createDemoCatalogAdapter({ baseUrl: "http://demo", fetch: fetchImpl })
    await adapter.discover({ connection_id: "test" }, "page-2")
    expect(calls[0]?.url).toBe("http://demo/discover")
    expect(calls[0]?.init.method).toBe("POST")
    const body = JSON.parse(String(calls[0]?.init.body)) as Record<string, unknown>
    expect(body.cursor).toBe("page-2")
    expect(body.entityModules).toEqual(["products"])
  })

  it("liveResolve POSTs to /live-resolve with the request body", async () => {
    const { fetchImpl, calls } = makeFetchStub(() => ({ values: {} }))
    const adapter = createDemoCatalogAdapter({ baseUrl: "http://demo", fetch: fetchImpl })
    await adapter.liveResolve?.(
      { connection_id: "test" },
      {
        ids: ["abc"],
        scope: { locale: "en-GB", audience: "staff", market: "default" },
      },
    )
    expect(calls[0]?.url).toBe("http://demo/live-resolve")
    expect(calls[0]?.init.method).toBe("POST")
  })

  it("reserve POSTs to /reserve and round-trips the result", async () => {
    const { fetchImpl, calls } = makeFetchStub(() => ({
      upstream_ref: "ord_123",
      status: "confirmed",
    }))
    const adapter = createDemoCatalogAdapter({ baseUrl: "http://demo", fetch: fetchImpl })
    const result = await adapter.reserve?.(
      { connection_id: "test" },
      { entity_module: "products", entity_id: "inv_1", parameters: {} },
    )
    expect(calls[0]?.url).toBe("http://demo/reserve")
    expect(result?.upstream_ref).toBe("ord_123")
    expect(result?.status).toBe("confirmed")
  })

  it("cancel POSTs to /cancel with upstream_ref and reason", async () => {
    const { fetchImpl, calls } = makeFetchStub(() => ({ status: "cancelled" }))
    const adapter = createDemoCatalogAdapter({ baseUrl: "http://demo", fetch: fetchImpl })
    await adapter.cancel?.(
      { connection_id: "test" },
      { upstream_ref: "ord_123", reason: "operator-cancelled" },
    )
    const body = JSON.parse(String(calls[0]?.init.body)) as Record<string, unknown>
    expect(body.upstream_ref).toBe("ord_123")
    expect(body.reason).toBe("operator-cancelled")
  })
})
