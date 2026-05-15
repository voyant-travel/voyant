import { describe, expect, it } from "vitest"

import {
  bootstrapBookingSession,
  bootstrappedBookingSessionResponseSchema,
  createVoyantStorefrontClient,
} from "../../src/index.js"

function bootstrapInput() {
  return {
    departureId: "dep_123",
    slotId: "slot_123",
    quote: {
      currencyCode: "EUR",
      totalSellAmountCents: 10000,
      quotedAt: "2026-06-01T10:00:00.000Z",
      expiresAt: "2026-06-01T10:30:00.000Z",
    },
    session: {
      sellCurrency: "EUR",
      items: [
        {
          title: "Danube tour",
          availabilitySlotId: "slot_123",
          quantity: 1,
          totalSellAmountCents: 10000,
        },
      ],
    },
  }
}

function bootstrapPayload() {
  return {
    session: {
      sessionId: "book_123",
      bookingNumber: "BK-2605-000001",
      status: "on_hold",
      externalBookingRef: null,
      communicationLanguage: null,
      sellCurrency: "EUR",
      sellAmountCents: 10000,
      startDate: null,
      endDate: null,
      pax: 1,
      holdExpiresAt: "2026-06-01T10:30:00.000Z",
      confirmedAt: null,
      expiredAt: null,
      cancelledAt: null,
      completedAt: null,
      travelers: [],
      items: [],
      allocations: [],
      checklist: {
        hasTravelers: false,
        hasPrimaryTraveler: false,
        hasItems: true,
        hasAllocations: true,
        readyForConfirmation: false,
      },
      state: null,
      checkoutCapability: {
        token: "cap_123",
        expiresAt: "2026-06-01T10:30:00.000Z",
        actions: ["session:read", "payment:start"],
      },
    },
    paymentPlan: {
      source: "storefront_default",
      depositKind: "percent",
      depositPercent: 20,
      depositAmountCents: null,
      requiresFullPayment: false,
    },
    paymentSchedule: [
      {
        id: "bps_123",
        scheduleType: "deposit",
        status: "due",
        dueDate: "2026-06-01",
        currency: "EUR",
        amountCents: 2000,
        notes: null,
      },
    ],
    repricing: {
      originalQuote: {
        currencyCode: "EUR",
        totalSellAmountCents: 10000,
        quotedAt: "2026-06-01T10:00:00.000Z",
        expiresAt: "2026-06-01T10:30:00.000Z",
      },
      current: {
        sessionId: "book_123",
        catalogId: null,
        currencyCode: "EUR",
        totalSellAmountCents: 10000,
        items: [],
        warnings: [],
        appliedToSession: true,
      },
      deltaAmountCents: 0,
      staleQuote: false,
    },
    availability: {
      departureId: "dep_123",
      slotId: "slot_123",
      productId: "prod_123",
      optionId: null,
      dateLocal: "2026-06-01",
      startsAt: "2026-06-01T10:00:00.000Z",
      endsAt: "2026-06-01T12:00:00.000Z",
      timezone: "Europe/Bucharest",
      status: "open",
      capacity: 10,
      remaining: 9,
    },
    allocation: [],
    currency: "EUR",
  }
}

describe("booking session bootstrap", () => {
  it("posts to the native bootstrap route and parses the combined payload", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const client = {
      baseUrl: "https://operator.example.com",
      fetcher: async (url: string, init?: RequestInit) => {
        calls.push({ url, init })
        return Response.json({ data: bootstrapPayload() }, { status: 201 })
      },
    }

    const result = await bootstrapBookingSession(client, bootstrapInput(), {
      idempotencyKey: "bootstrap-1",
    })

    expect(calls[0]?.url).toBe("https://operator.example.com/v1/public/bookings/sessions/bootstrap")
    expect(calls[0]?.init?.method).toBe("POST")
    expect(new Headers(calls[0]?.init?.headers).get("Idempotency-Key")).toBe("bootstrap-1")
    expect(result.session.checkoutCapability.token).toBe("cap_123")
    expect(result.paymentSchedule[0]?.amountCents).toBe(2000)
  })

  it("exposes bootstrap through the storefront client booking facade", async () => {
    const voyant = createVoyantStorefrontClient({
      baseUrl: "https://operator.example.com",
      fetcher: async () => Response.json({ data: bootstrapPayload() }, { status: 201 }),
    })

    const result = await voyant.booking.bootstrapSession(bootstrapInput())

    expect(result.session.sessionId).toBe("book_123")
    expect(result.availability.slotId).toBe("slot_123")
  })

  it("requires the checkout capability returned by the route", () => {
    const payload = bootstrapPayload()
    const { checkoutCapability, ...session } = payload.session

    const result = bootstrappedBookingSessionResponseSchema.safeParse({
      data: { ...payload, session },
    })

    expect(checkoutCapability.token).toBe("cap_123")
    expect(result.success).toBe(false)
  })
})
