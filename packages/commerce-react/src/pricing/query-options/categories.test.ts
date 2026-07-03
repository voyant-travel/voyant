import { describe, expect, it, vi } from "vitest"

import type { VoyantFetcher } from "../client.js"
import { getPriceCatalogsQueryOptions, getPricingCategoriesQueryOptions } from "./categories.js"

function listResponse() {
  return new Response(JSON.stringify({ data: [], total: 0, limit: 25, offset: 0 }), {
    headers: { "Content-Type": "application/json" },
  })
}

async function runQueryFn(queryFn: unknown) {
  if (typeof queryFn !== "function") {
    throw new Error("Expected a query function")
  }

  await queryFn({ signal: new AbortController().signal })
}

describe("pricing category query options", () => {
  it("loads settings pricing categories from the admin pricing route", async () => {
    const fetcher = vi.fn<VoyantFetcher>().mockResolvedValueOnce(listResponse())

    await runQueryFn(
      getPricingCategoriesQueryOptions(
        { baseUrl: "https://operator.example/api", fetcher },
        { limit: 25 },
      ).queryFn,
    )

    expect(fetcher).toHaveBeenCalledWith(
      "https://operator.example/api/v1/admin/pricing/pricing-categories?limit=25",
      expect.any(Object),
    )
    expect(fetcher.mock.calls[0]?.[0]).not.toContain("/v1/pricing/pricing-categories")
  })
})

describe("price catalog query options", () => {
  it("loads settings price catalogs from the admin pricing route", async () => {
    const fetcher = vi.fn<VoyantFetcher>().mockResolvedValueOnce(listResponse())

    await runQueryFn(
      getPriceCatalogsQueryOptions(
        { baseUrl: "https://operator.example/api", fetcher },
        { limit: 25, offset: 0 },
      ).queryFn,
    )

    expect(fetcher).toHaveBeenCalledWith(
      "https://operator.example/api/v1/admin/pricing/price-catalogs?limit=25&offset=0",
      expect.any(Object),
    )
    expect(fetcher.mock.calls[0]?.[0]).not.toContain("/v1/pricing/price-catalogs")
  })
})
