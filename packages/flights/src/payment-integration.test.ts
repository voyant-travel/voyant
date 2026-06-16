import type { Context } from "hono"
import { describe, expect, it, vi } from "vitest"

import type { FlightOrder } from "./contract/types.js"
import {
  buildFlightSummary,
  createFlightOrderPaymentIntegration,
  type OrderPaymentSessionsLike,
  parseAmountToCents,
  synthesizeBilling,
} from "./payment-integration.js"

const DB = { __db: true } as never
let CTX: Context
function stubContext(): Context {
  CTX = { var: { db: DB } } as unknown as Context
  return CTX
}

function stubOrder(over: Partial<FlightOrder> = {}): FlightOrder {
  return {
    orderId: "ord_1",
    status: "confirmed",
    offer: {
      itineraries: [
        {
          segments: [
            {
              departure: { iataCode: "LHR", at: "2026-07-01T08:00:00Z" },
              arrival: { iataCode: "CDG", at: "2026-07-01T10:00:00Z" },
            },
          ],
        },
      ],
    } as never,
    passengers: [
      { passengerId: "p1", type: "adult", firstName: "Ada", lastName: "Lovelace" } as never,
    ],
    totalPrice: { amount: "250.50", currency: "EUR" } as never,
    createdAt: "2026-06-01T00:00:00Z",
    ...over,
  }
}

describe("helpers", () => {
  it("parseAmountToCents rounds to cents and guards non-finite", () => {
    expect(parseAmountToCents("250.50")).toBe(25050)
    expect(parseAmountToCents("not-a-number")).toBe(0)
  })

  it("synthesizeBilling prefers contact, falls back to passenger then defaults", () => {
    const pax = {
      passengerId: "p1",
      type: "adult",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "pax@x.com",
    } as never
    expect(synthesizeBilling(pax, { email: "c@x.com" })).toMatchObject({
      email: "c@x.com",
      phone: "0000000000",
      firstName: "Ada",
      lastName: "Lovelace",
      country: 642,
    })
    expect(synthesizeBilling(pax, undefined).email).toBe("pax@x.com")
  })

  it("buildFlightSummary renders route + passenger names", () => {
    const summary = buildFlightSummary(stubOrder())
    expect(summary).toContain("LHR → CDG")
    expect(summary).toContain("Ada Lovelace")
  })
})

describe("createFlightOrderPaymentIntegration", () => {
  function stubSessions(over: Partial<OrderPaymentSessionsLike> = {}): OrderPaymentSessionsLike {
    return {
      ensureSession: vi.fn(async () => ({ sessionId: "ps_1", status: "pending" })),
      fetchSessions: vi.fn(async () => new Map()),
      ...over,
    }
  }

  it("ensureOrderSession maps the order onto generic session params", async () => {
    const orderPaymentSessions = stubSessions()
    const integration = createFlightOrderPaymentIntegration({ orderPaymentSessions })

    const result = await integration.ensureOrderSession(stubContext(), stubOrder(), {
      email: "c@x.com",
    })

    expect(result).toEqual({ sessionId: "ps_1", status: "pending" })
    expect(orderPaymentSessions.ensureSession).toHaveBeenCalledWith(
      DB,
      expect.objectContaining({
        targetId: "ord_1",
        currency: "EUR",
        amountCents: 25050,
        payerEmail: "c@x.com",
        payerName: "Ada Lovelace",
        notes: expect.stringContaining("LHR → CDG"),
      }),
      undefined,
    )
  })

  it("returns null when the order has no passengers", async () => {
    const orderPaymentSessions = stubSessions()
    const integration = createFlightOrderPaymentIntegration({ orderPaymentSessions })

    const result = await integration.ensureOrderSession(
      stubContext(),
      stubOrder({ passengers: [] }),
    )

    expect(result).toBeNull()
    expect(orderPaymentSessions.ensureSession).not.toHaveBeenCalled()
  })

  it("wires startCardPayment through the generic startProvider with synthesized billing", async () => {
    const startCardPayment = vi.fn(async () => undefined)
    const ensureSession = vi.fn(
      async (
        _db: never,
        _params: never,
        startProvider?: (db: never, sessionId: string) => Promise<void>,
      ) => {
        await startProvider?.(DB, "ps_new")
        return { sessionId: "ps_new", status: "pending" }
      },
    )
    const integration = createFlightOrderPaymentIntegration({
      orderPaymentSessions: stubSessions({ ensureSession: ensureSession as never }),
      startCardPayment,
    })

    const ctx = stubContext()
    await integration.ensureOrderSession(ctx, stubOrder(), undefined)

    expect(startCardPayment).toHaveBeenCalledWith(
      ctx,
      "ps_new",
      expect.objectContaining({ firstName: "Ada", lastName: "Lovelace", country: 642 }),
    )
  })

  it("fetchOrderSessions delegates to the generic service", async () => {
    const fetchSessions = vi.fn(
      async () => new Map([["ord_1", { sessionId: "ps_1", status: "paid" }]]),
    )
    const integration = createFlightOrderPaymentIntegration({
      orderPaymentSessions: stubSessions({ fetchSessions: fetchSessions as never }),
    })

    const result = await integration.fetchOrderSessions(stubContext(), ["ord_1"])

    expect(result.get("ord_1")).toEqual({ sessionId: "ps_1", status: "paid" })
    expect(fetchSessions).toHaveBeenCalledWith(DB, ["ord_1"])
  })

  it("fetchOrderSessions short-circuits empty input", async () => {
    const fetchSessions = vi.fn(async () => new Map())
    const integration = createFlightOrderPaymentIntegration({
      orderPaymentSessions: stubSessions({ fetchSessions: fetchSessions as never }),
    })

    const result = await integration.fetchOrderSessions(stubContext(), [])

    expect(result.size).toBe(0)
    expect(fetchSessions).not.toHaveBeenCalled()
  })
})
