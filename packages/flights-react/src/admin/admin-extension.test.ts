import { describe, expect, it } from "vitest"

import { flightsVoyantModule } from "../../../flights/src/voyant.js"
import {
  createFlightsAdminExtension,
  flightsBookSearchSchema,
  flightsIndexSearchSchema,
  flightsOrdersSearchSchema,
} from "./index.js"

describe("createFlightsAdminExtension", () => {
  it("keeps the package-owned deployment facets aligned with the admin extension", () => {
    const extension = createFlightsAdminExtension()
    expect(flightsVoyantModule.admin?.routes?.map((route) => route.path)).toEqual(
      extension.routes?.map((route) => route.path),
    )
    expect(flightsVoyantModule.admin?.routes?.map((route) => route.runtime)).toEqual(
      extension.routes?.map(() => ({
        entry: "@voyant-travel/flights-react/admin",
        export: "createFlightsAdminExtension",
      })),
    )
    expect(flightsVoyantModule.admin?.copy).toEqual([
      {
        id: "@voyant-travel/flights#admin.copy",
        namespace: "flights.admin",
        fallbackLocale: "en",
        runtime: {
          entry: "@voyant-travel/flights-react/i18n",
          export: "flightsUiMessageDefinitions",
        },
      },
    ])
  })

  it("contributes no navigation (the flights item is base-nav-owned)", () => {
    const extension = createFlightsAdminExtension()
    expect(extension.id).toBe("flights")
    expect(extension.navigation).toBeUndefined()
    expect(extension.widgets).toBeUndefined()
  })

  it("describes the search page, wizard, and orders surfaces as flat siblings", () => {
    // The old file-based tree escaped the wizard out of the /flights section
    // chrome (`flights_.book.$offerId`); the code-assembled tree reproduces
    // that by mounting every contribution flat under the workspace layout.
    const extension = createFlightsAdminExtension()
    const routes = extension.routes ?? []
    expect(routes.map((route) => route.id)).toEqual([
      "flights-index",
      "flights-book",
      "flights-orders",
      "flights-order-detail",
    ])
    expect(routes.map((route) => route.path)).toEqual([
      "/flights",
      "/flights/book/$offerId",
      "/flights/orders",
      "/flights/orders/$orderId",
    ])
    expect(new Set(routes.map((route) => route.id)).size).toBe(routes.length)
  })

  it("honors basePath and labels", () => {
    const extension = createFlightsAdminExtension({
      basePath: "/zboruri",
      labels: { flights: "Zboruri" },
    })
    const index = extension.routes?.find((route) => route.id === "flights-index")
    expect(index?.path).toBe("/zboruri")
    expect(index?.title).toBe("Zboruri")
    const book = extension.routes?.find((route) => route.id === "flights-book")
    expect(book?.path).toBe("/zboruri/book/$offerId")
    expect(book?.title).toBe("Zboruri")
  })

  it("carries the full route implementation on every contribution", () => {
    // Packaged-admin RFC §4.8 endgame: lazy `page` module loaders + typed
    // search contracts; no loaders because every page fetches client-side.
    const extension = createFlightsAdminExtension()
    const routes = extension.routes ?? []
    for (const route of routes) {
      expect(typeof route.page, route.id).toBe("function")
      expect(route.loader, route.id).toBeUndefined()
      expect(route.component, route.id).toBeUndefined()
    }
    // Search-bearing routes carry a validateSearch; the order detail route has
    // no search params, so it declares none.
    for (const id of ["flights-index", "flights-book", "flights-orders"]) {
      expect(typeof routes.find((route) => route.id === id)?.validateSearch, id).toBe("function")
    }
    expect(
      routes.find((route) => route.id === "flights-order-detail")?.validateSearch,
    ).toBeUndefined()
  })

  it("resolves each lazy page to a route page module", async () => {
    const extension = createFlightsAdminExtension()
    for (const route of extension.routes ?? []) {
      const module = await route.page?.()
      expect(typeof module?.default, route.id).toBe("function")
    }
  })

  it("binds the route-backed destinations (search, orders, order detail)", () => {
    // `flightBooking.start` constructs search params, which is beyond pure
    // path interpolation — its resolver stays hand-written in the host map, so
    // the wizard route declares no destination. The orders list + detail
    // routes resolve by path interpolation, so both are route-backed.
    const extension = createFlightsAdminExtension()
    const byId = (id: string) => extension.routes?.find((route) => route.id === id)
    expect(byId("flights-index")?.destination).toBe("flight.search")
    expect(byId("flights-book")?.destination).toBeUndefined()
    expect(byId("flights-orders")?.destination).toBe("flight.orders")
    expect(byId("flights-order-detail")?.destination).toBe("flightOrder.detail")
  })

  it("validates and defaults the search contracts", () => {
    const indexDefaults = flightsIndexSearchSchema.parse({})
    expect(indexDefaults).toEqual({
      tripType: "round_trip",
      leg: "outbound",
      pax_a: 1,
      pax_c: 0,
      pax_i: 0,
      cabin: "economy",
      page: 1,
    })

    const indexParsed = flightsIndexSearchSchema.parse({
      tripType: "one_way",
      pax_a: "2",
      maxStops: "1",
      page: "3",
    })
    expect(indexParsed.tripType).toBe("one_way")
    expect(indexParsed.pax_a).toBe(2)
    expect(indexParsed.maxStops).toBe(1)
    expect(indexParsed.page).toBe(3)

    const bookParsed = flightsBookSearchSchema.parse({ pax_c: "1" })
    expect(bookParsed).toEqual({ pax_a: 1, pax_c: 1, pax_i: 0, cabin: "economy" })
    expect(() => flightsBookSearchSchema.parse({ cabin: "luxury" })).toThrow()

    // Orders list search — filters are optional; unknown statuses rejected.
    expect(flightsOrdersSearchSchema.parse({})).toEqual({})
    expect(flightsOrdersSearchSchema.parse({ q: "PNR1", status: "confirmed" })).toEqual({
      q: "PNR1",
      status: "confirmed",
    })
    expect(() => flightsOrdersSearchSchema.parse({ status: "held" })).toThrow()
  })
})
