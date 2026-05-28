import { describe, expect, it } from "vitest"

import {
  mapConnectCabinRoomType,
  mapConnectCruiseType,
  mapConnectEnrichmentKind,
  mapConnectInclusionKind,
  mapConnectPriceComponentKind,
} from "../../src/adapters/index.js"

describe("Connect cruise compatibility mapping", () => {
  it("maps supported cruise types and rejects categories that belong elsewhere", () => {
    expect(mapConnectCruiseType("river")).toEqual({ status: "mapped", value: "river" })
    expect(mapConnectCruiseType("yacht")).toEqual({
      status: "reject",
      reason: "Yacht-style per-suite products do not fit the cruises occupancy grid.",
      rerouteTo: "products",
    })
    expect(mapConnectCruiseType("rail")).toEqual({
      status: "reject",
      reason: "rail is not a cruise vertical product type.",
      rerouteTo: "products",
    })
  })

  it("maps Connect cabin room types onto framework cabin categories", () => {
    expect(mapConnectCabinRoomType("studio")).toEqual({ status: "mapped", value: "single" })
    expect(mapConnectCabinRoomType("villa")).toEqual({ status: "mapped", value: "suite" })
    expect(mapConnectCabinRoomType("balcony")).toEqual({ status: "mapped", value: "balcony" })
  })

  it("maps inclusions and pricing component vocabulary", () => {
    expect(mapConnectInclusionKind("flight")).toEqual({ status: "mapped", value: "airfare" })
    expect(mapConnectPriceComponentKind("non_commissionable_fare")).toEqual({
      status: "mapped",
      value: "ncf",
    })
    expect(mapConnectPriceComponentKind("single_supplement")).toEqual({
      status: "mapped",
      value: "single_supplement",
    })
  })

  it("maps domain experts to the framework expert enrichment kind", () => {
    expect(mapConnectEnrichmentKind("domain_expert")).toEqual({
      status: "mapped",
      value: "expert",
    })
  })
})
