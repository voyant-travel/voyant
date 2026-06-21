import { describe, expect, it, vi } from "vitest"

import {
  createFlightComponentAdapter,
  type FlightComponentAdapter,
} from "../src/flight-component.js"
import type { TripComponent, TripEnvelope } from "../src/schema.js"
import type { ReserveComponentInput } from "../src/service-types.js"

function envelope(travelerParty: Record<string, unknown> = {}): TripEnvelope {
  return {
    id: "trip_1",
    reference: "TRIP-1",
    title: null,
    status: "draft",
    currency: "EUR",
    travelerParty,
    constraints: {},
    pricingSnapshot: null,
    customerNotes: null,
    internalNotes: null,
    personId: null,
    organizationId: null,
    bookingGroupId: null,
    metadata: {},
    createdAt: new Date("2026-05-18T00:00:00.000Z"),
    updatedAt: new Date("2026-05-18T00:00:00.000Z"),
  } as TripEnvelope
}

function flightComponent(metadata: Record<string, unknown>): TripComponent {
  return {
    id: "trcp_flight",
    envelopeId: "trip_1",
    sequence: 0,
    kind: "flight_placeholder",
    status: "draft",
    title: null,
    description: null,
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
    componentSubtotalAmountCents: null,
    componentTaxAmountCents: null,
    componentTotalAmountCents: 20000,
    pricingSnapshot: null,
    taxLines: [],
    cancellationSnapshot: null,
    holdToken: null,
    holdExpiresAt: null,
    priceExpiresAt: null,
    warningCodes: [],
    metadata,
    createdAt: new Date("2026-05-18T00:00:00.000Z"),
    updatedAt: new Date("2026-05-18T00:00:00.000Z"),
  } as TripComponent
}

function offer(overrides: Record<string, unknown> = {}) {
  return {
    offerId: "offer_1",
    source: "demo",
    totalPrice: { amount: "200.00", currency: "EUR" },
    ...overrides,
  } as never
}

function stubAdapter(over: Partial<FlightComponentAdapter> = {}): FlightComponentAdapter {
  return {
    priceOffer: vi.fn(async () => ({ offer: offer(), valid: true })),
    bookFlight: vi.fn(async () => ({
      order: {
        orderId: "ord_1",
        status: "held",
        pnr: "ABC123",
        paymentDeadline: "2026-06-01T00:00:00.000Z",
      } as never,
    })),
    ...over,
  }
}

const ctx = { connectionId: "demo", correlationId: "req_1" }

function input(
  component: TripComponent,
  travelerParty: Record<string, unknown> = {},
): ReserveComponentInput {
  return { envelope: envelope(travelerParty), component }
}

describe("flight component adapter — validateBeforeReserve", () => {
  it("returns null for non-flight components", async () => {
    const api = createFlightComponentAdapter({ adapter: stubAdapter(), adapterContext: ctx })
    const c = { ...flightComponent({}), kind: "catalog_booking" } as TripComponent
    expect(await api.validateBeforeReserve(input(c))).toBeNull()
  })

  it("requires a selected flight offer", async () => {
    const api = createFlightComponentAdapter({ adapter: stubAdapter(), adapterContext: ctx })
    const result = await api.validateBeforeReserve(input(flightComponent({})))
    expect(result).toEqual({ status: "unavailable", reason: "flight_offer_required" })
  })

  it("accepts an unchanged price", async () => {
    const api = createFlightComponentAdapter({ adapter: stubAdapter(), adapterContext: ctx })
    const component = flightComponent({
      flightDraft: { selectedOffer: offer(), offerId: "offer_1" },
    })
    const result = await api.validateBeforeReserve(input(component))
    expect(result).toEqual({ status: "ok" })
  })

  it("rejects when the re-priced total changed", async () => {
    const adapter = stubAdapter({
      priceOffer: vi.fn(async () => ({
        offer: offer({ totalPrice: { amount: "250.00", currency: "EUR" } }),
        valid: true,
      })),
    })
    const api = createFlightComponentAdapter({ adapter, adapterContext: ctx })
    const component = flightComponent({
      flightDraft: { selectedOffer: offer(), offerId: "offer_1" },
    })
    const result = await api.validateBeforeReserve(input(component))
    expect(result?.status).toBe("price_changed")
    expect(result?.reason).toBe("flight_price_changed")
    expect(
      (result?.details as { current: { totalAmountCents: number } }).current.totalAmountCents,
    ).toBe(25000)
    expect(
      (result?.details as { previous: { totalAmountCents: number } }).previous.totalAmountCents,
    ).toBe(20000)
  })

  it("includes ancillary cents in the current total comparison", async () => {
    const api = createFlightComponentAdapter({ adapter: stubAdapter(), adapterContext: ctx })
    // base 200.00 = 20000 + 1000 ancillary = 21000, previous total 20000 → changed
    const component = flightComponent({
      flightDraft: {
        selectedOffer: offer(),
        offerId: "offer_1",
        pricing: { ancillaryAmountCents: 1000, totalAmountCents: 20000, currency: "EUR" },
      },
    })
    const result = await api.validateBeforeReserve(input(component))
    expect(result?.status).toBe("price_changed")
  })

  it("marks an expired offer as expired when re-pricing throws", async () => {
    const adapter = stubAdapter({
      priceOffer: vi.fn(async () => {
        throw new Error("offer expired upstream")
      }),
    })
    const api = createFlightComponentAdapter({ adapter, adapterContext: ctx })
    const expired = offer({ expiresAt: "2000-01-01T00:00:00.000Z" })
    const component = flightComponent({
      flightDraft: { selectedOffer: expired, offerId: "offer_1" },
    })
    const result = await api.validateBeforeReserve(input(component))
    expect(result?.status).toBe("expired")
  })

  it("surfaces an invalid offer as unavailable", async () => {
    const adapter = stubAdapter({
      priceOffer: vi.fn(async () => ({ offer: offer(), valid: false, invalidReason: "sold_out" })),
    })
    const api = createFlightComponentAdapter({ adapter, adapterContext: ctx })
    const component = flightComponent({
      flightDraft: { selectedOffer: offer(), offerId: "offer_1" },
    })
    const result = await api.validateBeforeReserve(input(component))
    expect(result).toEqual({
      status: "unavailable",
      reason: "sold_out",
      details: { offerId: "offer_1" },
    })
  })
})

