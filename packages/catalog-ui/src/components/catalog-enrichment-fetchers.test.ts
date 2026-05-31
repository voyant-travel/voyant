import type { CatalogSearchHit } from "@voyantjs/catalog-react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import {
  __resetEnrichmentFetcherWarnings,
  createCatalogEnrichmentFetchers,
} from "./catalog-enrichment-fetchers.js"

function hit(id: string): CatalogSearchHit {
  return {
    id,
    score: 1,
    document: {
      entity: { module: "products", entityId: id },
      fields: {},
    },
  } as unknown as CatalogSearchHit
}

function ok(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  })
}

const samplePayload = {
  data: {
    content: {
      product: {
        id: "prod_1",
        name: "Test tour",
        description: "Long description",
        highlights: ["Hi", "Mountain"],
        hero_image_url: "https://example.com/hero.jpg",
        supplier: "supp_1",
      },
      options: [{ id: "opt_1", name: "Standard" }],
      days: [{ day_number: 1, title: "Arrival", description: "Land at airport" }],
      media: [{ url: "https://example.com/1.jpg", type: "image" }],
      policies: [{ kind: "cancellation", body: "no refunds" }],
      departures: [
        {
          id: "dep_1",
          starts_at: "2026-06-01T10:00:00Z",
          status: "open",
          capacity: 10,
          remaining: 7,
        },
      ],
    },
    served_locale: "en-GB",
    match_kind: "exact" as const,
    source: "owned" as const,
    served_stale: false,
    synthesized: false,
    machine_translated: false,
  },
}

