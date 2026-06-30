import type { AnyDrizzleDb } from "@voyant-travel/db"
import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import { createTripsRoutes } from "../src/routes.js"
import type { NewTripComponentEvent, TripComponent, TripEnvelope } from "../src/schema.js"
import { tripComponentEvents, tripComponents, tripEnvelopes } from "../src/schema.js"
import { TripsInvariantError, tripsService } from "../src/service.js"

const originalTravelerParty = {
  billing: {
    personId: "person_billing",
    contact: {
      firstName: "Alex",
      lastName: "B2C",
      email: "alex@example.com",
      phone: "+40700000001",
    },
  },
  travelers: [
    {
      personId: "person_alex",
      firstName: "Alex",
      lastName: "B2C",
      email: "alex@example.com",
      role: "adult",
    },
  ],
}

const updatedTravelerParty = {
  billing: {
    personId: "person_billing",
    contact: {
      firstName: "Alexandra",
      lastName: "B2C Updated",
      email: "alexandra@example.com",
      phone: "+40700000002",
    },
  },
  travelers: [
    {
      personId: "person_alex",
      firstName: "Alexandra",
      lastName: "B2C Updated",
      email: "alexandra@example.com",
      role: "adult",
    },
    {
      personId: "person_child",
      firstName: "Child",
      lastName: "B2C",
      role: "child",
      dateOfBirth: "2016-01-01",
    },
  ],
}

function envelope(overrides: Partial<TripEnvelope> = {}): TripEnvelope {
  return {
    id: "trip_123",
    status: "booked",
    title: "Supplier-backed trip",
    description: null,
    travelerParty: originalTravelerParty,
    constraints: {},
    aggregateCurrency: "EUR",
    aggregateSubtotalAmountCents: 10000,
    aggregateTaxAmountCents: 900,
    aggregateTotalAmountCents: 10900,
    aggregatePricingSnapshot: null,
    currentPriceExpiresAt: null,
    bookingGroupId: "bkgrp_123",
    orderId: "demo_order_1",
    paymentSessionId: "pmss_123",
    reserveIdempotencyKey: null,
    reserveStartedAt: null,
    reservedAt: new Date("2026-06-30T10:00:00.000Z"),
    checkoutIdempotencyKey: null,
    checkoutStartedAt: new Date("2026-06-30T10:05:00.000Z"),
    createdBy: "staff_1",
    updatedBy: "staff_1",
    createdAt: new Date("2026-06-30T09:00:00.000Z"),
    updatedAt: new Date("2026-06-30T10:10:00.000Z"),
    ...overrides,
  }
}

function component(overrides: Partial<TripComponent> = {}): TripComponent {
  return {
    id: "trcp_supplier",
    envelopeId: "trip_123",
    sequence: 0,
    kind: "flight_placeholder",
    status: "booked",
    title: "Flight",
    description: "Original supplier-backed flight",
    entityModule: null,
    entityId: null,
    sourceKind: "flights-demo",
    sourceConnectionId: "flight_demo",
    sourceRef: "offer_1",
    bookingDraftId: null,
    catalogQuoteId: null,
    bookingId: null,
    bookingGroupId: "bkgrp_123",
    orderId: "demo_order_1",
    paymentSessionId: "pmss_123",
    providerRef: "PNR123",
    supplierRef: "demo_order_1",
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
    metadata: { flightDraft: { offerId: "offer_1" } },
    createdAt: new Date("2026-06-30T09:00:00.000Z"),
    updatedAt: new Date("2026-06-30T10:10:00.000Z"),
    ...overrides,
  }
}

