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

describe("createProductsBookingHandler component choices", () => {
  it("prices selected internal component choices through their option/unit pricing refs", async () => {
    const loadResolvedOptionPrice = vi.fn(
      async (): Promise<ResolvedOptionPrice> => ({
        baseSellAmountCents: 25000,
        unitPrices: [
          {
            unitId: "ount_double",
            unitType: "room",
            travelerCategory: null,
            sellAmountCents: 28000,
          },
        ],
      }),
    )
    const handler = createProductsBookingHandler({
      createBooking: vi.fn(),
      loadSlotDate: async () => "2026-07-15",
      loadProductComponents: async () => [
        {
          componentId: "pcmp_room",
          componentKind: "accommodation",
          title: "Room choice",
          selection: "choose_one",
          commitmentBoundary: "internal",
          priceDisposition: "included",
          choices: [
            {
              id: "double",
              title: "Double room",
              pricingRef: { optionId: "popt_room", optionUnitId: "ount_double" },
            },
          ],
        },
      ],
      loadResolvedOptionPrice,
    })

    const result = await handler.computeQuote(
      makeCtx([product]),
      baseRequest({
        configure: {
          departureSlotId: "slot_1",
          componentSelections: [{ componentId: "pcmp_room", choiceId: "double", quantity: 2 }],
        },
      }),
    )

    expect(loadResolvedOptionPrice).toHaveBeenCalledWith(expect.anything(), {
      productId: product.id,
      optionId: "popt_room",
      date: "2026-07-15",
    })
    const breakdown = result.pricing?.breakdown as Record<string, unknown>
    expect(breakdown?.total).toBe(56000)
    const lines = breakdown?.lines as Array<{ label: string; quantity: number; unitAmount: number }>
    expect(lines[0]).toEqual(
      expect.objectContaining({
        label: "Double room",
        quantity: 2,
        unitAmount: 28000,
      }),
    )
    expect(result.shape?.configureSubSteps?.some((step) => step.kind === "component-choice")).toBe(
      true,
    )
  })

  it("does not fold independent component choices into the core product quote", async () => {
    const loadResolvedOptionPrice = vi.fn(async (): Promise<ResolvedOptionPrice | null> => null)
    const handler = createProductsBookingHandler({
      createBooking: vi.fn(),
      loadSlotDate: async () => "2026-07-15",
      loadProductComponents: async () => [
        {
          componentId: "pcmp_excursion",
          componentKind: "activity",
          title: "Optional excursion",
          selection: "optional",
          commitmentBoundary: "independent_component",
          priceDisposition: "add_on",
          choices: [
            {
              id: "excursion",
              title: "Rafting",
              pricingRef: { optionId: "popt_excursion", optionUnitId: "ount_excursion" },
            },
          ],
        },
      ],
      loadResolvedOptionPrice,
    })

    const result = await handler.computeQuote(
      makeCtx([product]),
      baseRequest({
        configure: {
          departureSlotId: "slot_1",
          componentSelections: [
            { componentId: "pcmp_excursion", choiceId: "excursion", quantity: 1 },
          ],
        },
      }),
    )

    expect(loadResolvedOptionPrice).not.toHaveBeenCalled()
    const breakdown = result.pricing?.breakdown as Record<string, unknown>
    expect(breakdown?.total).toBe(14500)
    expect(result.shape?.configureSubSteps?.some((step) => step.kind === "component-choice")).toBe(
      true,
    )
  })

  it("commits selected internal component choices as existing option/unit item lines", async () => {
    const createBooking = vi.fn(async () => ({
      status: "ok" as const,
      bookingId: "book_1",
      bookingNumber: "BK-1",
    }))
    const handler = createProductsBookingHandler({
      createBooking,
      loadProductComponents: async () => [
        {
          componentId: "pcmp_room",
          componentKind: "accommodation",
          title: "Room choice",
          selection: "choose_one",
          commitmentBoundary: "internal",
          priceDisposition: "included",
          choices: [
            {
              id: "double",
              title: "Double room",
              pricingRef: { optionId: "popt_room", optionUnitId: "ount_double" },
            },
          ],
        },
      ],
    })

    const request: CommitOwnedRequest = {
      entityModule: "products",
      entityId: product.id,
      bookingId: "catalog_booking_1",
      draft: {
        configure: {
          componentSelections: [{ componentId: "pcmp_room", choiceId: "double", quantity: 2 }],
        },
      },
      pricing: {
        base_amount: 56000,
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
        optionId: "popt_room",
        itemLines: [{ optionId: "popt_room", optionUnitId: "ount_double", quantity: 2 }],
      }),
    )
  })

  it("does not commit independent component choices as core booking item lines", async () => {
    const createBooking = vi.fn(async () => ({
      status: "ok" as const,
      bookingId: "book_1",
      bookingNumber: "BK-1",
    }))
    const handler = createProductsBookingHandler({
      createBooking,
      loadProductComponents: async () => [
        {
          componentId: "pcmp_excursion",
          componentKind: "activity",
          title: "Optional excursion",
          selection: "optional",
          commitmentBoundary: "independent_component",
          priceDisposition: "add_on",
          choices: [
            {
              id: "excursion",
              title: "Rafting",
              pricingRef: { optionId: "popt_excursion", optionUnitId: "ount_excursion" },
            },
          ],
        },
      ],
    })

    const request: CommitOwnedRequest = {
      entityModule: "products",
      entityId: product.id,
      bookingId: "catalog_booking_1",
      draft: {
        configure: {
          componentSelections: [
            { componentId: "pcmp_excursion", choiceId: "excursion", quantity: 1 },
          ],
        },
      },
      pricing: {
        base_amount: 14500,
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
        itemLines: undefined,
      }),
    )
  })
})
