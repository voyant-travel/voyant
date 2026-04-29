import { describe, expect, it, vi } from "vitest"

import {
  getProductQueryOptions,
  getProductsQueryOptions,
  getPublicProductsQueryOptions,
  getVoyageQueryOptions,
} from "../src/query-options.js"

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    statusText: init.statusText ?? "OK",
    headers: { "Content-Type": "application/json" },
  })
}

const adminProductListBody = {
  data: [],
  total: 0,
  localTotal: 0,
  adapterCount: 0,
  limit: 50,
  offset: 0,
}

describe("query-options factories", () => {
  it("getProductsQueryOptions hits /v1/admin/charters/products with serialised filters", async () => {
    const fetcher = vi.fn((url: string) => {
      expect(url).toBe("https://api.example.com/v1/admin/charters/products?status=live&limit=20")
      return Promise.resolve(jsonResponse(adminProductListBody))
    })
    const options = getProductsQueryOptions(
      { baseUrl: "https://api.example.com", fetcher },
      { status: "live", limit: 20 },
    )
    const result = await options.queryFn?.({} as never)
    expect(result).toMatchObject({ data: [], localTotal: 0 })
  })

  it("getProductQueryOptions encodes the unified key (works for external `<provider>:<ref>`)", async () => {
    const fetcher = vi.fn((url: string) => {
      expect(url).toBe(
        "https://api.example.com/v1/admin/charters/products/voyant-connect%3Aext-1?include=voyages",
      )
      return Promise.resolve(
        jsonResponse({
          data: {
            source: "external",
            sourceProvider: "voyant-connect",
            sourceRef: { externalId: "ext-1" },
            product: { name: "Test", slug: "test", lineName: "Acme" },
          },
        }),
      )
    })
    const options = getProductQueryOptions(
      { baseUrl: "https://api.example.com", fetcher },
      "voyant-connect:ext-1",
      { include: ["voyages"] },
    )
    const result = (await options.queryFn?.({} as never)) as { source?: string }
    expect(result?.source).toBe("external")
  })

  it("getVoyageQueryOptions omits the include qs when empty", async () => {
    const fetcher = vi.fn((url: string) => {
      expect(url).toBe("https://api.example.com/v1/admin/charters/voyages/chrv_abc")
      return Promise.resolve(
        jsonResponse({
          data: {
            id: "chrv_abc",
            productId: "chrt_x",
            yachtId: "chry_y",
            voyageCode: "V1",
            name: null,
            embarkPortFacilityId: null,
            embarkPortName: null,
            disembarkPortFacilityId: null,
            disembarkPortName: null,
            departureDate: "2026-04-12",
            returnDate: "2026-04-19",
            nights: 7,
            bookingModes: ["per_suite"],
            appointmentOnly: false,
            wholeYachtPricesByCurrency: {},
            apaPercentOverride: null,
            mybaTemplateIdOverride: null,
            charterAreaOverride: null,
            salesStatus: "open",
            availabilityNote: null,
            externalRefs: null,
            lastSyncedAt: null,
            createdAt: "2026-04-01T00:00:00Z",
            updatedAt: "2026-04-01T00:00:00Z",
          },
        }),
      )
    })
    const options = getVoyageQueryOptions(
      { baseUrl: "https://api.example.com", fetcher },
      "chrv_abc",
    )
    const result = (await options.queryFn?.({} as never)) as { voyageCode?: string }
    expect(result?.voyageCode).toBe("V1")
  })

  it("getPublicProductsQueryOptions hits the /v1/public surface (no admin prefix)", async () => {
    const fetcher = vi.fn((url: string) => {
      expect(url).toContain("/v1/public/charters")
      return Promise.resolve(jsonResponse({ data: [], total: 0, limit: 50, offset: 0 }))
    })
    const options = getPublicProductsQueryOptions({
      baseUrl: "https://api.example.com",
      fetcher,
    })
    await options.queryFn?.({} as never)
    expect(fetcher).toHaveBeenCalled()
  })
})
