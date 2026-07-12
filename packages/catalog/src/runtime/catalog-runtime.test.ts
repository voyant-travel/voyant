import { describe, expect, it } from "vitest"
import { CATALOG_VERTICALS, loadCatalogSlices } from "./catalog-runtime.js"
import { configureCatalogRuntimeHost } from "./host.js"

function createRuntimeDb(
  markets: readonly { id: string; defaultLanguageTag: string }[],
  locales: readonly { marketId: string; languageTag: string }[],
  channelIds: readonly string[],
) {
  const db = {} as never
  configureCatalogRuntimeHost(
    {} as never,
    {
      commerce: { loadSliceInputs: async () => ({ markets, locales }) },
      distribution: { loadActiveChannelIds: async () => channelIds },
    } as never,
  )
  return db
}

describe("loadCatalogSlices", () => {
  it("materializes channelled default-market customer slices for active channels", async () => {
    const slices = await loadCatalogSlices(createRuntimeDb([], [], ["chan_website"]))

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
    const slices = await loadCatalogSlices(
      createRuntimeDb(
        [
          {
            id: "mkt_uk",
            defaultLanguageTag: "en-GB",
          },
        ],
        [
          {
            marketId: "mkt_uk",
            languageTag: "fr-FR",
          },
        ],
        ["chan_website", "chan_b2b"],
      ),
    )
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