function makeFakeDb(state: {
  envelope: TripEnvelope
  components: TripComponent[]
  events?: NewTripComponentEvent[]
}): AnyDrizzleDb {
  const events = state.events ?? []

  function selectRows(table: unknown) {
    if (table === tripEnvelopes) return [state.envelope]
    if (table === tripComponents) return [...state.components]
    return []
  }

  function updateRow(table: unknown, patch: Partial<TripEnvelope & TripComponent>) {
    if (table === tripEnvelopes) {
      Object.assign(state.envelope, patch)
      return state.envelope
    }

    if (table !== tripComponents) return undefined
    const target = state.components[0]
    if (!target) return undefined
    Object.assign(target, patch)
    return target
  }

  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => selectRows(table).slice(0, 1),
          orderBy: async () => selectRows(table),
        }),
      }),
    }),
    update: (table: unknown) => ({
      set: (patch: Partial<TripEnvelope & TripComponent>) => ({
        where: () => ({
          returning: async () => {
            const updated = updateRow(table, patch)
            return updated ? [updated] : []
          },
        }),
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
  }

  return db as AnyDrizzleDb
}

function createTestTripsApp(db: AnyDrizzleDb) {
  const app = new Hono()
  app.use("*", async (c, next) => {
    c.set("db" as never, db as never)
    await next()
  })
  app.route("/", createTripsRoutes())
  return app
}

describe("trips service edit safeguards", () => {
  it("blocks traveler and billing edits on booked trips with supplier-backed components", async () => {
    const state = {
      envelope: envelope(),
      components: [component()],
    }
    const db = makeFakeDb(state)

    await expect(
      tripsService.updateTrip(db, "trip_123", { travelerParty: updatedTravelerParty }),
    ).rejects.toThrow(TripsInvariantError)

    expect(state.envelope.travelerParty).toEqual(originalTravelerParty)
  })

  it("still accepts internal trip title edits after supplier commitment", async () => {
    const state = {
      envelope: envelope(),
      components: [component()],
    }
    const db = makeFakeDb(state)

    const updated = await tripsService.updateTrip(db, "trip_123", {
      title: "Internal support title",
    })

    expect(updated?.title).toBe("Internal support title")
    expect(state.envelope.travelerParty).toEqual(originalTravelerParty)
  })

  it("blocks component description and metadata edits after supplier commitment", async () => {
    const state = {
      envelope: envelope(),
      components: [component()],
    }
    const db = makeFakeDb(state)

    await expect(
      tripsService.updateComponent(db, "trcp_supplier", {
        description: "Passenger name changed in admin",
      }),
    ).rejects.toThrow(/structured amendment/)

    await expect(
      tripsService.updateComponent(db, "trcp_supplier", {
        metadata: { flightDraft: { offerId: "offer_2" } },
      }),
    ).rejects.toThrow(/structured amendment/)

    expect(state.components[0]?.description).toBe("Original supplier-backed flight")
    expect(state.components[0]?.metadata).toEqual({ flightDraft: { offerId: "offer_1" } })
  })

  it("keeps booked manual components editable because no supplier commitment exists", async () => {
    const state = {
      envelope: envelope(),
      components: [
        component({
          id: "trcp_manual",
          kind: "manual_placeholder",
          sourceKind: null,
          sourceConnectionId: null,
          sourceRef: null,
          orderId: null,
          providerRef: null,
          supplierRef: null,
          description: "Original manual note",
          metadata: { manualService: { name: "VIP greeting" } },
        }),
      ],
      events: [],
    }
    const db = makeFakeDb(state)

    const updated = await tripsService.updateComponent(db, "trcp_manual", {
      description: "Updated manual note",
    })

    expect(updated?.description).toBe("Updated manual note")
    expect(state.events).toHaveLength(1)
  })

  it("returns 409 from the PATCH route for booked supplier-backed component edits", async () => {
    const app = createTestTripsApp(
      makeFakeDb({
        envelope: envelope(),
        components: [component()],
      }),
    )

    const res = await app.request("/components/trcp_supplier", {
      method: "PATCH",
      body: JSON.stringify({ description: "Rename after ticketing" }),
      headers: { "content-type": "application/json" },
    })

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toEqual({
      error:
        "Trip component trcp_supplier is committed to a supplier and requires a structured amendment before commitment data can change",
    })
  })
})
