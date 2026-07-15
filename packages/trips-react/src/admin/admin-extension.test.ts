import { describe, expect, it } from "vitest"

import { createSelectedTripsAdminExtension } from "./index.js"

describe("createSelectedTripsAdminExtension", () => {
  it("falls back to stable English selected navigation copy", () => {
    const extension = createSelectedTripsAdminExtension({ navMessages: {} })
    expect(extension.navigation?.[0]?.items[0]).toMatchObject({
      title: "Trips",
      items: [{ title: "All trips" }, { title: "New trip" }],
    })
    expect(extension.routes?.map((route) => route.title)).toEqual(["Trips", "Trips"])
  })

  it("uses selected navigation copy when supplied", () => {
    const extension = createSelectedTripsAdminExtension({
      navMessages: { trips: "Calatorii", allTrips: "Toate", newTrip: "Noua" },
    })
    expect(extension.navigation?.[0]?.items[0]).toMatchObject({
      title: "Calatorii",
      items: [{ title: "Toate" }, { title: "Noua" }],
    })
  })
})
