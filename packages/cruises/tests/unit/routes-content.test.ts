import type { SourceAdapterRegistry } from "@voyant-travel/catalog/booking-engine"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { encodeSourceRef, makeExternalSourceKey } from "../../src/lib/key.js"
import { createCruiseContentRoutes, parseAcceptLanguage } from "../../src/routes-content.js"

describe("parseAcceptLanguage (cruises copy)", () => {
  // The cruise route ships its own copy to keep the package boundary
  // clean. A few smoke tests guarding feature parity with the products
  // copy — full coverage lives in the products test file.
  it("parses tags with q-factors", () => {
    expect(parseAcceptLanguage("en-GB;q=0.5, ro-RO;q=0.9, de-DE")).toEqual([
      "de-DE",
      "ro-RO",
      "en-GB",
    ])
  })
  it("falls back to insertion order when q ties", () => {
    expect(parseAcceptLanguage("a, b, c")).toEqual(["a", "b", "c"])
  })
})

function makeStubRegistry(): SourceAdapterRegistry {
  return {
    register: vi.fn(),
    get: vi.fn(() => undefined),
    resolveOrThrow: vi.fn(() => {
      throw new Error("not implemented")
    }),
    has: vi.fn(() => false),
    kinds: vi.fn(() => []),
  }
}

vi.mock("../../src/service-content.js", () => ({
  getCruiseContent: vi.fn(),
}))

import { getCruiseContent } from "../../src/service-content.js"

const mockedGetCruiseContent = vi.mocked(getCruiseContent)