describe("flight component adapter — reserve passenger mapping", () => {
  it("maps explicit travelers into passengers with role-based types and DOB fallbacks", async () => {
    const bookFlight = vi.fn(async () => ({
      order: {
        orderId: "ord_1",
        status: "held",
        paymentDeadline: "2026-06-01T00:00:00.000Z",
      } as never,
    }))
    const api = createFlightComponentAdapter({
      adapter: stubAdapter({ bookFlight }),
      adapterContext: ctx,
    })
    const component = flightComponent({ flightDraft: { selectedOffer: offer() } })
    const travelerParty = {
      travelers: [
        {
          firstName: "Ada",
          lastName: "Lovelace",
          role: "adult",
          dateOfBirth: "1990-12-10",
          email: "ada@x.io",
        },
        { role: "child", localId: "kid_1" },
        { role: "infant" },
      ],
    }
    await api.reserve(input(component, travelerParty))
    const request = bookFlight.mock.calls[0]?.[1] as {
      passengers: Array<Record<string, unknown>>
    }
    expect(request.passengers).toHaveLength(3)
    expect(request.passengers[0]).toMatchObject({
      passengerId: "traveler_1",
      type: "adult",
      firstName: "Ada",
      lastName: "Lovelace",
      dateOfBirth: "1990-12-10",
      email: "ada@x.io",
    })
    // child fallbacks: firstName "Child", lastName index, dob 2016-01-01
    expect(request.passengers[1]).toMatchObject({
      passengerId: "kid_1",
      type: "child",
      firstName: "Child",
      lastName: "2",
      dateOfBirth: "2016-01-01",
    })
    // infant fallbacks: dob 2025-01-01
    expect(request.passengers[2]).toMatchObject({ type: "infant", dateOfBirth: "2025-01-01" })
  })

  it("synthesizes a lead passenger from billing when no travelers are present", async () => {
    const bookFlight = vi.fn(async () => ({
      order: {
        orderId: "ord_1",
        status: "held",
        paymentDeadline: "2026-06-01T00:00:00.000Z",
      } as never,
    }))
    const api = createFlightComponentAdapter({
      adapter: stubAdapter({ bookFlight }),
      adapterContext: ctx,
    })
    const component = flightComponent({ flightDraft: { selectedOffer: offer() } })
    const travelerParty = {
      billing: {
        contact: {
          firstName: "Grace",
          lastName: "Hopper",
          email: "grace@navy.mil",
          phone: "+1555",
        },
      },
    }
    await api.reserve(input(component, travelerParty))
    const request = bookFlight.mock.calls[0]?.[1] as {
      passengers: Array<Record<string, unknown>>
      contact: Record<string, unknown>
    }
    expect(request.passengers).toHaveLength(1)
    expect(request.passengers[0]).toMatchObject({
      passengerId: "traveler_1",
      firstName: "Grace",
      lastName: "Hopper",
      email: "grace@navy.mil",
    })
    expect(request.contact).toMatchObject({ email: "grace@navy.mil", phone: "+1555" })
  })

  it("returns held with a missing-deadline warning when no payment deadline", async () => {
    const bookFlight = vi.fn(async () => ({
      order: { orderId: "ord_9", status: "held" } as never,
    }))
    const api = createFlightComponentAdapter({
      adapter: stubAdapter({ bookFlight }),
      adapterContext: ctx,
    })
    const component = flightComponent({ flightDraft: { selectedOffer: offer() } })
    const result = await api.reserve(
      input(component, { travelers: [{ firstName: "A", lastName: "B" }] }),
    )
    expect(result).toMatchObject({
      status: "held",
      orderId: "ord_9",
      warnings: ["flight_hold_deadline_missing"],
    })
  })

  it("throws when the offer is missing on reserve", async () => {
    const api = createFlightComponentAdapter({ adapter: stubAdapter(), adapterContext: ctx })
    const component = flightComponent({ flightDraft: {} })
    await expect(api.reserve(input(component))).rejects.toThrow("flight_offer_required")
  })
})
