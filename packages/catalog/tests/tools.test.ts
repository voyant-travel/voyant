import { createToolRegistry, type ToolContext } from "@voyant-travel/tools"
import { describe, expect, it } from "vitest"

import { type CatalogToolServices, catalogTools } from "../src/tools.js"

function ctxWith(
  services?: Partial<CatalogToolServices>,
  overrides: Partial<ToolContext> = {},
): ToolContext & { catalog?: CatalogToolServices } {
  const actor = overrides.actor ?? "customer"
  const audience = overrides.audience ?? actor
  return {
    db: {},
    actor,
    audience,
    tenantId: "default",
    resolverScope: {
      locale: "en-GB",
      audience,
      market: "default",
      actor,
      ...overrides.resolverScope,
    },
    ...overrides,
    catalog: services as CatalogToolServices | undefined,
  }
}

function makeRegistry() {
  const registry = createToolRegistry()
  registry.registerAll(catalogTools)
  return registry
}

describe("catalog tools", () => {
  it("registers read-only catalog tools with read/search scopes", () => {
    const manifest = makeRegistry().list()
    expect(manifest.map((tool) => tool.name).sort()).toEqual([
      "get_catalog_entry",
      "search_catalog",
    ])
    for (const tool of manifest) {
      expect(tool.tier).toBe("read")
      expect(tool.riskPolicy.destructive).toBe(false)
    }
    expect(manifest.find((tool) => tool.name === "search_catalog")?.requiredScopes).toEqual([
      "catalog:search",
    ])
    expect(manifest.find((tool) => tool.name === "get_catalog_entry")?.requiredScopes).toEqual([
      "catalog:read",
    ])
  })

  it("searches the caller audience slice through the injected service", async () => {
    const registry = makeRegistry()
    let forwarded: unknown
    const result = await registry.dispatch<{ total: number }>(
      "search_catalog",
      { vertical: "products", query: "beach", pagination: { limit: 5 } },
      ctxWith({
        async search(input) {
          forwarded = input
          return { hits: [], total: 0 }
        },
        async getEntry() {
          return null
        },
      }),
    )

    expect(result.total).toBe(0)
    expect(forwarded).toMatchObject({
      slice: { vertical: "products", locale: "en-GB", audience: "customer", market: "default" },
      request: { query: "beach", mode: "keyword", pagination: { limit: 5 } },
    })
  })

  it("allows staff to search a requested audience", async () => {
    const registry = makeRegistry()
    let forwarded: unknown
    await registry.dispatch(
      "search_catalog",
      { vertical: "products", audience: "customer" },
      ctxWith(
        {
          async search(input) {
            forwarded = input
            return { hits: [], total: 0 }
          },
          async getEntry() {
            return null
          },
        },
        { actor: "staff", audience: "staff" },
      ),
    )
    expect(forwarded).toMatchObject({
      slice: { audience: "customer" },
      request: { query: "", mode: "keyword" },
    })
  })

  it("rejects non-staff searches for a different audience", async () => {
    const registry = makeRegistry()
    await expect(
      registry.dispatch(
        "search_catalog",
        { vertical: "products", audience: "partner" },
        ctxWith({
          async search() {
            throw new Error("not used")
          },
          async getEntry() {
            return null
          },
        }),
      ),
    ).rejects.toMatchObject({ code: "AUTHORIZATION_DENIED" })
  })

  it("reads a resolved catalog entry and normalizes not-found to null", async () => {
    const registry = makeRegistry()
    const result = await registry.dispatch<{ entry: { id: string } | null }>(
      "get_catalog_entry",
      { vertical: "products", id: "prod_1" },
      ctxWith({
        async search() {
          return { hits: [], total: 0 }
        },
        async getEntry(input) {
          return { vertical: input.vertical, id: input.id, fields: { title: "Beach" } }
        },
      }),
    )

    expect(result.entry).toEqual({ vertical: "products", id: "prod_1", fields: { title: "Beach" } })
  })

  it("throws MISSING_SERVICE when catalog is not wired", async () => {
    const registry = makeRegistry()
    await expect(
      registry.dispatch("search_catalog", { vertical: "products" }, ctxWith(undefined)),
    ).rejects.toMatchObject({ code: "MISSING_SERVICE" })
  })
})
