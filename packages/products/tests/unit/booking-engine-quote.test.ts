import type {
  CommitOwnedRequest,
  ComputeQuoteRequest,
  OwnedHandlerContext,
} from "@voyantjs/catalog/booking-engine"
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
  } as OwnedHandlerContext["db"]
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
      createBooking: vi.fn(),
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
      createBooking: vi.fn(),
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
      createBooking: vi.fn(),
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

  it("prices selected product option quantities", async () => {
    const loadResolvedOptionPrice = vi.fn(
      async (): Promise<ResolvedOptionPrice> => ({
        baseSellAmountCents: 25000,
        unitPrices: [
          {
            unitId: "unit_suite",
            unitType: "room",
            travelerCategory: null,
            sellAmountCents: 32000,
          },
        ],
      }),
    )
    const handler = createProductsBookingHandler({
      createBooking: vi.fn(),
      loadSlotDate: async () => "2026-07-15",
      loadProductOptions: async () => [
        {
          id: "opt_suite",
          name: "Junior suite upgrade",
          units: [{ id: "unit_suite", name: "Suite" }],
        },
      ],
      loadResolvedOptionPrice,
    })

    const result = await handler.computeQuote(
      makeCtx([product]),
      baseRequest({
        configure: {
          departureSlotId: "slot_1",
          optionSelections: [{ optionId: "opt_suite", optionUnitId: "unit_suite", quantity: 2 }],
        },
      }),
    )

    expect(loadResolvedOptionPrice).toHaveBeenCalledWith(expect.anything(), {
      productId: product.id,
      optionId: "opt_suite",
      date: "2026-07-15",
    })
    const breakdown = result.pricing?.breakdown as Record<string, unknown>
    expect(breakdown?.total).toBe(64000)
    const lines = breakdown?.lines as Array<{ label: string; quantity: number; unitAmount: number }>
    expect(lines[0]).toEqual(
      expect.objectContaining({
        label: "Junior suite upgrade",
        quantity: 2,
        unitAmount: 32000,
      }),
    )
  })

  it("falls through to product.sellAmountCents when the resolver returns null", async () => {
    const handler = createProductsBookingHandler({
      createBooking: vi.fn(),
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
      createBooking: vi.fn(),
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
      createBooking: vi.fn(),
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

describe("createProductsBookingHandler.commit", () => {
  it("uses the gross inclusive-tax total for the booking sell amount override", async () => {
    const createBooking = vi.fn(async () => ({
      status: "ok" as const,
      bookingId: "book_1",
      bookingNumber: "BK-1",
    }))
    const handler = createProductsBookingHandler({ createBooking })

    const request: CommitOwnedRequest = {
      entityModule: "products",
      entityId: product.id,
      bookingId: "catalog_booking_1",
      draft: {
        configure: {
          optionSelections: [{ optionId: "opt_suite", optionUnitId: "unit_suite", quantity: 2 }],
        },
      },
      pricing: {
        base_amount: 8333,
        taxes: 1667,
        fees: 0,
        surcharges: 0,
        currency: "RON",
        breakdown: {
          currency: "RON",
          subtotal: 8333,
          taxTotal: 1667,
          total: 10000,
          taxes: [
            {
              label: "VAT",
              rate: 0.2,
              amount: 1667,
              includedInPrice: true,
              scope: "included",
            },
          ],
        },
      },
    }

    const result = await handler.commit(makeCtx([product]), request)

    expect(result.status).toBe("held")
    expect(createBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: product.id,
        itemLines: [
          {
            optionId: "opt_suite",
            optionUnitId: "unit_suite",
            quantity: 2,
          },
        ],
        optionId: "opt_suite",
        sellAmountCentsOverride: 10000,
      }),
    )
  })

  it("commits multiple selected option quantities as item lines without a single option id", async () => {
    const createBooking = vi.fn(async () => ({
      status: "ok" as const,
      bookingId: "book_1",
      bookingNumber: "BK-1",
    }))
    const handler = createProductsBookingHandler({ createBooking })

    const request: CommitOwnedRequest = {
      entityModule: "products",
      entityId: product.id,
      bookingId: "catalog_booking_1",
      draft: {
        configure: {
          optionSelections: [
            { optionId: "opt_standard", optionUnitId: "unit_standard", quantity: 1 },
            { optionId: "opt_suite", optionUnitId: "unit_suite", quantity: 1 },
          ],
        },
      },
      pricing: {
        base_amount: 29000,
        taxes: 0,
        fees: 0,
        surcharges: 0,
        currency: "RON",
      },
    }

    const result = await handler.commit(makeCtx([product]), request)

    expect(result.status).toBe("held")
    expect(createBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        optionId: null,
        itemLines: [
          { optionId: "opt_standard", optionUnitId: "unit_standard", quantity: 1 },
          { optionId: "opt_suite", optionUnitId: "unit_suite", quantity: 1 },
        ],
      }),
    )
  })

  it("threads trip-composer billing and traveler records into the booking bridge", async () => {
    const createBooking = vi.fn(async () => ({
      status: "ok" as const,
      bookingId: "book_1",
      bookingNumber: "BK-1",
    }))
    const handler = createProductsBookingHandler({ createBooking })

    const request: CommitOwnedRequest = {
      entityModule: "products",
      entityId: product.id,
      bookingId: "catalog_booking_1",
      party: {
        travelerParty: {
          billing: {
            personId: "pers_billing",
            contact: {
              firstName: "Diego",
              lastName: "Muller",
              email: "diego@example.com",
              phone: "+40700111222",
            },
          },
          travelers: [{ personId: "pers_billing" }, { personId: "pers_companion" }],
        },
      },
      draft: {
        configure: { pax: { adult: 2 } },
        travelers: [
          { firstName: "Diego", lastName: "Muller", band: "adult" },
          { firstName: "Anya", lastName: "Costa", band: "adult" },
        ],
      },
      pricing: {
        base_amount: 29000,
        taxes: 0,
        fees: 0,
        surcharges: 0,
        currency: "RON",
      },
    }

    const result = await handler.commit(makeCtx([product]), request)

    expect(result.status).toBe("held")
    expect(createBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        personId: "pers_billing",
        contactFirstName: "Diego",
        contactLastName: "Muller",
        contactEmail: "diego@example.com",
        contactPhone: "+40700111222",
        travelers: [
          expect.objectContaining({ firstName: "Diego", personId: "pers_billing" }),
          expect.objectContaining({ firstName: "Anya", personId: "pers_companion" }),
        ],
      }),
    )
  })
})
