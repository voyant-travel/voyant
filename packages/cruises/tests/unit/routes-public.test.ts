import { mountTestApp } from "@voyant-travel/voyant-test-utils/http"
import { afterEach, describe, expect, it } from "vitest"

import type { ExternalCruise, ExternalSailing, ExternalShip } from "../../src/adapters/index.js"
import { MockCruiseAdapter } from "../../src/adapters/mock.js"
import { clearCruiseAdapters, registerCruiseAdapter } from "../../src/adapters/registry.js"
import { makeExternalSourceKey } from "../../src/lib/key.js"
import { cruisePublicRoutes } from "../../src/routes-public.js"

afterEach(() => {
  clearCruiseAdapters()
})

const cruiseRef = {
  externalId: "same-id",
  connectionId: "conn-public",
  provider: "line-a",
}

const sailingRef = {
  externalId: "sailing-1",
  connectionId: "conn-public",
  provider: "line-a",
}

const shipRef = {
  externalId: "ship-1",
  connectionId: "conn-public",
  provider: "line-a",
}

const seedCruise: ExternalCruise = {
  sourceRef: cruiseRef,
  name: "Public Fjords",
  slug: "public-fjords",
  cruiseType: "ocean",
  lineName: "Acme Cruises",
  defaultShipRef: shipRef,
  nights: 7,
}

const seedSailing: ExternalSailing = {
  sourceRef: sailingRef,
  cruiseRef,
  shipRef,
  departureDate: "2027-06-01",
  returnDate: "2027-06-08",
  salesStatus: "open",
}

const seedShip: ExternalShip = {
  sourceRef: shipRef,
  name: "MV Public",
  slug: "mv-public",
  shipType: "ocean",
}

describe("public cruise routes - external encoded keys", () => {
  it("decodes full SourceRef keys for sailing and ship routes", async () => {
    const adapter = new MockCruiseAdapter({ name: "voyant-connect" })
    adapter.addCruise(seedCruise, [seedSailing])
    adapter.addShip(seedShip)
    registerCruiseAdapter(adapter)
    const app = mountTestApp(cruisePublicRoutes, { db: undefined })

    const sailingKey = makeExternalSourceKey("voyant-connect", sailingRef)
    const sailingRes = await app.request(`/sailings/${sailingKey}`)
    expect(sailingRes.status).toBe(200)
    const sailingBody = (await sailingRes.json()) as {
      data: { sailing: { sourceRef: typeof sailingRef } }
    }
    expect(sailingBody.data.sailing.sourceRef).toEqual(sailingRef)

    const shipKey = makeExternalSourceKey("voyant-connect", shipRef)
    const shipRes = await app.request(`/ships/${shipKey}`)
    expect(shipRes.status).toBe(200)
    const shipBody = (await shipRes.json()) as { data: { sourceRef: typeof shipRef } }
    expect(shipBody.data.sourceRef).toEqual(shipRef)
  })

  it("matches public quote rows by full cabin SourceRef and passenger composition", async () => {
    const adapter = new MockCruiseAdapter({ name: "voyant-connect" })
    const cabinA = { externalId: "cat-A", connectionId: "conn-public", provider: "line-a" }
    const cabinB = { externalId: "cat-A", connectionId: "other-conn", provider: "line-a" }
    adapter.addCruise(seedCruise, [seedSailing])
    adapter.setSailingPricing(sailingRef, [
      {
        cabinCategoryRef: cabinB,
        occupancy: 2,
        passengerComposition: { adults: 2 },
        currency: "USD",
        pricePerPerson: "500.00",
        availability: "available",
      },
      {
        cabinCategoryRef: cabinA,
        occupancy: 2,
        passengerComposition: { adults: 1, children: 1, childAges: [9] },
        currency: "USD",
        pricePerPerson: "1000.00",
        availability: "available",
        bookingTerms: {
          cancellationPolicy: { summary: "Refundable before final payment." },
        },
      },
    ])
    registerCruiseAdapter(adapter)
    const app = mountTestApp(cruisePublicRoutes, { db: undefined })

    const res = await app.request(
      `/sailings/${makeExternalSourceKey("voyant-connect", sailingRef)}/quote`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cabinCategoryId: "cat-A",
          cabinCategoryRef: cabinA,
          occupancy: 2,
          passengerComposition: { adults: 1, children: 1, childAges: [9] },
        }),
      },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      data: { totalForCabin: string; bookingTerms?: { cancellationPolicy?: { summary?: string } } }
    }
    expect(body.data.totalForCabin).toBe("2000.00")
    expect(body.data.bookingTerms?.cancellationPolicy?.summary).toBe(
      "Refundable before final payment.",
    )
  })
})
