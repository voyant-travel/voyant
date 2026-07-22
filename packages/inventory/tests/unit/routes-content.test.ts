import type { SourceAdapterRegistry } from "@voyant-travel/catalog/booking-engine"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { createProductContentRoutes, parseAcceptLanguage } from "../../src/routes-content.js"

// ─────────────────────────────────────────────────────────────────────────────
// parseAcceptLanguage — pure helper
// ─────────────────────────────────────────────────────────────────────────────

describe("parseAcceptLanguage", () => {
  it("parses a single tag", () => {
    expect(parseAcceptLanguage("ro-RO")).toEqual(["ro-RO"])
  })

  it("parses comma-separated tags preserving order", () => {
    expect(parseAcceptLanguage("ro-RO, en-GB")).toEqual(["ro-RO", "en-GB"])
  })

  it("honors q-factors — higher first", () => {
    expect(parseAcceptLanguage("en-GB;q=0.5, ro-RO;q=0.9, de-DE")).toEqual([
      "de-DE",
      "ro-RO",
      "en-GB",
    ])
  })

  it("treats missing q as 1.0 (highest)", () => {
    expect(parseAcceptLanguage("en;q=0.8, fr")).toEqual(["fr", "en"])
  })

  it("breaks q-factor ties by insertion order", () => {
    expect(parseAcceptLanguage("a;q=0.5, b;q=0.5, c;q=0.5")).toEqual(["a", "b", "c"])
  })

  it("filters wildcard '*' tags", () => {
    expect(parseAcceptLanguage("ro-RO, *;q=0.1")).toEqual(["ro-RO"])
  })

  it("handles malformed q values gracefully", () => {
    // q=NaN → treated as default 1.0
    expect(parseAcceptLanguage("en;q=foo, ro;q=0.5")).toEqual(["en", "ro"])
  })

  it("ignores empty segments from leading commas / extra whitespace", () => {
    expect(parseAcceptLanguage("  , ro-RO ,  ")).toEqual(["ro-RO"])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Route handler — happy path + 404
// ─────────────────────────────────────────────────────────────────────────────

function makeStubRegistry(): SourceAdapterRegistry {
  return {
    register: vi.fn(),
    resolveByConnection: vi.fn(() => undefined),
    resolveByConnectionOrThrow: vi.fn(() => {
      throw new Error("not implemented")
    }),
    resolveOrThrow: vi.fn(() => {
      throw new Error("not implemented")
    }),
    byKind: vi.fn(() => []),
    connections: vi.fn(() => []),
    kinds: vi.fn(() => []),
    has: vi.fn(() => false),
    hasKind: vi.fn(() => false),
  }
}

// We use vi.mock to swap out service-content; the route handler is
// wired through getProductContent.
vi.mock("../../src/service-content.js", () => ({
  getProductContent: vi.fn(),
}))

// Import after mock so the route uses the mocked module.
import { getProductContent } from "../../src/service-content.js"

const mockedGetProductContent = vi.mocked(getProductContent)

describe("createProductContentRoutes — GET /:id/content", () => {
  beforeEach(() => {
    mockedGetProductContent.mockClear()
  })

  function buildApp() {
    const registry = makeStubRegistry()
    const app = createProductContentRoutes({
      resolveRegistry: () => registry,
    })
    // Hono Variables type is local — we cast to satisfy the
    // injection. `db` is a stub object; the route never touches it
    // because getProductContent is mocked.
    const stubDb = {} as never
    app.use("*", async (c, next) => {
      // biome-ignore lint/suspicious/noExplicitAny: stub db variable -- owner: products; existing suppression is intentional pending typed cleanup.
      ;(c as any).set("db", stubDb)
      await next()
    })
    return { app, registry }
  }

  it("returns 404 when getProductContent returns null", async () => {
    mockedGetProductContent.mockResolvedValueOnce(null)
    const { app } = buildApp()
    const res = await app.request("/prod_unknown/content")
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("not_found")
  })

  it("returns the content payload + resolution metadata when found", async () => {
    const fakeContent = {
      product: { id: "prod_abc", name: "Sample" },
      options: [],
      days: [],
      media: [],
      policies: [],
    }
    mockedGetProductContent.mockResolvedValueOnce({
      content: fakeContent as never,
      resolution: {
        candidate: { locale: "ro-RO", payload: fakeContent as never },
        served_locale: "ro-RO",
        match_kind: "exact",
      },
      provenance: {
        source_kind: "demo",
        source_connection_id: "conn_demo",
        source_ref: "demo_prod_abc",
      },
      source: "sourced-cache",
      served_stale: false,
      synthesized: false,
      machine_translated: false,
    })
    const { app } = buildApp()
    const res = await app.request("/prod_abc/content?locale=ro-RO")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.content.product.name).toBe("Sample")
    expect(body.data.served_locale).toBe("ro-RO")
    expect(body.data.match_kind).toBe("exact")
    expect(body.data.source).toBe("sourced-cache")
    expect(body.data.provenance).toEqual({
      source_kind: "demo",
      source_connection_id: "conn_demo",
      source_ref: "demo_prod_abc",
    })
    expect(body.data.served_stale).toBe(false)
    expect(body.data.synthesized).toBe(false)
  })

  it("threads multiple ?locale params into preferredLocales (priority chain)", async () => {
    mockedGetProductContent.mockResolvedValueOnce(null)
    const { app } = buildApp()
    await app.request("/prod_abc/content?locale=ro-RO&locale=en-GB")
    const callArgs = mockedGetProductContent.mock.calls[0]
    expect(callArgs?.[2].preferredLocales).toEqual(["ro-RO", "en-GB"])
    expect(callArgs?.[2].audience).toBe("customer")
  })

  it("falls back to Accept-Language header when ?locale not set", async () => {
    mockedGetProductContent.mockResolvedValueOnce(null)
    const { app } = buildApp()
    await app.request("/prod_abc/content", {
      headers: { "accept-language": "ro-RO, en-GB;q=0.8" },
    })
    const callArgs = mockedGetProductContent.mock.calls[0]
    expect(callArgs?.[2].preferredLocales).toEqual(["ro-RO", "en-GB"])
    expect(callArgs?.[2].audience).toBe("customer")
  })

  it("falls back to en-GB when neither ?locale nor Accept-Language set", async () => {
    mockedGetProductContent.mockResolvedValueOnce(null)
    const { app } = buildApp()
    await app.request("/prod_abc/content")
    const callArgs = mockedGetProductContent.mock.calls[0]
    expect(callArgs?.[2].preferredLocales).toEqual(["en-GB"])
    expect(callArgs?.[2].audience).toBe("customer")
  })

  it("forwards market + currency from query params", async () => {
    mockedGetProductContent.mockResolvedValueOnce(null)
    const { app } = buildApp()
    await app.request("/prod_abc/content?market=GB&currency=GBP")
    const callArgs = mockedGetProductContent.mock.calls[0]
    expect(callArgs?.[2].market).toBe("GB")
    expect(callArgs?.[2].currency).toBe("GBP")
    expect(callArgs?.[2].audience).toBe("customer")
  })

  it("respects ?accept_mt=false to filter out machine-translated rows", async () => {
    mockedGetProductContent.mockResolvedValueOnce(null)
    const { app } = buildApp()
    await app.request("/prod_abc/content?accept_mt=false")
    const callArgs = mockedGetProductContent.mock.calls[0]
    expect(callArgs?.[2].acceptMachineTranslated).toBe(false)
  })

  it("respects ?accept_mt=0 as falsey", async () => {
    mockedGetProductContent.mockResolvedValueOnce(null)
    const { app } = buildApp()
    await app.request("/prod_abc/content?accept_mt=0")
    const callArgs = mockedGetProductContent.mock.calls[0]
    expect(callArgs?.[2].acceptMachineTranslated).toBe(false)
  })

  it("defaults acceptMachineTranslated to true (storefront-friendly)", async () => {
    mockedGetProductContent.mockResolvedValueOnce(null)
    const { app } = buildApp()
    await app.request("/prod_abc/content")
    const callArgs = mockedGetProductContent.mock.calls[0]
    expect(callArgs?.[2].acceptMachineTranslated).toBe(true)
  })

  it("ignores audience query params unless enabled for the route surface", async () => {
    mockedGetProductContent.mockResolvedValueOnce(null)
    const { app } = buildApp()
    await app.request("/prod_abc/content?audience=staff")
    const callArgs = mockedGetProductContent.mock.calls[0]
    expect(callArgs?.[2].audience).toBe("customer")
  })

  it("allows admin-style audience previews when enabled", async () => {
    mockedGetProductContent.mockResolvedValueOnce(null)
    const registry = makeStubRegistry()
    const app = createProductContentRoutes({
      resolveRegistry: () => registry,
      defaultAudience: "staff",
      allowAudienceQuery: true,
    })
    const stubDb = {} as never
    app.use("*", async (c, next) => {
      // biome-ignore lint/suspicious/noExplicitAny: stub db variable -- owner: products; existing suppression is intentional pending typed cleanup.
      ;(c as any).set("db", stubDb)
      await next()
    })
    await app.request("/prod_abc/content?audience=customer")
    const callArgs = mockedGetProductContent.mock.calls[0]
    expect(callArgs?.[2].audience).toBe("customer")
  })

  it("respects defaultAcceptMachineTranslated factory option", async () => {
    mockedGetProductContent.mockResolvedValueOnce(null)
    const registry = makeStubRegistry()
    const app = createProductContentRoutes({
      resolveRegistry: () => registry,
      defaultAcceptMachineTranslated: false,
    })
    const stubDb = {} as never
    app.use("*", async (c, next) => {
      // biome-ignore lint/suspicious/noExplicitAny: stub db variable -- owner: products; existing suppression is intentional pending typed cleanup.
      ;(c as any).set("db", stubDb)
      await next()
    })
    await app.request("/prod_abc/content")
    const callArgs = mockedGetProductContent.mock.calls[0]
    expect(callArgs?.[2].acceptMachineTranslated).toBe(false)
  })
})
