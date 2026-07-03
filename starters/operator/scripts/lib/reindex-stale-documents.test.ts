import type { IndexerSlice } from "@voyant-travel/catalog"
import { describe, expect, it, vi } from "vitest"

import { listStaleDocuments } from "./reindex-stale-documents"

const customerProductsSlice: IndexerSlice = {
  vertical: "products",
  locale: "en-GB",
  audience: "customer",
  market: "default",
}

describe("listStaleDocuments", () => {
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
})
