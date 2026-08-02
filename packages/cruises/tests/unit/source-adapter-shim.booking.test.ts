import { describe, expect, it } from "vitest"
import { MockCruiseAdapter } from "../../src/adapters/mock.js"
import { cruiseAdapterToSourceAdapter } from "../../src/adapters/source-adapter-shim.js"
import { encodeSourceRef } from "../../src/lib/key.js"

describe("cruise SourceAdapter booking tracer", () => {
  it("quotes and reserves a sailing with replay-safe supplier idempotency", async () => {
    const cruiseRef = { externalId: "cruise-1" }
    const shipRef = { externalId: "ship-1" }
    const sailingRef = { externalId: "sailing-1" }
    const cabinCategoryRef = { externalId: "balcony" }
    const cruise = new MockCruiseAdapter({ name: "tracer" })
    cruise.addCruise(
      {
        sourceRef: cruiseRef,
        name: "Northern Lights",
        slug: "northern-lights",
        cruiseType: "ocean",
        lineName: "Example Line",
        defaultShipRef: shipRef,
        nights: 7,
      },
      [
        {
          sourceRef: sailingRef,
          cruiseRef,
          shipRef,
          departureDate: "2027-02-01",
          returnDate: "2027-02-08",
          salesStatus: "open",
        },
      ],
    )
    cruise.setSailingPricing(sailingRef, [
      {
        cabinCategoryRef,
        occupancy: 2,
        fareCode: "FLEX",
        currency: "EUR",
        pricePerPerson: "1250.00",
        availability: "available",
      },
    ])
    const adapter = cruiseAdapterToSourceAdapter(cruise)
    const entityId = `crus_${encodeSourceRef(cruiseRef)}`
    const parameters = {
      sailingId: encodeSourceRef(sailingRef),
      cabinCategoryId: encodeSourceRef(cabinCategoryRef),
      occupancy: 2,
      fareCode: "FLEX",
    }

    await expect(
      adapter.liveResolve?.(
        { connection_id: "conn_cruise" },
        {
          ids: [entityId],
          source_refs: { [entityId]: encodeSourceRef(cruiseRef) },
          scope: { locale: "en", audience: "customer", market: "default" },
          parameters,
        },
      ),
    ).resolves.toMatchObject({
      values: { [entityId]: { priceCents: 250000, currency: "EUR" } },
    })

    const request = {
      entity_module: "cruises",
      entity_id: entityId,
      source_ref: encodeSourceRef(cruiseRef),
      parameters,
      party: {
        contact: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.test" },
        passengers: [
          { firstName: "Ada", lastName: "Lovelace", travelerCategory: "adult" },
          { firstName: "Charles", lastName: "Babbage", travelerCategory: "adult" },
        ],
      },
      idempotency_key: "bses_1:commit_1:reserve",
    }
    const first = await adapter.reserve?.({ connection_id: "conn_cruise" }, request)
    const replay = await adapter.reserve?.({ connection_id: "conn_cruise" }, request)

    expect(first).toMatchObject({ status: "confirmed" })
    expect(replay?.upstream_ref).toBe(first?.upstream_ref)
    expect(cruise.bookingCount).toBe(1)
    await expect(
      adapter.getReservation?.(
        { connection_id: "conn_cruise" },
        { upstream_ref: first?.upstream_ref ?? "missing" },
      ),
    ).resolves.toMatchObject({ status: "confirmed" })
    await expect(
      adapter.getReservation?.(
        { connection_id: "conn_cruise" },
        { idempotency_key: request.idempotency_key },
      ),
    ).resolves.toMatchObject({ upstream_ref: first?.upstream_ref, status: "confirmed" })
  })
})
