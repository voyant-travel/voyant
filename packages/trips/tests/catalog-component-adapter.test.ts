import { describe, expect, it } from "vitest"
import { isCatalogBackedTripComponent, toBookingDraftV1 } from "../src/catalog-component-adapter.js"
import type { TripComponent } from "../src/schema.js"
import { TripsInvariantError } from "../src/service.js"

function component(overrides: Partial<TripComponent> = {}): TripComponent {
  return {
    id: "trcp_123",
    envelopeId: "trip_123",
    sequence: 0,
    kind: "catalog_booking",
    status: "draft",
    title: null,
    description: null,
    entityModule: "products",
    entityId: "prod_123",
    sourceKind: "owned",
    sourceConnectionId: null,
    sourceRef: null,
    bookingDraftId: null,
    catalogQuoteId: null,
    bookingId: null,
    bookingGroupId: null,
    orderId: null,
    paymentSessionId: null,
    providerRef: null,
    supplierRef: null,
    componentCurrency: null,
    componentSubtotalAmountCents: null,
    componentTaxAmountCents: null,
    componentTotalAmountCents: null,
    pricingSnapshot: null,
    taxLines: [],
    cancellationSnapshot: null,
    holdToken: null,
    holdExpiresAt: null,
    priceExpiresAt: null,
    warningCodes: [],
    metadata: {},
    createdAt: new Date("2026-05-18T00:00:00.000Z"),
    updatedAt: new Date("2026-05-18T00:00:00.000Z"),
    ...overrides,
  }
}

describe("catalog component adapter", () => {
  it("maps a catalog-backed component into a booking draft", () => {
    const draft = toBookingDraftV1(component(), {
      configure: { pax: { adult: 2 } },
      payment: { intent: "hold" },
    })

    expect(draft.entity).toEqual({
      module: "products",
      id: "prod_123",
      sourceKind: "owned",
    })
    expect(draft.configure.pax).toEqual({ adult: 2 })
    expect(draft.addons).toEqual([])
  })

  it("passes through sourced refs when present", () => {
    const draft = toBookingDraftV1(
      component({
        sourceKind: "sourced",
        sourceConnectionId: "conn_123",
        sourceRef: "upstream/product/42",
      }),
    )

    expect(draft.entity.sourceConnectionId).toBe("conn_123")
    expect(draft.entity.sourceRef).toBe("upstream/product/42")
  })

  it("detects catalog-backed components", () => {
    expect(isCatalogBackedTripComponent(component())).toBe(true)
    expect(isCatalogBackedTripComponent(component({ kind: "manual_placeholder" }))).toBe(false)
    expect(isCatalogBackedTripComponent(component({ entityId: null }))).toBe(false)
  })

  it("rejects placeholders and incomplete refs", () => {
    expect(() => toBookingDraftV1(component({ kind: "manual_placeholder" }))).toThrowError(
      TripsInvariantError,
    )
    expect(() => toBookingDraftV1(component({ sourceKind: null }))).toThrowError(
      /catalog entity refs/,
    )
  })
})
