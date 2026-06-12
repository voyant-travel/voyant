import { describe, expect, it } from "vitest"

import {
  createFlightsAdminExtension,
  flightsBookSearchSchema,
  flightsIndexSearchSchema,
} from "./index.js"

describe("createFlightsAdminExtension", () => {
  it("contributes no navigation (the flights item is base-nav-owned)", () => {
    const extension = createFlightsAdminExtension()
    expect(extension.id).toBe("flights")
    expect(extension.navigation).toBeUndefined()
    expect(extension.widgets).toBeUndefined()
  })

  it("describes the search page and the wizard as flat siblings", () => {
    // The old file-based tree escaped the wizard out of the /flights section
    // chrome (`flights_.book.$offerId`); the code-assembled tree reproduces
    // that by mounting both contributions flat under the workspace layout.
    const extension = createFlightsAdminExtension()
    const routes = extension.routes ?? []
    expect(routes.map((route) => route.id)).toEqual(["flights-index", "flights-book"])
    expect(routes.map((route) => route.path)).toEqual(["/flights", "/flights/book/$offerId"])
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

  it("carries the full route implementation on both contributions", () => {
    // Packaged-admin RFC §4.8 endgame: lazy `page` module loaders + typed
    // search contracts; no loaders because both pages fetch client-side.
    const extension = createFlightsAdminExtension()
    for (const route of extension.routes ?? []) {
      expect(typeof route.page, route.id).toBe("function")
      expect(typeof route.validateSearch, route.id).toBe("function")
      expect(route.loader, route.id).toBeUndefined()
      expect(route.component, route.id).toBeUndefined()
    }
  })

  it("resolves each lazy page to a route page module", async () => {
    const extension = createFlightsAdminExtension()
    for (const route of extension.routes ?? []) {
      const module = await route.page?.()
      expect(typeof module?.default, route.id).toBe("function")
    }
  })

  it("binds only the search page to a route-backed destination", () => {
    // `flightBooking.start` constructs search params, which is beyond pure
    // path interpolation — its resolver stays hand-written in the host map.
    const extension = createFlightsAdminExtension()
    const index = extension.routes?.find((route) => route.id === "flights-index")
    expect(index?.destination).toBe("flight.search")
    const book = extension.routes?.find((route) => route.id === "flights-book")
    expect(book?.destination).toBeUndefined()
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
  })
})
