import type { ComputeQuoteRequest, OwnedHandlerContext } from "@voyantjs/catalog/booking-engine"
import { describe, expect, it, vi } from "vitest"

import {
  createProductsBookingHandler,
  type ResolvedOptionPrice,
} from "../../src/booking-engine/handler.js"

const product = {
  id: "prod_a",
  name: "Bulgaria Day Trip",
  status: "active" as const,
  sellAmountCents: 14500,
  sellCurrency: "RON",
}

function makeDb(rows: unknown[]) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => rows,
        }),
      }),
    }),
  } as unknown as OwnedHandlerContext["db"]
}

function makeCtx(rows: unknown[]): OwnedHandlerContext {
  return {
    db: makeDb(rows),
    adapterContext: {} as never,
  }
}

const baseRequest = (draft?: unknown): ComputeQuoteRequest => ({
  entityModule: "products",
  entityId: product.id,
  scope: { locale: "en", audience: "customer", market: "RO" },
  draft: draft ?? {},
})

describe("createProductsBookingHandler.computeQuote", () => {
  it("falls back to product.sellAmountCents × pax when no resolver hooks are wired", async () => {
    const handler = createProductsBookingHandler({
      quickCreate: vi.fn(),
    })

    const result = await handler.computeQuote(
      makeCtx([product]),
      baseRequest({ configure: { pax: { adult: 2 } } }),
    )

    expect(result.available).toBe(true)
    const breakdown = result.pricing?.breakdown as Record<string, unknown>
    expect(breakdown?.total).toBe(29000)
    expect(breakdown?.subtotal).toBe(29000)
    const lines = breakdown?.lines as Array<{ totalAmount: number; quantity: number }>
    expect(lines).toHaveLength(1)
    expect(lines[0]?.totalAmount).toBe(29000)
    expect(lines[0]?.quantity).toBe(2)
  })

  it("uses per-band unit prices when the resolver returns matching units", async () => {
    const loadResolvedOptionPrice = vi.fn(
      async (): Promise<ResolvedOptionPrice> => ({
        baseSellAmountCents: 16000,
        unitPrices: [
          {
            unitId: "u_adult",
            unitType: "person",
            travelerCategory: "adult",
            sellAmountCents: 16000,
          },
          {
            unitId: "u_child",
            unitType: "person",
            travelerCategory: "child",
            sellAmountCents: 9500,
          },
          {
            unitId: "u_infant",
            unitType: "person",
            travelerCategory: "infant",
            sellAmountCents: 0,
          },
        ],
      }),
    )
    const loadSlotDate = vi.fn(async () => "2026-06-21")

    const handler = createProductsBookingHandler({
      quickCreate: vi.fn(),
      loadResolvedOptionPrice,
      loadSlotDate,
    })

    const result = await handler.computeQuote(
      makeCtx([product]),
      baseRequest({
        configure: {
          variantId: "opt_default",
          departureSlotId: "slot_1",
          pax: { adult: 2, child: 1, infant: 1 },
        },
      }),
    )

    expect(loadSlotDate).toHaveBeenCalledWith(expect.anything(), "slot_1")
    expect(loadResolvedOptionPrice).toHaveBeenCalledWith(expect.anything(), {
      productId: product.id,
      optionId: "opt_default",
      date: "2026-06-21",
    })

    const breakdown = result.pricing?.breakdown as Record<string, unknown>
    // 2 × 16000 + 1 × 9500 = 41500. Infant (sell=0) drops out.
    expect(breakdown?.total).toBe(41500)
    const lines = breakdown?.lines as Array<{ quantity: number; unitAmount: number }>
    expect(lines).toHaveLength(2)
    expect(lines.map((l) => `${l.quantity}×${l.unitAmount}`)).toEqual(["2×16000", "1×9500"])
  })

  it("uses baseSellAmountCents × pax for per-booking rules with no unit prices", async () => {
    const handler = createProductsBookingHandler({
      quickCreate: vi.fn(),
      loadSlotDate: async () => "2026-07-15",
      loadResolvedOptionPrice: async () => ({
        baseSellAmountCents: 18000,
        unitPrices: [],
      }),
    })

    const result = await handler.computeQuote(
      makeCtx([product]),
      baseRequest({
        configure: {
          variantId: "opt_default",
          departureSlotId: "slot_1",
          pax: { adult: 3 },
        },
      }),
    )

    const breakdown = result.pricing?.breakdown as Record<string, unknown>
    expect(breakdown?.total).toBe(54000) // 18000 × 3
    const lines = breakdown?.lines as Array<{ unitAmount: number; quantity: number }>
    expect(lines).toHaveLength(1)
    expect(lines[0]?.unitAmount).toBe(18000)
    expect(lines[0]?.quantity).toBe(3)
  })

  it("falls through to product.sellAmountCents when the resolver returns null", async () => {
    const handler = createProductsBookingHandler({
      quickCreate: vi.fn(),
      loadSlotDate: async () => "2026-12-01",
      loadResolvedOptionPrice: async () => null,
    })

    const result = await handler.computeQuote(
      makeCtx([product]),
      baseRequest({
        configure: {
          variantId: "opt_default",
          departureSlotId: "slot_1",
          pax: { adult: 1 },
        },
      }),
    )

    const breakdown = result.pricing?.breakdown as Record<string, unknown>
    expect(breakdown?.total).toBe(14500) // product.sellAmountCents × 1
  })

  it("skips the resolver when no slot is selected (single-occupant baseline)", async () => {
    const loadResolvedOptionPrice = vi.fn(async (): Promise<ResolvedOptionPrice | null> => null)

    const handler = createProductsBookingHandler({
      quickCreate: vi.fn(),
      loadResolvedOptionPrice,
      loadSlotDate: async () => "2026-06-21",
    })

    const result = await handler.computeQuote(
      makeCtx([product]),
      baseRequest({ configure: { variantId: "opt_default" } }),
    )

    expect(loadResolvedOptionPrice).not.toHaveBeenCalled()
    const breakdown = result.pricing?.breakdown as Record<string, unknown>
    expect(breakdown?.total).toBe(14500) // single-occupant fallback
  })

  it("respects an inline draft.configure.departureDate when no loadSlotDate is wired", async () => {
    const loadResolvedOptionPrice = vi.fn(
      async (): Promise<ResolvedOptionPrice> => ({
        baseSellAmountCents: 20000,
        unitPrices: [],
      }),
    )

    const handler = createProductsBookingHandler({
      quickCreate: vi.fn(),
      loadResolvedOptionPrice,
    })

    const result = await handler.computeQuote(
      makeCtx([product]),
      baseRequest({
        configure: {
          variantId: "opt_default",
          departureDate: "2026-06-21",
          pax: { adult: 2 },
        },
      }),
    )

    expect(loadResolvedOptionPrice).toHaveBeenCalledWith(expect.anything(), {
      productId: product.id,
      optionId: "opt_default",
      date: "2026-06-21",
    })
    const breakdown = result.pricing?.breakdown as Record<string, unknown>
    expect(breakdown?.total).toBe(40000)
  })
})