describe("createCatalogEnrichmentFetchers", () => {
  beforeEach(() => {
    __resetEnrichmentFetcherWarnings()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test("calls the configured baseUrl + default content path with the encoded id", async () => {
    const fetchImpl = vi.fn<typeof globalThis.fetch>(async () => ok(samplePayload))
    const fetchers = createCatalogEnrichmentFetchers({
      baseUrl: "https://operator.example/api",
      fetch: fetchImpl,
    })

    await fetchers.loadProductDetail(hit("prod with space"))

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(url).toBe("https://operator.example/api/v1/admin/products/prod%20with%20space/content")
    expect((init as RequestInit).method).toBe("GET")
    expect((init as RequestInit).credentials).toBe("include")
  })

  test("strips trailing slashes from baseUrl and honors contentBasePath", async () => {
    const fetchImpl = vi.fn<typeof globalThis.fetch>(async () => ok(samplePayload))
    const fetchers = createCatalogEnrichmentFetchers({
      baseUrl: "https://operator.example/api/",
      contentBasePath: "/v1/public/products",
      fetch: fetchImpl,
    })

    await fetchers.loadProductDetail(hit("prod_1"))

    expect(fetchImpl.mock.calls[0]![0]).toBe(
      "https://operator.example/api/v1/public/products/prod_1/content",
    )
  })

  test("forwards locale and market as query params", async () => {
    const fetchImpl = vi.fn<typeof globalThis.fetch>(async () => ok(samplePayload))
    const fetchers = createCatalogEnrichmentFetchers({
      baseUrl: "/api",
      fetch: fetchImpl,
      locale: "fr-FR",
      market: "mkt_eu",
    })

    await fetchers.loadProductDetail(hit("prod_1"))

    expect(fetchImpl.mock.calls[0]![0]).toBe(
      "/api/v1/admin/products/prod_1/content?locale=fr-FR&market=mkt_eu",
    )
  })

  test("maps the content payload to a CatalogDetailEnrichment", async () => {
    const fetchImpl = vi.fn<typeof globalThis.fetch>(async () => ok(samplePayload))
    const fetchers = createCatalogEnrichmentFetchers({
      baseUrl: "/api",
      fetch: fetchImpl,
      formatSupplier: (id) => `Supplier(${id})`,
    })

    const result = await fetchers.loadProductDetail(hit("prod_1"))
    expect(result).toMatchObject({
      description: "Long description",
      highlights: ["Hi", "Mountain"],
      heroImageUrl: "https://example.com/hero.jpg",
      supplier: "Supplier(supp_1)",
      itinerary: [{ dayNumber: 1, title: "Arrival" }],
      media: [{ url: "https://example.com/1.jpg", type: "image" }],
      options: [{ id: "opt_1", name: "Standard" }],
      policies: [{ kind: "cancellation", body: "no refunds" }],
      servedLocale: "en-GB",
      matchKind: "exact",
      source: "owned",
      servedStale: false,
      synthesized: false,
      machineTranslated: false,
    })
    expect(result?.departures).toHaveLength(1)
    expect(result?.departures?.[0]).toMatchObject({
      id: "dep_1",
      startsAt: "2026-06-01T10:00:00Z",
      status: "open",
      capacity: 10,
      remaining: 7,
    })
  })

  test("deduplicates repeated cruise itinerary templates from multiple sailings", async () => {
    const cruisePayload = {
      data: {
        content: {
          cruise: {
            id: "cruise_1",
            name: "Portraits of Eastern Europe",
            description: "Long cruise description",
            hero_image_url: "https://example.com/cruise.jpg",
            cruise_line: "Uniworld",
          },
          ship: null,
          sailings: [
            {
              id: "sailing_1",
              start_date: "2026-07-03",
              end_date: "2026-07-21",
              status: "open",
              lowestPriceCached: "5039.00",
              lowestPriceCachedCurrency: "USD",
              itinerary_stops: [
                {
                  day_number: 1,
                  date: "2026-07-03",
                  port_name: "Prague",
                  description: "Arrive in Prague.",
                  is_at_sea: false,
                },
              ],
            },
          ],
          cabin_categories: [],
          itinerary_stops: [
            {
              day_number: 1,
              date: "2026-07-03",
              port_name: "Prague",
              description: "Arrive in Prague.",
              is_at_sea: false,
            },
            {
              day_number: 2,
              date: "2026-07-04",
              port_name: "Prague",
              description: "Explore Prague.",
              is_at_sea: false,
            },
            {
              day_number: 1,
              date: "2027-04-09",
              port_name: "Prague",
              description: "Arrive in Prague.",
              is_at_sea: false,
            },
          ],
          policies: [],
        },
        served_locale: "en",
        match_kind: "exact" as const,
        source: "sourced-fresh" as const,
        served_stale: false,
        synthesized: false,
        machine_translated: false,
      },
    }
    const fetchImpl = vi.fn<typeof globalThis.fetch>(async () => ok(cruisePayload))
    const fetchers = createCatalogEnrichmentFetchers({
      baseUrl: "/api",
      fetch: fetchImpl,
    })

    const result = await fetchers.loadCruiseDetail?.(hit("cruise:217_52-until-2026:en"))

    expect(result?.itinerary).toEqual([
      {
        dayNumber: 1,
        title: "Prague",
        description: "Arrive in Prague.",
        location: "Prague",
      },
      {
        dayNumber: 2,
        title: "Prague",
        description: "Explore Prague.",
        location: "Prague",
      },
    ])
    expect(result?.departures?.[0]?.itinerary).toEqual([
      {
        dayNumber: 1,
        title: "Prague",
        description: "Arrive in Prague.",
        location: "Prague",
      },
    ])
    expect(result?.departures?.[0]?.lowestPriceCents).toBe(503900)
    expect(result?.departures?.[0]?.currency).toBe("USD")
  })

  test("merges slot-availability data over the content departures", async () => {
    const fetchImpl = vi.fn<typeof globalThis.fetch>(async () => ok(samplePayload))
    const fetchers = createCatalogEnrichmentFetchers({
      baseUrl: "/api",
      fetch: fetchImpl,
      loadSlotAvailability: async () =>
        new Map([["dep_1", { id: "dep_1", status: "sold_out", initialPax: 10, remainingPax: 0 }]]),
    })

    const result = await fetchers.loadProductDetail(hit("prod_1"))
    expect(result?.departures?.[0]).toMatchObject({
      status: "sold_out",
      capacity: 10,
      remaining: 0,
    })
  })

  test("returns null on 404 and 503 (no content row / cache unavailable)", async () => {
    const fetchImpl = vi.fn<typeof globalThis.fetch>(
      async () => new Response(null, { status: 404 }),
    )
    const fetchers = createCatalogEnrichmentFetchers({ baseUrl: "/api", fetch: fetchImpl })
    expect(await fetchers.loadProductDetail(hit("prod_1"))).toBeNull()

    const fetchImpl503 = vi.fn<typeof globalThis.fetch>(
      async () => new Response(null, { status: 503 }),
    )
    const fetchers503 = createCatalogEnrichmentFetchers({ baseUrl: "/api", fetch: fetchImpl503 })
    expect(await fetchers503.loadProductDetail(hit("prod_1"))).toBeNull()
  })

  test("warns once on first 404 hinting at missing route mount", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const fetchImpl = vi.fn<typeof globalThis.fetch>(
      async () => new Response(null, { status: 404 }),
    )
    const fetchers = createCatalogEnrichmentFetchers({ baseUrl: "/api", fetch: fetchImpl })

    await fetchers.loadProductDetail(hit("a"))
    await fetchers.loadProductDetail(hit("b"))

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toMatch(/createProductContentRoutes/)
  })

  test("throws for non-404 server errors", async () => {
    const fetchImpl = vi.fn<typeof globalThis.fetch>(
      async () => new Response("oops", { status: 500 }),
    )
    const fetchers = createCatalogEnrichmentFetchers({ baseUrl: "/api", fetch: fetchImpl })
    await expect(fetchers.loadProductDetail(hit("prod_1"))).rejects.toThrow(/500/)
  })

  test("tolerates slot-availability loader failures", async () => {
    const fetchImpl = vi.fn<typeof globalThis.fetch>(async () => ok(samplePayload))
    const fetchers = createCatalogEnrichmentFetchers({
      baseUrl: "/api",
      fetch: fetchImpl,
      loadSlotAvailability: async () => {
        throw new Error("slots are down")
      },
    })

    const result = await fetchers.loadProductDetail(hit("prod_1"))
    // Falls back to content-payload departures unchanged.
    expect(result?.departures?.[0]?.status).toBe("open")
    expect(result?.departures?.[0]?.remaining).toBe(7)
  })
})
