import { handleApiError } from "@voyantjs/hono"
import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

import type {
  IndexerAdapter,
  IndexerSlice,
  SearchRequest,
  SearchResults,
} from "../indexer/contract.js"

import {
  type CatalogSearchExecuteInput,
  createCatalogSearchHonoModule,
  createCatalogSearchRoutes,
} from "./routes.js"

const emptyResults: SearchResults = { total: 0, hits: [], facets: {} }

function createIndexer(
  search: (slice: IndexerSlice, request: SearchRequest) => Promise<SearchResults> = async () =>
    emptyResults,
): IndexerAdapter {
  return {
    capabilities: {
      supportsKeywordSearch: true,
      supportsHybridSearch: true,
      supportsVectorFields: true,
      vectorDimensions: 3,
      maxVectorsPerDocument: null,
      supportsCrossAudienceFederation: false,
      supportsAdminDenormalization: true,
    },
    ensureCollection: async () => {},
    upsert: async () => {},
    delete: async () => {},
    search,
    bulkReindex: async () => {},
  }
}

function routeApp(options: Parameters<typeof createCatalogSearchRoutes>[0]) {
  const app = new Hono()
  app.onError(handleApiError)
  app.route("/v1/admin/catalog", createCatalogSearchRoutes(options))
  return app
}

describe("createCatalogSearchRoutes", () => {
  it("exposes admin and public search routes through the Hono module wrapper", () => {
    const module = createCatalogSearchHonoModule({
      resolveRuntime: () => ({
        indexer: createIndexer(),
        defaultScope: { locale: "en-GB", audience: "staff", market: "default" },
      }),
    })

    expect(module.module.name).toBe("catalog")
    expect(module.adminRoutes).toBeTruthy()
    expect(module.publicRoutes).toBeTruthy()
  })

  it("requires a vertical", async () => {
    const app = routeApp({
      surface: "admin",
      resolveRuntime: () => ({
        indexer: createIndexer(),
        defaultScope: { locale: "en-GB", audience: "staff", market: "default" },
      }),
    })

    const response = await app.request("/v1/admin/catalog/search", {
      method: "POST",
      body: JSON.stringify({ query: "rome" }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "vertical is required" })
  })

  it("returns shared validation errors for invalid search bodies", async () => {
    const executeSearch = vi.fn(
      async (_input: CatalogSearchExecuteInput): Promise<SearchResults> => emptyResults,
    )
    const app = routeApp({
      surface: "admin",
      resolveRuntime: () => ({
        indexer: createIndexer(),
        defaultScope: { locale: "en-GB", audience: "staff", market: "default" },
      }),
      executeSearch,
    })

    const response = await app.request("/v1/admin/catalog/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        vertical: "products",
        mode: "unknown",
        pagination: { limit: "10" },
      }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      code: "invalid_request",
    })
    expect(executeSearch).not.toHaveBeenCalled()
  })

  it("returns a deployment error when no indexer is configured", async () => {
    const app = routeApp({
      surface: "admin",
      resolveRuntime: () => ({
        defaultScope: { locale: "en-GB", audience: "staff", market: "default" },
      }),
    })

    const response = await app.request("/v1/admin/catalog/search", {
      method: "POST",
      body: JSON.stringify({ vertical: "products" }),
    })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: "Search indexer is not configured (missing TYPESENSE_HOST)",
    })
  })

  it("uses the admin default audience and the customer public audience", async () => {
    const executeSearch = vi.fn(
      async (_input: CatalogSearchExecuteInput): Promise<SearchResults> => emptyResults,
    )
    const module = createCatalogSearchHonoModule({
      resolveRuntime: () => ({
        indexer: createIndexer(),
        defaultScope: { locale: "en-GB", audience: "staff", market: "default" },
      }),
      executeSearch,
    })
    const app = new Hono()
    app.route("/v1/admin/catalog", module.adminRoutes!)
    app.route("/v1/public/catalog", module.publicRoutes!)

    await app.request("/v1/admin/catalog/search", {
      method: "POST",
      body: JSON.stringify({ vertical: "products", mode: "keyword" }),
    })
    await app.request("/v1/public/catalog/search", {
      method: "POST",
      body: JSON.stringify({ vertical: "products", mode: "keyword", locale: "ro-RO" }),
    })

    expect(executeSearch.mock.calls[0]?.[0].slice).toEqual({
      vertical: "products",
      locale: "en-GB",
      audience: "staff",
      market: "default",
    })
    expect(executeSearch.mock.calls[1]?.[0].slice).toEqual({
      vertical: "products",
      locale: "ro-RO",
      audience: "customer",
      market: "default",
    })
  })

  it("downgrades semantic modes to keyword when embeddings are unavailable", async () => {
    const executeSearch = vi.fn(
      async (_input: CatalogSearchExecuteInput): Promise<SearchResults> => emptyResults,
    )
    const app = routeApp({
      surface: "admin",
      resolveRuntime: () => ({
        indexer: createIndexer(),
        defaultScope: { locale: "en-GB", audience: "staff", market: "default" },
      }),
      executeSearch,
    })

    const response = await app.request("/v1/admin/catalog/search", {
      method: "POST",
      body: JSON.stringify({ vertical: "products", mode: "hybrid", query: "rome" }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ mode: "keyword" })
    expect(executeSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({ mode: "keyword" }),
      }),
    )
  })

  it("retries hybrid searches as keyword when semantic execution fails", async () => {
    const executeSearch = vi
      .fn(async (_input: CatalogSearchExecuteInput): Promise<SearchResults> => emptyResults)
      .mockRejectedValueOnce(new Error("embedding provider unavailable"))
      .mockResolvedValueOnce(emptyResults)
    const app = routeApp({
      surface: "admin",
      resolveRuntime: () => ({
        indexer: createIndexer(),
        embeddings: { kind: "test-embeddings" },
        defaultScope: { locale: "en-GB", audience: "staff", market: "default" },
      }),
      executeSearch,
    })

    const response = await app.request("/v1/admin/catalog/search", {
      method: "POST",
      body: JSON.stringify({ vertical: "products", mode: "hybrid", query: "rome" }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ mode: "keyword" })
    expect(executeSearch.mock.calls.map(([input]) => input.request.mode)).toEqual([
      "hybrid",
      "keyword",
    ])
  })
})
