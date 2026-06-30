import { RequestValidationError } from "@voyant-travel/hono"
import { describe, expect, it, vi } from "vitest"

import { coreProductsService } from "../../src/service-core.js"
import { itineraryProductsService } from "../../src/service-itinerary.js"
import { optionProductsService } from "../../src/service-options.js"

function fakeSelectDb(selectRows: unknown[][]) {
  return {
    select: vi.fn(() => {
      const rows = selectRows.shift() ?? []
      const builder = {
        from: vi.fn(() => builder),
        innerJoin: vi.fn(() => builder),
        where: vi.fn(() => builder),
        limit: vi.fn(() => Promise.resolve(rows)),
      }
      return builder
    }),
    insert: vi.fn(() => {
      throw new Error("insert should not be reached")
    }),
    update: vi.fn(() => {
      throw new Error("update should not be reached")
    }),
  }
}

function uniqueDayNumberError() {
  return {
    code: "23505",
    constraint: "uidx_product_days_itinerary_day_number",
    message:
      'duplicate key value violates unique constraint "uidx_product_days_itinerary_day_number"',
  }
}

function wrappedUniqueDayNumberError() {
  return new Error("Failed query", { cause: uniqueDayNumberError() })
}

function fakeDayWriteConflictDb(selectRows: unknown[][], operation: "insert" | "update") {
  const db = fakeSelectDb(selectRows)
  const builder = {
    values: vi.fn(() => builder),
    set: vi.fn(() => builder),
    where: vi.fn(() => builder),
    returning: vi.fn(() => Promise.reject(wrappedUniqueDayNumberError())),
  }

  if (operation === "insert") {
    return { ...db, insert: vi.fn(() => builder) }
  }

  return { ...db, update: vi.fn(() => builder) }
}

function expectInvalidRequest(error: unknown, path: string[], message: string) {
  expect(error).toBeInstanceOf(RequestValidationError)
  expect(error).toMatchObject({
    details: {
      issues: [expect.objectContaining({ path, message })],
    },
  })
}

async function expectRejectsInvalidRequest(
  action: () => Promise<unknown>,
  path: string[],
  message: string,
) {
  try {
    await action()
  } catch (error) {
    expectInvalidRequest(error, path, message)
    return
  }

  throw new Error("Expected RequestValidationError")
}

describe("inventory service range validation", () => {
  it("rejects product create when startDate is after endDate", async () => {
    await expectRejectsInvalidRequest(
      () =>
        coreProductsService.createProduct(
          {} as never,
          {
            name: "Backward dates",
            sellCurrency: "EUR",
            startDate: "2026-09-10",
            endDate: "2026-09-01",
          } as never,
        ),
      ["endDate"],
      "endDate must be on or after startDate",
    )
  })

  it("rejects product update when the merged date range is inverted", async () => {
    const db = fakeSelectDb([
      [
        {
          id: "product_1",
          bookingMode: "date",
          status: "draft",
          visibility: "private",
          activated: false,
          startDate: "2026-09-10",
          endDate: "2026-09-20",
        },
      ],
    ])

    await expectRejectsInvalidRequest(
      () =>
        coreProductsService.updateProduct(db as never, "product_1", {
          endDate: "2026-09-01",
        } as never),
      ["endDate"],
      "endDate must be on or after startDate",
    )
  })

  it("rejects product option create when availableFrom is after availableTo", async () => {
    await expectRejectsInvalidRequest(
      () =>
        optionProductsService.createOption({} as never, "product_1", {
          name: "Shoulder season",
          availableFrom: "2026-10-01",
          availableTo: "2026-05-01",
        } as never),
      ["availableTo"],
      "availableTo must be on or after availableFrom",
    )
  })

  it("rejects product option update when the merged availability range is inverted", async () => {
    const db = fakeSelectDb([
      [
        {
          id: "option_1",
          productId: "product_1",
          availableFrom: "2026-10-01",
          availableTo: "2026-12-01",
        },
      ],
    ])

    await expectRejectsInvalidRequest(
      () =>
        optionProductsService.updateOption(db as never, "option_1", {
          availableTo: "2026-05-01",
        } as never),
      ["availableTo"],
      "availableTo must be on or after availableFrom",
    )
  })

  it("rejects option unit update when the merged quantity range is inverted", async () => {
    const db = fakeSelectDb([
      [
        {
          unitType: "person",
          minQuantity: 5,
          maxQuantity: 10,
          minAge: null,
          maxAge: null,
          occupancyMin: null,
          occupancyMax: null,
        },
      ],
    ])

    await expectRejectsInvalidRequest(
      () => optionProductsService.updateUnit(db as never, "unit_1", { maxQuantity: 2 } as never),
      ["maxQuantity"],
      "maxQuantity must be ≥ minQuantity",
    )
  })
})

describe("inventory itinerary day validation", () => {
  it("rejects duplicate dayNumber on itinerary day create", async () => {
    const db = fakeSelectDb([[{ id: "itinerary_1", productId: "product_1" }], [{ id: "day_1" }]])

    await expectRejectsInvalidRequest(
      () =>
        itineraryProductsService.createItineraryDay(db as never, "product_1", "itinerary_1", {
          dayNumber: 1,
        }),
      ["dayNumber"],
      "dayNumber must be unique within itinerary",
    )
  })

  it("rejects duplicate dayNumber on day update within the same itinerary", async () => {
    const db = fakeSelectDb([
      [{ id: "day_2", itineraryId: "itinerary_1", productId: "product_1" }],
      [{ id: "day_1" }],
    ])

    await expectRejectsInvalidRequest(
      () => itineraryProductsService.updateDay(db as never, "day_2", { dayNumber: 1 }),
      ["dayNumber"],
      "dayNumber must be unique within itinerary",
    )
  })

  it("maps concurrent duplicate dayNumber insert conflicts to validation errors", async () => {
    const db = fakeDayWriteConflictDb(
      [[{ id: "itinerary_1", productId: "product_1" }], []],
      "insert",
    )

    await expectRejectsInvalidRequest(
      () =>
        itineraryProductsService.createItineraryDay(db as never, "product_1", "itinerary_1", {
          dayNumber: 1,
        }),
      ["dayNumber"],
      "dayNumber must be unique within itinerary",
    )
  })

  it("maps concurrent duplicate dayNumber update conflicts to validation errors", async () => {
    const db = fakeDayWriteConflictDb(
      [[{ id: "day_2", itineraryId: "itinerary_1", productId: "product_1" }], []],
      "update",
    )

    await expectRejectsInvalidRequest(
      () => itineraryProductsService.updateDay(db as never, "day_2", { dayNumber: 1 }),
      ["dayNumber"],
      "dayNumber must be unique within itinerary",
    )
  })
})
