import {
  CATALOG_VERTICALS,
  loadCatalogSlices,
} from "@voyant-travel/catalog-node/standard-node/catalog-runtime"
import { marketLocales, markets } from "@voyant-travel/commerce"
import { channels } from "@voyant-travel/distribution"
import { describe, expect, it } from "vitest"

type TableRows = Map<object, unknown[]>

function createSelectDb(rowsByTable: TableRows) {
  return {
    select: () => ({
      from: (table: object) => ({
        where: () => ({
          orderBy: () => rowsByTable.get(table) ?? [],
        }),
      }),
    }),
  }
}

describe("loadCatalogSlices", () => {
  it("materializes channelled default-market customer slices for active channels", async () => {
    const rowsByTable: TableRows = new Map()
    rowsByTable.set(markets, [])
    rowsByTable.set(marketLocales, [])
    rowsByTable.set(channels, [{ id: "chan_website" }])

    const slices = await loadCatalogSlices(createSelectDb(rowsByTable) as never)

    for (const vertical of CATALOG_VERTICALS) {
      expect(slices).toContainEqual({
        vertical,
        locale: "en-GB",
        audience: "customer",
        market: "default",
      })
      expect(slices).toContainEqual({
        vertical,
        locale: "en-GB",
        audience: "customer",
        market: "default",
        channel: "chan_website",
      })
    }
  })

  it("preserves legacy unchannelled customer slices when active channels exist", async () => {
    const rowsByTable: TableRows = new Map()
    rowsByTable.set(markets, [
      {
        id: "mkt_uk",
        defaultLanguageTag: "en-GB",
      },
    ])
    rowsByTable.set(marketLocales, [
      {
        marketId: "mkt_uk",
        languageTag: "fr-FR",
      },
    ])
    rowsByTable.set(channels, [{ id: "chan_website" }, { id: "chan_b2b" }])

    const slices = await loadCatalogSlices(createSelectDb(rowsByTable) as never)
    const productCustomerSlices = slices.filter(
      (slice) =>
        slice.vertical === "products" && slice.audience === "customer" && slice.market === "mkt_uk",
    )

    expect(productCustomerSlices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ locale: "en-GB", channel: undefined }),
        expect.objectContaining({ locale: "en-GB", channel: "chan_website" }),
        expect.objectContaining({ locale: "en-GB", channel: "chan_b2b" }),
        expect.objectContaining({ locale: "fr-FR", channel: undefined }),
        expect.objectContaining({ locale: "fr-FR", channel: "chan_website" }),
        expect.objectContaining({ locale: "fr-FR", channel: "chan_b2b" }),
      ]),
    )
  })
})
