import type { IndexerAdapter } from "@voyant-travel/catalog-contracts/indexer/contract"
import type { Context } from "hono"
import { describe, expect, it, vi } from "vitest"

import { createOperatorCatalogOffersRouteModuleOptions } from "./offers-runtime.js"

function createIndexer(search: IndexerAdapter["search"]): IndexerAdapter {
  return {
    capabilities: {
      supportsKeywordSearch: true,
      supportsHybridSearch: false,
      supportsVectorFields: false,
      vectorDimensions: null,
      maxVectorsPerDocument: null,
      supportsCrossAudienceFederation: false,
      supportsAdminDenormalization: false,
    },
    async ensureCollection() {},
    async upsert() {},
    async delete() {},
    search,
    async bulkReindex() {},
  }
}

describe("operator catalog offers runtime", () => {
  it("routes offer index lookups through the injected indexer adapter", async () => {
    const search = vi.fn<IndexerAdapter["search"]>().mockResolvedValue({
      hits: [
        {
          id: "product-1",
          score: 0,
          document: { id: "product-1", fields: { name: "Hotel One" } },
        },
      ],
      total: 1,
    })
    const context = {} as Context
    const options = createOperatorCatalogOffersRouteModuleOptions(
      () => ({ locale: "en-GB", audience: "staff", market: "default" }),
      () => createIndexer(search),
    )

    await expect(options.fetchIndexFields(context, ["product-1"])).resolves.toEqual(
      new Map([["product-1", { name: "Hotel One" }]]),
    )
    expect(search).toHaveBeenCalledWith(
      { vertical: "products", locale: "en-GB", audience: "staff", market: "default" },
      expect.objectContaining({
        filters: [{ kind: "in", field: "id", values: ["product-1"] }],
      }),
    )
  })
})
