import { describe, expect, it } from "vitest"
import type { TripComponent } from "../src/schema.js"
import {
  assertTripComponentCanBeUpdated,
  assertTripComponentCanReceiveRefs,
  hasCommittedComponentReference,
  TravelComposerInvariantError,
} from "../src/service.js"
import {
  createTripComponentSchema,
  createTripEnvelopeSchema,
  isAllowedTripComponentStatusTransition,
  tripComponentStatusTransitionSchema,
} from "../src/validation.js"

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

describe("travel composer contracts", () => {
  it("defaults mutable envelope payloads to empty objects", () => {
    expect(createTripEnvelopeSchema.parse({ title: "Bucharest extension" })).toMatchObject({
      title: "Bucharest extension",
      travelerParty: {},
      constraints: {},
    })
  })

  it("accepts catalog-backed component references without cross-package FKs", () => {
    expect(
      createTripComponentSchema.parse({
        envelopeId: "trip_abc",
        kind: "catalog_booking",
        catalogRef: {
          entityModule: "products",
          entityId: "prod_123",
          sourceKind: "owned",
        },
      }),
    ).toMatchObject({
      envelopeId: "trip_abc",
      kind: "catalog_booking",
      sequence: 0,
      metadata: {},
      catalogRef: {
        entityModule: "products",
        entityId: "prod_123",
        sourceKind: "owned",
      },
    })
  })

  it("allows expected component status transitions", () => {
    expect(isAllowedTripComponentStatusTransition("draft", "priced")).toBe(true)
    expect(isAllowedTripComponentStatusTransition("priced", "held")).toBe(true)
    expect(isAllowedTripComponentStatusTransition("priced", "booked")).toBe(true)
    expect(isAllowedTripComponentStatusTransition("held", "booked")).toBe(true)
    expect(isAllowedTripComponentStatusTransition("booked", "checkout_started")).toBe(true)
    expect(isAllowedTripComponentStatusTransition("priced", "priced")).toBe(true)
  })

  it("rejects terminal or backwards component status transitions", () => {
    expect(isAllowedTripComponentStatusTransition("cancelled", "priced")).toBe(false)
    expect(isAllowedTripComponentStatusTransition("removed", "draft")).toBe(false)
    expect(isAllowedTripComponentStatusTransition("booked", "held")).toBe(false)

    expect(() =>
      tripComponentStatusTransitionSchema.parse({ from: "cancelled", to: "priced" }),
    ).toThrowError(/Invalid trip component status transition/)
  })

  it("guards removed components from service updates", () => {
    expect(() =>
      assertTripComponentCanBeUpdated(component({ status: "removed" }), {
        description: "Updated note",
      }),
    ).toThrowError(TravelComposerInvariantError)
  })

  it("guards committed components from silent catalog identity changes", () => {
    const committed = component({ bookingId: "book_123" })
    expect(hasCommittedComponentReference(committed)).toBe(true)

    expect(() =>
      assertTripComponentCanBeUpdated(committed, {
        catalogRef: {
          entityModule: "accommodations",
          entityId: "prop_123",
          sourceKind: "owned",
        },
      }),
    ).toThrowError(/committed references/)
  })

  it("guards committed components from receiving a second committed reference", () => {
    expect(() =>
      assertTripComponentCanReceiveRefs(component({ orderId: "ord_123" }), {
        committedRef: { bookingId: "book_123" },
      }),
    ).toThrowError(/already has committed references/)
  })
})
