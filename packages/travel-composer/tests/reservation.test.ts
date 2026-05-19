import type { AnyDrizzleDb } from "@voyantjs/db"
import { describe, expect, it } from "vitest"
import type { NewTripComponentEvent, TripComponent, TripEnvelope } from "../src/schema.js"
import { tripComponentEvents, tripComponents, tripEnvelopes } from "../src/schema.js"
import {
  assertTripComponentCanBeReserved,
  reserveResultToComponentPatch,
  shouldReplayReserve,
  TravelComposerInvariantError,
  travelComposerService,
} from "../src/service.js"
import { reserveTripSchema } from "../src/validation.js"

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

function component(overrides: Partial<TripComponent> = {}): TripComponent {
  return {
    id: "trcp_123",
    envelopeId: "trip_123",
    sequence: 0,
    kind: "catalog_booking",
    status: "priced",
    title: null,
    description: null,
    entityModule: "products",
    entityId: "prod_123",
    sourceKind: "owned",
    sourceConnectionId: null,
    sourceRef: null,
    bookingDraftId: null,
    catalogQuoteId: "quote_123",
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
    priceExpiresAt: new Date("2026-05-20T12:00:00.000Z"),
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
    status: "priced",
    title: null,
    description: null,
    travelerParty: completeTravelerParty,
    constraints: {},
    aggregateCurrency: "EUR",
    aggregateSubtotalAmountCents: 10000,
    aggregateTaxAmountCents: 900,
    aggregateTotalAmountCents: 10900,
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
      patch.status === "held" || patch.status === "booked"
        ? state.components.find((item) => item.status === "priced")
        : patch.status === "failed"
          ? state.components.find((item) => item.status === "priced")
          : patch.status === "cancelled"
            ? state.components.find((item) => item.status === "held" || item.status === "booked")
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

describe("travel composer reservation helpers", () => {
  it("accepts idempotency keys on reserve requests", () => {
    expect(
      reserveTripSchema.parse({
        envelopeId: "trip_123",
        idempotencyKey: "checkout-attempt-1",
      }),
    ).toEqual({
      envelopeId: "trip_123",
      idempotencyKey: "checkout-attempt-1",
    })
  })

  it("guards reservation to priced catalog-backed components", () => {
    expect(() =>
      assertTripComponentCanBeReserved(component(), new Date("2026-05-18T10:00:00.000Z")),
    ).not.toThrow()

    expect(() => assertTripComponentCanBeReserved(component({ status: "draft" }))).toThrowError(
      TravelComposerInvariantError,
    )
    expect(() =>
      assertTripComponentCanBeReserved(component({ kind: "manual_placeholder" })),
    ).toThrowError(/catalog-backed/)
    expect(() =>
      assertTripComponentCanBeReserved(
        component({ priceExpiresAt: new Date("2026-05-18T09:59:00.000Z") }),
        new Date("2026-05-18T10:00:00.000Z"),
      ),
    ).toThrowError(/expired/)
  })

  it("maps provider reserve output into component refs and hold state", () => {
    expect(
      reserveResultToComponentPatch({
        status: "held",
        bookingId: "book_123",
        bookingGroupId: "bkgrp_123",
        orderId: "ord_123",
        paymentSessionId: "pay_123",
        providerRef: "provider/123",
        supplierRef: "supplier/123",
        holdToken: "hold_123",
        holdExpiresAt: "2026-05-18T12:00:00.000Z",
      }),
    ).toMatchObject({
      status: "held",
      bookingId: "book_123",
      bookingGroupId: "bkgrp_123",
      orderId: "ord_123",
      paymentSessionId: "pay_123",
      providerRef: "provider/123",
      supplierRef: "supplier/123",
      holdToken: "hold_123",
      holdExpiresAt: new Date("2026-05-18T12:00:00.000Z"),
    })
  })

  it("replays only completed reserve attempts with the same key", () => {
    const envelope = {
      status: "reserved",
      reserveIdempotencyKey: "attempt-1",
    } satisfies Pick<TripEnvelope, "status" | "reserveIdempotencyKey">

    expect(shouldReplayReserve(envelope, "attempt-1")).toBe(true)
    expect(shouldReplayReserve({ ...envelope, status: "priced" }, "attempt-1")).toBe(false)
    expect(shouldReplayReserve(envelope, "attempt-2")).toBe(false)
  })

  it("reserves priced catalog components in sequence", async () => {
    const state = {
      envelope: envelope(),
      components: [component({ id: "trcp_1" }), component({ id: "trcp_2", sequence: 1 })],
      events: [],
    }

    const result = await travelComposerService.reserveTrip(
      makeFakeDb(state),
      { envelopeId: state.envelope.id, idempotencyKey: "attempt-1" },
      {
        reserveCatalogComponent: async ({ component: item }) => ({
          status: "held",
          bookingId: `book_${item.id}`,
          bookingGroupId: "bkgrp_123",
          holdToken: `hold_${item.id}`,
          holdExpiresAt: "2026-05-18T12:00:00.000Z",
        }),
      },
    )

    expect(result.envelope.status).toBe("reserved")
    expect(result.envelope.reserveIdempotencyKey).toBe("attempt-1")
    expect(result.envelope.bookingGroupId).toBe("bkgrp_123")
    expect(result.failures).toEqual([])
    expect(result.reserved).toEqual([
      { componentId: "trcp_1", status: "held" },
      { componentId: "trcp_2", status: "held" },
    ])
    expect(state.components.map((item) => item.bookingId)).toEqual(["book_trcp_1", "book_trcp_2"])
  })

  it("compensates earlier reserved components when a later reserve fails", async () => {
    const state = {
      envelope: envelope(),
      components: [component({ id: "trcp_1" }), component({ id: "trcp_2", sequence: 1 })],
      events: [],
    }

    const result = await travelComposerService.reserveTrip(
      makeFakeDb(state),
      { envelopeId: state.envelope.id },
      {
        reserveCatalogComponent: async ({ component: item }) => {
          if (item.id === "trcp_2") throw new Error("supplier_hold_failed")
          return {
            status: "held",
            bookingId: `book_${item.id}`,
            holdToken: `hold_${item.id}`,
          }
        },
        releaseCatalogComponent: async () => ({ released: true }),
      },
    )

    expect(result.envelope.status).toBe("failed")
    expect(result.failures).toEqual([{ componentId: "trcp_2", reason: "supplier_hold_failed" }])
    expect(result.compensations).toEqual([{ componentId: "trcp_1", status: "released" }])
    expect(state.components.map((item) => item.status)).toEqual(["cancelled", "failed"])
  })
})
