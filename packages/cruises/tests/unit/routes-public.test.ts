import { mountTestApp } from "@voyant-travel/voyant-test-utils/http"
import { afterEach, describe, expect, it, vi } from "vitest"

const presentationMocks = vi.hoisted(() => ({
  findExistingExternalCruiseShipSubject: vi.fn(async () => null),
  readPublicCruiseShipProjection: vi.fn(async () => null),
}))

vi.mock("../../src/service-presentation-subjects.js", () => presentationMocks)

import type { ExternalCruise, ExternalSailing, ExternalShip } from "../../src/adapters/index.js"
import { MockCruiseAdapter } from "../../src/adapters/mock.js"
import { clearCruiseAdapters, registerCruiseAdapter } from "../../src/adapters/registry.js"
import { makeExternalSourceKey } from "../../src/lib/key.js"
import { cruisePublicRoutes } from "../../src/routes-public.js"

afterEach(() => {
  clearCruiseAdapters()
  vi.clearAllMocks()
  presentationMocks.findExistingExternalCruiseShipSubject.mockResolvedValue(null)
  presentationMocks.readPublicCruiseShipProjection.mockResolvedValue(null)
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
    const shipBody = (await shipRes.json()) as { data: { name: string; sourceRef?: unknown } }
    expect(shipBody.data.name).toBe("MV Public")
    expect(shipBody.data.sourceRef).toBeUndefined()
    expect(presentationMocks.findExistingExternalCruiseShipSubject).toHaveBeenCalledTimes(1)
  })

  it("serves canonical external ship overlays for the requested public scope without writing", async () => {
    const adapter = new MockCruiseAdapter({ name: "voyant-connect" })
    adapter.addShip(seedShip)
    registerCruiseAdapter(adapter)
    presentationMocks.findExistingExternalCruiseShipSubject.mockResolvedValueOnce({
      entity_id: "crsh_durable",
    } as never)
    presentationMocks.readPublicCruiseShipProjection.mockResolvedValueOnce({
      content: { name: "Nava Publica" },
    } as never)
    const app = mountTestApp(cruisePublicRoutes, { db: undefined })

    const shipKey = makeExternalSourceKey("voyant-connect", shipRef)
    const response = await app.request(
      `/ships/${shipKey}?locale=ro-RO&audience=partner&market=RO`,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ data: { name: "Nava Publica" } })
    expect(presentationMocks.readPublicCruiseShipProjection).toHaveBeenCalledWith(
      undefined,
      "crsh_durable",
      { locale: "ro-RO", audience: "partner", market: "RO" },
    )
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
