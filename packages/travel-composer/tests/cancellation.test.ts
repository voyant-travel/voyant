import type { AnyDrizzleDb } from "@voyantjs/db"
import { describe, expect, it } from "vitest"

import type { NewTripComponentEvent, TripComponent, TripEnvelope } from "../src/schema.js"
import { tripComponentEvents, tripComponents, tripEnvelopes } from "../src/schema.js"
import { travelComposerService } from "../src/service.js"

function component(overrides: Partial<TripComponent> = {}): TripComponent {
  return {
    id: "trcp_123",
    envelopeId: "trip_123",
    sequence: 0,
    kind: "catalog_booking",
    status: "booked",
    title: null,
    description: null,
    entityModule: "products",
    entityId: "prod_123",
    sourceKind: "owned",
    sourceConnectionId: null,
    sourceRef: null,
    bookingDraftId: null,
    catalogQuoteId: "quote_123",
    bookingId: "book_123",
    bookingGroupId: null,
    orderId: null,
    paymentSessionId: null,
    providerRef: null,
    supplierRef: null,
    componentCurrency: "EUR",
    componentSubtotalAmountCents: 10000,
    componentTaxAmountCents: 900,
    componentTotalAmountCents: 10900,
    pricingSnapshot: {
      currency: "EUR",
      subtotalAmountCents: 10000,
      taxAmountCents: 900,
      totalAmountCents: 10900,
    },
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

function envelope(overrides: Partial<TripEnvelope> = {}): TripEnvelope {
  return {
    id: "trip_123",
    status: "booked",
    title: null,
    description: null,
    travelerParty: {},
    constraints: {},
    aggregateCurrency: "EUR",
    aggregateSubtotalAmountCents: 30000,
    aggregateTaxAmountCents: 2700,
    aggregateTotalAmountCents: 32700,
    aggregatePricingSnapshot: null,
    currentPriceExpiresAt: null,
    bookingGroupId: null,
    orderId: null,
    paymentSessionId: null,
    reserveIdempotencyKey: null,
    reserveStartedAt: null,
    reservedAt: null,
    checkoutIdempotencyKey: null,
    checkoutStartedAt: null,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date("2026-05-18T00:00:00.000Z"),
    updatedAt: new Date("2026-05-18T00:00:00.000Z"),
    ...overrides,
  }
}

function makeFakeDb(state: {
  envelope: TripEnvelope
  components: TripComponent[]
  events?: NewTripComponentEvent[]
}): AnyDrizzleDb {
  const events = state.events ?? []

  function applyUpdate(table: unknown, patch: Partial<TripEnvelope & TripComponent>) {
    if (table === tripEnvelopes) {
      Object.assign(state.envelope, patch)
      return state.envelope
    }

    if (table !== tripComponents) return undefined
    const componentToUpdate =
      patch.status === "cancelled"
        ? state.components.find((item) => item.status !== "cancelled" && item.status !== "removed")
        : state.components[0]
    if (!componentToUpdate) return undefined
    Object.assign(componentToUpdate, patch)
    return componentToUpdate
  }

  return {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => (table === tripEnvelopes ? [state.envelope] : []),
          orderBy: async () =>
            table === tripComponents
              ? [...state.components].sort((a, b) => a.sequence - b.sequence)
              : [],
        }),
      }),
    }),
    update: (table: unknown) => ({
      set: (patch: Partial<TripEnvelope & TripComponent>) => ({
        where: () => {
          const updated = applyUpdate(table, patch)
          return {
            returning: async () => (updated ? [updated] : []),
          }
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (value: NewTripComponentEvent) => {
        if (table === tripComponentEvents) events.push(value)
        return {
          returning: async () => [],
        }
      },
    }),
  } as AnyDrizzleDb
}

describe("travel composer cancellation", () => {
  it("cancels selected stay and flight placeholders while leaving product intact", async () => {
    const state = {
      envelope: envelope(),
      components: [
        component({
          id: "stay",
          sequence: 0,
          title: "Bucharest stay",
          kind: "manual_placeholder",
          status: "booked",
          entityModule: null,
          entityId: null,
          sourceKind: null,
          bookingId: null,
        }),
        component({
          id: "flight",
          sequence: 1,
          title: "Flight to London",
          kind: "flight_placeholder",
          status: "booked",
          entityModule: null,
          entityId: null,
          sourceKind: null,
          bookingId: null,
        }),
        component({ id: "product", sequence: 2, title: "Tour product" }),
      ],
      events: [],
    }

    const result = await travelComposerService.cancelComponents(makeFakeDb(state), {
      envelopeId: "trip_123",
      componentIds: ["stay", "flight"],
      reason: "Traveler changed plans",
    })

    expect(result.cancelled).toEqual([
      { componentId: "stay", status: "cancelled" },
      { componentId: "flight", status: "cancelled" },
    ])
    expect(result.remediation).toEqual([])
    expect(state.components.map((item) => [item.id, item.status])).toEqual([
      ["stay", "cancelled"],
      ["flight", "cancelled"],
      ["product", "booked"],
    ])
    expect(result.envelope.status).toBe("booked")
  })

  it("marks committed components for staff remediation when cancellation is not wired", async () => {
    const state = {
      envelope: envelope(),
      components: [component({ id: "stay", title: "Hotel stay" })],
      events: [],
    }

    const result = await travelComposerService.cancelComponents(makeFakeDb(state), {
      envelopeId: "trip_123",
      componentIds: ["stay"],
    })

    expect(result.cancelled).toEqual([])
    expect(result.remediation).toEqual([
      { componentId: "stay", reason: "cancel_preview_not_configured" },
    ])
    expect(state.components[0]?.status).toBe("booked")
    expect(state.components[0]?.warningCodes).toEqual([
      "staff_remediation_required",
      "cancel_preview_not_configured",
    ])
  })
})
