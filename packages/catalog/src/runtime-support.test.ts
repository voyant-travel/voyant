import { afterEach, describe, expect, it, vi } from "vitest"

import {
  createCatalogOffersTypesenseResolvers,
  withoutCatalogScopeChannel,
} from "./runtime-support.js"

const resolvers = createCatalogOffersTypesenseResolvers(
  () => ({ TYPESENSE_HOST: "typesense.example.test", TYPESENSE_API_KEY: "test-key" }),
  () =>
    withoutCatalogScopeChannel({
      locale: "ro-RO",
      audience: "staff",
      market: "ro",
      channel: "website",
    }),
)

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("catalog offer Typesense resolvers", () => {
  it("uses the configured scope collection for index-field enrichment", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ hits: [] })))
    vi.stubGlobal("fetch", fetch)

    await resolvers.fetchIndexFields({}, ["product-1"])

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/collections/products__ro-RO__staff__ro/documents/search"),
      { headers: { "X-TYPESENSE-API-KEY": "test-key" } },
    )
  })

  it("uses the configured scope collection for dynamic hotel resolution", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ hits: [] })))
    vi.stubGlobal("fetch", fetch)

    await resolvers.resolveDynamicHotelIds({}, { countryCode: "RO", city: "Bucharest" }, 10)

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/collections/products__ro-RO__staff__ro/documents/search"),
      { headers: { "X-TYPESENSE-API-KEY": "test-key" } },
    )
  })
})