describe("createCruiseContentRoutes — GET /:key/content", () => {
  beforeEach(() => {
    mockedGetCruiseContent.mockClear()
  })

  function buildApp(opts: Partial<Parameters<typeof createCruiseContentRoutes>[0]> = {}) {
    const registry = makeStubRegistry()
    const app = createCruiseContentRoutes({
      resolveRegistry: () => registry,
      ...opts,
    })
    const stubDb = {} as never
    app.use("*", async (c, next) => {
      // biome-ignore lint/suspicious/noExplicitAny: stub db variable -- owner: cruises; existing suppression is intentional pending typed cleanup.
      ;(c as any).set("db", stubDb)
      await next()
    })
    return { app, registry }
  }

  it("returns 400 for an invalid unified key", async () => {
    const { app } = buildApp()
    const res = await app.request("/!!!invalid/content")
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("invalid_key")
  })

  it("returns 404 for owned (local) keys by default unless owned keys are enabled", async () => {
    const { app } = buildApp()
    const res = await app.request("/cru_abc/content")
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("owned_not_supported")
  })

  it("dispatches to getCruiseContent for external keys (provider:ref)", async () => {
    mockedGetCruiseContent.mockResolvedValueOnce(null)
    const { app } = buildApp()
    const res = await app.request("/voyant-connect:cruise-1/content")
    expect(mockedGetCruiseContent).toHaveBeenCalledTimes(1)
    // Returns 404 because mock returned null — but the dispatch happened.
    expect(res.status).toBe(404)
  })

  it("translates legacy external keys to encoded SourceRef entity ids", async () => {
    mockedGetCruiseContent.mockResolvedValueOnce(null)
    const { app } = buildApp()
    await app.request("/voyant-connect:cruise-1/content")
    const callArgs = mockedGetCruiseContent.mock.calls[0]
    expect(callArgs?.[1]).toBe(`crus_${encodeSourceRef({ externalId: "cruise-1" })}`)
  })

  it("preserves full SourceRef values from encoded external keys", async () => {
    mockedGetCruiseContent.mockResolvedValueOnce(null)
    const sourceRef = {
      connectionId: "conn-123",
      provider: "scenic",
      externalId: "cruise/1:departure",
      syncedRowId: "sync-row-7",
    }
    const key = makeExternalSourceKey("voyant-connect", sourceRef)
    const { app } = buildApp()
    await app.request(`/${key}/content`)
    const callArgs = mockedGetCruiseContent.mock.calls[0]
    expect(callArgs?.[1]).toBe(`crus_${encodeSourceRef(sourceRef)}`)
  })

  it("returns CruiseContent payload + resolution metadata when found", async () => {
    const fakeContent = {
      cruise: { id: "crus_abc", name: "Greek Isles" },
      ship: null,
      sailings: [],
      cabin_categories: [],
      itinerary_stops: [],
      policies: [],
    }
    mockedGetCruiseContent.mockResolvedValueOnce({
      content: fakeContent as never,
      resolution: {
        candidate: { locale: "en-GB", payload: fakeContent as never },
        served_locale: "en-GB",
        match_kind: "exact",
      },
      provenance: {
        source_kind: "voyant-connect",
        source_connection_id: "conn_1",
        source_ref: "cruise-abc",
      },
      source: "sourced-fresh",
      served_stale: false,
      synthesized: false,
      machine_translated: false,
    })
    const { app } = buildApp()
    const res = await app.request("/voyant-connect:cruise-abc/content?locale=en-GB")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.content.cruise.name).toBe("Greek Isles")
    expect(body.data.served_locale).toBe("en-GB")
    expect(body.data.source).toBe("sourced-fresh")
    expect(body.data.provenance).toEqual({
      source_kind: "voyant-connect",
      source_connection_id: "conn_1",
      source_ref: "cruise-abc",
    })
  })

  it("dispatches owned keys when allowOwnedKeys: true", async () => {
    mockedGetCruiseContent.mockResolvedValueOnce(null)
    const { app } = buildApp({ allowOwnedKeys: true })
    const res = await app.request("/cru_abc/content")
    expect(mockedGetCruiseContent).toHaveBeenCalledTimes(1)
    expect(res.status).toBe(404)
    const callArgs = mockedGetCruiseContent.mock.calls[0]
    expect(callArgs?.[1]).toBe("cru_abc")
  })

  it("returns owned CruiseContent when the service resolves an owned cruise", async () => {
    const fakeContent = {
      cruise: { id: "cru_abc", name: "Owned Greek Isles" },
      ship: null,
      sailings: [],
      cabin_categories: [],
      itinerary_stops: [],
      policies: [],
    }
    mockedGetCruiseContent.mockResolvedValueOnce({
      content: fakeContent as never,
      resolution: {
        candidate: { locale: "und", payload: fakeContent as never },
        served_locale: "und",
        match_kind: "any",
      },
      provenance: { source_kind: "owned" },
      source: "owned",
      served_stale: false,
      synthesized: false,
      machine_translated: false,
    })
    const { app } = buildApp({ allowOwnedKeys: true })
    const res = await app.request("/cru_abc/content?locale=en-GB")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.content.cruise.name).toBe("Owned Greek Isles")
    expect(body.data.source).toBe("owned")
    expect(body.data.provenance).toEqual({ source_kind: "owned" })
  })

  it("threads market + currency from query params", async () => {
    mockedGetCruiseContent.mockResolvedValueOnce(null)
    const { app } = buildApp()
    await app.request("/voyant-connect:cruise-1/content?market=GB&currency=GBP")
    const callArgs = mockedGetCruiseContent.mock.calls[0]
    expect(callArgs?.[2].market).toBe("GB")
    expect(callArgs?.[2].currency).toBe("GBP")
  })

  it("falls back to Accept-Language when ?locale not set", async () => {
    mockedGetCruiseContent.mockResolvedValueOnce(null)
    const { app } = buildApp()
    await app.request("/voyant-connect:cruise-1/content", {
      headers: { "accept-language": "ro-RO, en-GB;q=0.8" },
    })
    const callArgs = mockedGetCruiseContent.mock.calls[0]
    expect(callArgs?.[2].preferredLocales).toEqual(["ro-RO", "en-GB"])
  })

  it("respects ?accept_mt=false", async () => {
    mockedGetCruiseContent.mockResolvedValueOnce(null)
    const { app } = buildApp()
    await app.request("/voyant-connect:cruise-1/content?accept_mt=false")
    const callArgs = mockedGetCruiseContent.mock.calls[0]
    expect(callArgs?.[2].acceptMachineTranslated).toBe(false)
  })

  it("respects defaultAcceptMachineTranslated factory option", async () => {
    mockedGetCruiseContent.mockResolvedValueOnce(null)
    const { app } = buildApp({ defaultAcceptMachineTranslated: false })
    await app.request("/voyant-connect:cruise-1/content")
    const callArgs = mockedGetCruiseContent.mock.calls[0]
    expect(callArgs?.[2].acceptMachineTranslated).toBe(false)
  })
})
