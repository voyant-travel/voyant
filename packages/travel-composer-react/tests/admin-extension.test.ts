import { describe, expect, it } from "vitest"

import { createTravelComposerAdminExtension } from "../src/admin/index.js"

describe("createTravelComposerAdminExtension", () => {
  it("contributes the Trips nav group spliced after Bookings", () => {
    const extension = createTravelComposerAdminExtension()
    expect(extension.id).toBe("travel-composer")
    const contribution = extension.navigation?.[0]
    expect(contribution?.insertAfter).toBe("bookings")
    const group = contribution?.items[0]
    expect(group?.id).toBe("travel-composer")
    expect(group?.url).toBe("/trips")
    expect(group?.items?.map((item) => item.url)).toEqual(["/trips", "/trips/new"])
  })

  it("describes the list and detail routes with unique ids and paths", () => {
    const extension = createTravelComposerAdminExtension()
    const routes = extension.routes ?? []
    expect(routes).toHaveLength(2)
    expect(new Set(routes.map((route) => route.id)).size).toBe(2)
    expect(routes.map((route) => route.path)).toEqual(["/trips", "/trips/$id"])
  })

  it("honors basePath and labels across nav and routes", () => {
    const extension = createTravelComposerAdminExtension({
      basePath: "/journeys",
      labels: { trips: "Calatorii", allTrips: "Toate", newTrip: "Noua" },
    })
    const group = extension.navigation?.[0]?.items[0]
    expect(group?.title).toBe("Calatorii")
    expect(group?.url).toBe("/journeys")
    expect(group?.items?.map((item) => item.title)).toEqual(["Toate", "Noua"])
    expect(extension.routes?.map((route) => route.path)).toEqual(["/journeys", "/journeys/$id"])
    expect(extension.routes?.every((route) => route.title === "Calatorii")).toBe(true)
  })

  it("carries no search contracts (the list keeps its filters local)", () => {
    const extension = createTravelComposerAdminExtension()
    for (const route of extension.routes ?? []) {
      expect(route.validateSearch).toBeUndefined()
    }
  })

  it("carries lazy page loaders instead of eager components", async () => {
    // The full route implementation lives on the contribution (RFC §4.8):
    // `page` resolves the page module lazily so it stays code-split; no
    // eager `component` reference pins it into the workspace-chrome chunk.
    const extension = createTravelComposerAdminExtension()
    for (const route of extension.routes ?? []) {
      expect(route.component).toBeUndefined()
      expect(typeof route.page).toBe("function")
      const module = await route.page?.()
      expect(typeof module?.default).toBe("function")
    }
  })

  it("attaches data loaders and marks both routes data-only for SSR", () => {
    const extension = createTravelComposerAdminExtension()
    expect(extension.routes).toHaveLength(2)
    for (const route of extension.routes ?? []) {
      expect(typeof route.loader).toBe("function")
      expect(route.ssr).toBe("data-only")
    }
  })

  it("annotates the route-backed destinations", () => {
    const extension = createTravelComposerAdminExtension()
    const byId = new Map(extension.routes?.map((route) => [route.id, route]))
    expect(byId.get("travel-composer-index")?.destination).toBe("trip.list")
    expect(byId.get("travel-composer-detail")?.destination).toBe("trip.detail")
    expect(byId.get("travel-composer-detail")?.destinationParams).toEqual({ id: "tripId" })
  })
})
