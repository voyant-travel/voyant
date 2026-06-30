import type { AnyDrizzleDb } from "@voyant-travel/db"
import { describe, expect, it } from "vitest"

import type { NewTripComponentEvent, TripComponent, TripEnvelope } from "../src/schema.js"
import { tripComponentEvents, tripComponents, tripEnvelopes } from "../src/schema.js"
import { tripsService } from "../src/service.js"

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
          limit: async () => {
            if (table === tripEnvelopes) return [state.envelope]
            if (table === tripComponents)
              return state.components[0] ? [{ ...state.components[0] }] : []
            return []
          },
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

describe("trips cancellation", () => {
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

    const result = await tripsService.cancelComponents(makeFakeDb(state), {
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
    expect(result.envelope.aggregateSubtotalAmountCents).toBe(10000)
    expect(result.envelope.aggregateTaxAmountCents).toBe(900)
    expect(result.envelope.aggregateTotalAmountCents).toBe(10900)
    expect(result.envelope.aggregatePricingSnapshot).toEqual({
      currency: "EUR",
      subtotalAmountCents: 10000,
      taxAmountCents: 900,
      totalAmountCents: 10900,
      componentCount: 1,
      pricedComponentCount: 1,
      warnings: [],
    })
  })

  it("refreshes envelope totals after removing a component", async () => {
    const state = {
      envelope: envelope(),
      components: [
        component({ id: "stay", sequence: 0, status: "draft", title: "Bucharest stay" }),
        component({
          id: "flight",
          sequence: 1,
          title: "Flight to London",
          kind: "flight_placeholder",
          entityModule: null,
          entityId: null,
          sourceKind: null,
          bookingId: null,
          componentSubtotalAmountCents: 20000,
          componentTaxAmountCents: 1800,
          componentTotalAmountCents: 21800,
          pricingSnapshot: {
            currency: "EUR",
            subtotalAmountCents: 20000,
            taxAmountCents: 1800,
            totalAmountCents: 21800,
          },
        }),
      ],
      events: [],
    }

    const removed = await tripsService.removeComponent(makeFakeDb(state), "stay")

    expect(removed?.status).toBe("removed")
    expect(state.events).toMatchObject([
      {
        componentId: "stay",
        eventType: "removed",
        fromStatus: "draft",
        toStatus: "removed",
      },
    ])
    expect(state.envelope.aggregateSubtotalAmountCents).toBe(20000)
    expect(state.envelope.aggregateTaxAmountCents).toBe(1800)
    expect(state.envelope.aggregateTotalAmountCents).toBe(21800)
    expect(state.envelope.aggregatePricingSnapshot).toEqual({
      currency: "EUR",
      subtotalAmountCents: 20000,
      taxAmountCents: 1800,
      totalAmountCents: 21800,
      componentCount: 1,
      pricedComponentCount: 1,
      warnings: [],
    })
  })

  it("marks committed components for staff remediation when cancellation is not wired", async () => {
    const state = {
      envelope: envelope(),
      components: [component({ id: "stay", title: "Hotel stay" })],
      events: [],
    }

    const result = await tripsService.cancelComponents(makeFakeDb(state), {
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

  it("does not locally cancel a connected flight component without adapter cancellation wiring", async () => {
    const state = {
      envelope: envelope(),
      components: [
        component({
          id: "flight",
          title: "Flight to London",
          kind: "flight_placeholder",
          entityModule: null,
          entityId: null,
          sourceKind: null,
          bookingId: null,
          orderId: "ord_1",
          providerRef: "VD0001",
          supplierRef: "ord_1",
        }),
      ],
      events: [],
    }

    const result = await tripsService.cancelComponents(makeFakeDb(state), {
      envelopeId: "trip_123",
      componentIds: ["flight"],
      reason: "Traveler changed plans",
    })

    expect(result.cancelled).toEqual([])
    expect(result.remediation).toEqual([
      { componentId: "flight", reason: "cancel_preview_not_configured" },
    ])
    expect(state.components[0]?.status).toBe("booked")
    expect(state.components[0]?.warningCodes).toEqual([
      "staff_remediation_required",
      "cancel_preview_not_configured",
    ])
  })
})
