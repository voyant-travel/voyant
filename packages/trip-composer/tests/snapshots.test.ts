import type { AnyDrizzleDb } from "@voyantjs/db"
import { describe, expect, it } from "vitest"

import type { NewTripSnapshot, TripComponent, TripEnvelope, TripSnapshot } from "../src/schema.js"
import { tripComponents, tripEnvelopes, tripSnapshots } from "../src/schema.js"
import { TripComposerInvariantError, tripComposerService } from "../src/service.js"

const completeTravelerParty = {
  billing: {
    personId: "person_billing",
    contact: {
      firstName: "Diego",
      lastName: "Muller",
      email: "diego@example.com",
    },
  },
  travelers: [
    {
      personId: "person_traveler",
      firstName: "Diego",
      lastName: "Muller",
      email: "diego@example.com",
    },
  ],
}

function envelope(overrides: Partial<TripEnvelope> = {}): TripEnvelope {
  return {
    id: "trip_123",
    status: "priced",
    title: "Danube weekend",
    description: "Two-night itinerary",
    travelerParty: completeTravelerParty,
    constraints: { pace: "relaxed" },
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
    createdBy: "agent_1",
    updatedBy: "agent_1",
    createdAt: new Date("2026-05-18T00:00:00.000Z"),
    updatedAt: new Date("2026-05-18T09:00:00.000Z"),
    ...overrides,
  }
}

function component(overrides: Partial<TripComponent> = {}): TripComponent {
  return {
    id: "trcp_123",
    envelopeId: "trip_123",
    sequence: 0,
    kind: "manual_placeholder",
    status: "priced",
    title: null,
    description: "Airport transfer",
    entityModule: null,
    entityId: null,
    sourceKind: null,
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
    warningCodes: ["manual_placeholder_price"],
    metadata: { manualService: { name: "Airport transfer" }, template: "manual" },
    createdAt: new Date("2026-05-18T00:00:00.000Z"),
    updatedAt: new Date("2026-05-18T09:00:00.000Z"),
    ...overrides,
  }
}

function makeFakeDb(state: {
  envelope: TripEnvelope | null
  components: TripComponent[]
  snapshots?: TripSnapshot[]
}): AnyDrizzleDb {
  const snapshots = state.snapshots ?? []

  return {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => {
            if (table === tripEnvelopes) return state.envelope ? [state.envelope] : []
            if (table === tripSnapshots) return snapshots.slice(0, 1)
            return []
          },
          orderBy: async () => {
            if (table === tripComponents) {
              return [...state.components].sort((a, b) => a.sequence - b.sequence)
            }
            if (table === tripSnapshots) return snapshots
            return []
          },
        }),
      }),
    }),
    insert: (table: unknown) => ({
      values: (value: NewTripSnapshot) => ({
        returning: async () => {
          if (table !== tripSnapshots) return []
          const snapshot = {
            id: `trsn_${snapshots.length + 1}`,
            createdAt: new Date("2026-05-18T10:00:00.000Z"),
            ...value,
          } as TripSnapshot
          snapshots.push(snapshot)
          return [snapshot]
        },
      }),
    }),
  } as AnyDrizzleDb
}

describe("trip composer trip snapshots", () => {
  it("freezes active priced components into a proposal read model", async () => {
    const active = component()
    const removed = component({
      id: "trcp_removed",
      sequence: 1,
      status: "removed",
      description: "Removed line",
    })
    const db = makeFakeDb({ envelope: envelope(), components: [active, removed] })

    const snapshot = await tripComposerService.freezeTripSnapshot(db, {
      envelopeId: "trip_123",
      createdBy: "agent_1",
    })

    expect(snapshot.envelopeId).toBe("trip_123")
    expect(snapshot.componentCount).toBe(1)
    expect(snapshot.totalAmountCents).toBe(10900)
    expect(snapshot.proposal.lines).toEqual([
      expect.objectContaining({
        componentId: "trcp_123",
        description: "Airport transfer",
        totalAmountCents: 10900,
        warnings: ["manual_placeholder_price"],
      }),
    ])

    active.description = "Edited after snapshot"
    expect((snapshot.frozenComponents[0] as { description?: string }).description).toBe(
      "Airport transfer",
    )
  })

  it("rejects snapshots when active components have no pricing snapshot", async () => {
    const db = makeFakeDb({
      envelope: envelope(),
      components: [component({ pricingSnapshot: null })],
    })

    await expect(
      tripComposerService.freezeTripSnapshot(db, { envelopeId: "trip_123" }),
    ).rejects.toThrowError(TripComposerInvariantError)
  })
})
