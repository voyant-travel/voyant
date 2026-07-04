import type { IndexerSlice } from "@voyant-travel/catalog"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  createTypesenseCollectionAdmin,
  createTypesenseDocumentSearch,
  listObsoleteCatalogCollections,
  listStaleDocuments,
  TypesenseCollectionAdminError,
  TypesenseDocumentSearchError,
} from "./reindex-stale-documents"

const customerProductsSlice: IndexerSlice = {
  vertical: "products",
  locale: "en-GB",
  audience: "customer",
  market: "default",
}

describe("listStaleDocuments", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("keeps live owned and sourced documents while pruning stale customer docs", async () => {
    const search = vi.fn().mockResolvedValueOnce({
      hits: [
        { document: { id: "prod_live_owned" } },
        { document: { id: "cdmi_live_sourced" } },
        { document: { id: "cdmi_stale_sourced" } },
      ],
    })

    const stale = await listStaleDocuments(
      customerProductsSlice,
      new Set(["prod_live_owned", "cdmi_live_sourced"]),
      search,
    )

    expect(stale).toEqual(["cdmi_stale_sourced"])
    expect(search).toHaveBeenCalledOnce()
    expect(search.mock.calls[0]?.[0]).toBe("products__en-GB__customer__default")

    const params = search.mock.calls[0]?.[1] as URLSearchParams
    expect(params.get("filter_by")).toBeNull()
    expect(params.get("include_fields")).toBe("id")
  })

  it("pages through the collection until Typesense returns a short page", async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce({
        hits: [{ document: { id: "stale_1" } }, { document: { id: "live_1" } }],
      })
      .mockResolvedValueOnce({
        hits: [{ document: { id: "stale_2" } }],
      })

    const stale = await listStaleDocuments(customerProductsSlice, new Set(["live_1"]), search, {
      perPage: 2,
    })

    expect(stale).toEqual(["stale_1", "stale_2"])
    expect(search).toHaveBeenCalledTimes(2)
    expect((search.mock.calls[0]?.[1] as URLSearchParams).get("page")).toBe("1")
    expect((search.mock.calls[1]?.[1] as URLSearchParams).get("page")).toBe("2")
  })

  it("treats missing collections as empty during purge", async () => {
    const search = vi.fn().mockResolvedValueOnce(null)

    await expect(
      listStaleDocuments(customerProductsSlice, new Set(["live_1"]), search),
    ).resolves.toEqual([])
  })

  it("throws on non-404 Typesense search failures instead of silently skipping purge", async () => {
    const fetchMock = vi.fn(async () => new Response("bad key", { status: 401 }))
    vi.stubGlobal("fetch", fetchMock)

    const search = createTypesenseDocumentSearch("http://typesense.test", "bad")
    await expect(
      search("products__en-GB__customer__default", new URLSearchParams()),
    ).rejects.toBeInstanceOf(TypesenseDocumentSearchError)
    await expect(
      search("products__en-GB__customer__default", new URLSearchParams()),
    ).rejects.toMatchObject({
      collection: "products__en-GB__customer__default",
      status: 401,
    })
  })
})

describe("listObsoleteCatalogCollections", () => {
  const activeMarketSlice: IndexerSlice = {
    vertical: "cruises",
    locale: "en-GB",
    audience: "customer",
    market: "mkt_current",
  }

  it("returns old market collections that no longer match active slices", () => {
    const obsolete = listObsoleteCatalogCollections(
      [customerProductsSlice, activeMarketSlice],
      [
        "products__en-GB__customer__default",
        "cruises__en-GB__customer__mkt_current",
        "cruises__en-GB__customer__mkt_old",
        "cruises__en-GB__staff__mkt_old",
      ],
      { verticals: new Set(["products", "cruises"]) },
    )

    expect(obsolete).toEqual([
      "cruises__en-GB__customer__mkt_old",
      "cruises__en-GB__staff__mkt_old",
    ])
  })

  it("ignores unrelated and differently-prefixed Typesense collections", () => {
    const obsolete = listObsoleteCatalogCollections(
      [customerProductsSlice],
      [
        "analytics_events",
        "custom__products__en-GB__customer__mkt_old",
        "products__en-GB__partner__mkt_old",
        "unknown__en-GB__customer__mkt_old",
      ],
      {
        verticals: new Set(["products"]),
        audiences: new Set(["staff", "customer"]),
      },
    )

    expect(obsolete).toEqual([])
  })
})

describe("createTypesenseCollectionAdmin", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("lists collection names through the Typesense REST API", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json([{ name: "products__en-GB__customer__default" }]),
    )
    vi.stubGlobal("fetch", fetchMock)

    const admin = createTypesenseCollectionAdmin("http://typesense.test", "xyz")
    await expect(admin.list()).resolves.toEqual(["products__en-GB__customer__default"])
    expect(fetchMock).toHaveBeenCalledWith(new URL("http://typesense.test/collections"), {
      headers: { "X-TYPESENSE-API-KEY": "xyz" },
    })
  })

  it("treats missing collection deletes as already removed", async () => {
    const fetchMock = vi.fn(async () => new Response("missing", { status: 404 }))
    vi.stubGlobal("fetch", fetchMock)

    const admin = createTypesenseCollectionAdmin("http://typesense.test", "xyz")
    await expect(admin.delete("products__en-GB__customer__old")).resolves.toBe(false)
  })

  it("throws on collection admin failures", async () => {
    const fetchMock = vi.fn(async () => new Response("bad key", { status: 401 }))
    vi.stubGlobal("fetch", fetchMock)

    const admin = createTypesenseCollectionAdmin("http://typesense.test", "bad")
    await expect(admin.list()).rejects.toBeInstanceOf(TypesenseCollectionAdminError)
    await expect(admin.list()).rejects.toMatchObject({ operation: "list", status: 401 })
  })
})
