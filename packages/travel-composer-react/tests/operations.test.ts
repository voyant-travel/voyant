import { describe, expect, it } from "vitest"
import {
  addTripComponent,
  cancelTripComponents,
  createTrip,
  getTrip,
  listTrips,
  previewTripCancellation,
  priceTrip,
  reserveTrip,
  startTripCheckout,
} from "../src/operations.js"

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}

describe("travel composer react operations", () => {
  it("reads a trip from the admin composer route", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    await getTrip(
      {
        baseUrl: "https://app.example",
        fetcher: async (url, init) => {
          calls.push({ url, init })
          return jsonResponse({ envelope: { id: "trip_123" }, components: [] })
        },
      },
      "trip_123",
    )

    expect(calls[0]?.url).toBe("https://app.example/v1/admin/travel-composer/trips/trip_123")
  })

  it("lists trips with query params", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    await listTrips(
      {
        baseUrl: "https://app.example",
        fetcher: async (url, init) => {
          calls.push({ url, init })
          return jsonResponse({ data: [], total: 0, limit: 25, offset: 0 })
        },
      },
      { status: "reserved", search: "istanbul", limit: 25, offset: 50 },
    )

    expect(calls[0]?.url).toBe(
      "https://app.example/v1/admin/travel-composer/trips?status=reserved&search=istanbul&limit=25&offset=50",
    )
  })

  it("can target the public composer route", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const client = {
      baseUrl: "https://app.example",
      surface: "public" as const,
      fetcher: async (url: string, init?: RequestInit) => {
        calls.push({ url, init })
        return jsonResponse({ envelope: { id: "trip_123" }, components: [] })
      },
    }

    await createTrip(client, { title: "Bucharest extension" })
    await getTrip(client, "trip_123")
    await addTripComponent(client, "trip_123", {
      kind: "manual_placeholder",
      estimatedPricing: {
        currency: "EUR",
        subtotalAmountCents: 4000,
        taxAmountCents: 0,
        totalAmountCents: 4000,
      },
      metadata: { manualService: { name: "Airport transfer" }, template: "manual" },
    })

    expect(calls.map((call) => call.url)).toEqual([
      "https://app.example/v1/public/travel-composer/trips",
      "https://app.example/v1/public/travel-composer/trips/trip_123",
      "https://app.example/v1/public/travel-composer/trips/trip_123/components",
    ])
  })

  it("posts price, reserve, and checkout bodies without duplicating envelopeId", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const client = {
      baseUrl: "https://app.example",
      fetcher: async (url: string, init?: RequestInit) => {
        calls.push({ url, init })
        return jsonResponse({
          envelope: { id: "trip_123" },
          components: [],
          pricing: {},
          reserved: [],
          failures: [],
          compensations: [],
          warnings: [],
          target: {},
          componentCheckouts: [],
        })
      },
    }

    await priceTrip(client, "trip_123", {
      scope: { locale: "en", audience: "customer", market: "RO", currency: "EUR" },
    })
    await reserveTrip(client, "trip_123", { idempotencyKey: "reserve-1" })
    await startTripCheckout(client, "trip_123", {
      intent: "card",
      idempotencyKey: "checkout-1",
      request: { payerEmail: "traveler@example.com" },
    })

    expect(calls.map((call) => call.url)).toEqual([
      "https://app.example/v1/admin/travel-composer/trips/trip_123/price",
      "https://app.example/v1/admin/travel-composer/trips/trip_123/reserve",
      "https://app.example/v1/admin/travel-composer/trips/trip_123/checkout",
    ])
    expect(calls.map((call) => JSON.parse(String(call.init?.body)))).toEqual([
      { scope: { locale: "en", audience: "customer", market: "RO", currency: "EUR" } },
      { idempotencyKey: "reserve-1" },
      {
        intent: "card",
        idempotencyKey: "checkout-1",
        request: { payerEmail: "traveler@example.com" },
      },
    ])
  })

  it("posts cancellation preview and selected-component cancel bodies", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const client = {
      baseUrl: "https://app.example",
      fetcher: async (url: string, init?: RequestInit) => {
        calls.push({ url, init })
        return jsonResponse({
          envelope: { id: "trip_123" },
          components: [],
          preview: {
            envelopeId: "trip_123",
            selectedComponentIds: ["stay", "flight"],
            currency: "EUR",
            estimatedRefundAmountCents: 0,
            estimatedPenaltyAmountCents: 0,
            staffActionRequired: false,
            components: [],
            warnings: [],
          },
          cancelled: [],
          remediation: [],
          skipped: [],
        })
      },
    }

    await previewTripCancellation(client, "trip_123", {
      componentIds: ["stay", "flight"],
      reason: "Traveler changed plans",
    })
    await cancelTripComponents(client, "trip_123", {
      componentIds: ["stay", "flight"],
      idempotencyKey: "cancel-1",
      reason: "Traveler changed plans",
    })

    expect(calls.map((call) => call.url)).toEqual([
      "https://app.example/v1/admin/travel-composer/trips/trip_123/cancellation-preview",
      "https://app.example/v1/admin/travel-composer/trips/trip_123/cancel-components",
    ])
    expect(calls.map((call) => JSON.parse(String(call.init?.body)))).toEqual([
      { componentIds: ["stay", "flight"], reason: "Traveler changed plans" },
      {
        componentIds: ["stay", "flight"],
        idempotencyKey: "cancel-1",
        reason: "Traveler changed plans",
      },
    ])
  })
})
