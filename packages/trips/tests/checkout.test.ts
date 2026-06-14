import type { AnyDrizzleDb } from "@voyantjs/db"
import { describe, expect, it } from "vitest"
import type { NewTripComponentEvent, TripComponent, TripEnvelope } from "../src/schema.js"
import { tripComponentEvents, tripComponents, tripEnvelopes } from "../src/schema.js"
import {
  assertTripComponentCanStartCheckout,
  checkoutResultToComponentPatch,
  shouldReplayCheckout,
  TripsInvariantError,
  tripsService,
} from "../src/service.js"
import { startTripCheckoutSchema } from "../src/validation.js"

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
    status: "held",
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
    bookingGroupId: "bkgrp_123",
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
    holdToken: "hold_123",
    holdExpiresAt: new Date("2099-05-20T12:00:00.000Z"),
    priceExpiresAt: new Date("2099-05-20T12:00:00.000Z"),
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
    status: "reserved",
    title: null,
    description: null,
    travelerParty: completeTravelerParty,
    constraints: {},
    aggregateCurrency: "EUR",
    aggregateSubtotalAmountCents: 20000,
    aggregateTaxAmountCents: 1800,
    aggregateTotalAmountCents: 21800,
    aggregatePricingSnapshot: null,
    currentPriceExpiresAt: null,
    bookingGroupId: "bkgrp_123",
    orderId: null,
    paymentSessionId: null,
    reserveIdempotencyKey: null,
    reserveStartedAt: new Date("2026-05-18T09:00:00.000Z"),
    reservedAt: new Date("2026-05-18T09:01:00.000Z"),
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
      patch.status === "checkout_started" || patch.status === "booked"
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

describe("trips checkout handoff", () => {
  it("accepts checkout start requests with a customer-facing intent", () => {
    expect(
      startTripCheckoutSchema.parse({
        envelopeId: "trip_123",
        intent: "bank_transfer",
        idempotencyKey: "checkout-1",
      }),
    ).toEqual({
      envelopeId: "trip_123",
      intent: "bank_transfer",
      idempotencyKey: "checkout-1",
      request: {},
    })
  })

  it("guards checkout start to held or booked component bookings", () => {
    expect(() =>
      assertTripComponentCanStartCheckout(component(), new Date("2026-05-18T10:00:00.000Z")),
    ).not.toThrow()
    expect(() => assertTripComponentCanStartCheckout(component({ status: "priced" }))).toThrowError(
      TripsInvariantError,
    )
    expect(() =>
      assertTripComponentCanStartCheckout(component({ bookingId: null, orderId: null })),
    ).toThrowError(/booking\/order/)
    expect(() =>
      assertTripComponentCanStartCheckout(
        component({ holdExpiresAt: new Date("2026-05-18T09:59:00.000Z") }),
        new Date("2026-05-18T10:00:00.000Z"),
      ),
    ).toThrowError(/expired/)
  })

  it("maps checkout handoff output into component refs", () => {
    expect(
      checkoutResultToComponentPatch({
        kind: "card_redirect",
        paymentSessionId: "pay_123",
        checkoutUrl: "https://pay.example/123",
        providerRef: "provider/checkout/123",
      }),
    ).toMatchObject({
      status: "checkout_started",
      paymentSessionId: "pay_123",
      providerRef: "provider/checkout/123",
    })
  })

  it("replays only completed checkout attempts with the same key", () => {
    const existing = {
      status: "checkout_started",
      checkoutIdempotencyKey: "checkout-1",
    } satisfies Pick<TripEnvelope, "status" | "checkoutIdempotencyKey">

    expect(shouldReplayCheckout(existing, "checkout-1")).toBe(true)
    expect(shouldReplayCheckout({ ...existing, status: "reserved" }, "checkout-1")).toBe(false)
    expect(shouldReplayCheckout(existing, "checkout-2")).toBe(false)
  })

  it("starts one customer-facing checkout while preserving component sessions", async () => {
    const state = {
      envelope: envelope(),
      components: [component({ id: "trcp_1" }), component({ id: "trcp_2", sequence: 1 })],
      events: [],
    }

    const result = await tripsService.startCheckout(
      makeFakeDb(state),
      { envelopeId: state.envelope.id, idempotencyKey: "checkout-1", intent: "card", request: {} },
      {
        startComponentCheckout: async ({ component: item }) => ({
          kind: "card_redirect",
          paymentSessionId: `pay_${item.id}`,
          checkoutUrl: "https://pay.example/trip_123",
          expiresAt: "2026-05-19T12:00:00.000Z",
        }),
      },
    )

    expect(result.envelope.status).toBe("checkout_started")
    expect(result.envelope.checkoutIdempotencyKey).toBe("checkout-1")
    expect(result.target).toMatchObject({
      envelopeId: "trip_123",
      currency: "EUR",
      totalAmountCents: 21800,
      paymentSessionId: null,
      checkoutUrl: "https://pay.example/trip_123",
    })
    expect(result.componentCheckouts).toEqual([
      {
        componentId: "trcp_1",
        kind: "card_redirect",
        bookingId: "book_123",
        orderId: null,
        paymentSessionId: "pay_trcp_1",
        checkoutUrl: "https://pay.example/trip_123",
        bankTransferInstructions: null,
        expiresAt: "2026-05-19T12:00:00.000Z",
      },
      {
        componentId: "trcp_2",
        kind: "card_redirect",
        bookingId: "book_123",
        orderId: null,
        paymentSessionId: "pay_trcp_2",
        checkoutUrl: "https://pay.example/trip_123",
        bankTransferInstructions: null,
        expiresAt: "2026-05-19T12:00:00.000Z",
      },
    ])
    expect(state.components.map((item) => item.status)).toEqual([
      "checkout_started",
      "checkout_started",
    ])
    expect(state.components.map((item) => item.paymentSessionId)).toEqual([
      "pay_trcp_1",
      "pay_trcp_2",
    ])
  })
})
