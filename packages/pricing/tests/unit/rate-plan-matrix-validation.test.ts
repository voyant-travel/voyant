import { describe, expect, it } from "vitest"

import { importRatePlanMatrix } from "../../src/service-rate-plan-matrix.js"
import { ratePlanMatrixImportSchema } from "../../src/validation.js"

const emptySelectChain = {
  from: () => ({
    where: () => ({
      limit: async () => [],
    }),
  }),
}

const fakeTx = {
  select: () => emptySelectChain,
}

const fakeDb = {
  transaction: async <T>(callback: (tx: typeof fakeTx) => Promise<T>) => callback(fakeTx),
}

describe("ratePlanMatrixImportSchema", () => {
  it("accepts a dry-run rate-plan matrix import", () => {
    const parsed = ratePlanMatrixImportSchema.parse({
      productId: "prod_123",
      optionId: "popt_123",
      priceCatalogId: "pcat_123",
      schedules: [
        {
          code: "SUMMER-2026",
          name: "Summer 2026",
          recurrenceRule: "FREQ=DAILY",
        },
      ],
      pricingCategories: [
        {
          code: "DBL",
          name: "Double room",
          categoryType: "room",
          seatOccupancy: 2,
        },
      ],
      ratePlans: [
        {
          code: "SUMMER-DBL-BB",
          name: "Summer double BB",
          scheduleCode: "SUMMER-2026",
          pricingMode: "per_person",
          unitPrices: [
            {
              unitId: "ounit_123",
              categoryCode: "DBL",
              sellAmountCents: 129900,
            },
          ],
        },
      ],
    })

    expect(parsed.dryRun).toBe(true)
    expect(parsed.mode).toBe("upsert")
    expect(parsed.ratePlans[0]?.allPricingCategories).toBe(false)
  })

  it("rejects an empty import payload", () => {
    const result = ratePlanMatrixImportSchema.safeParse({
      productId: "prod_123",
      optionId: "popt_123",
      priceCatalogId: "pcat_123",
    })

    expect(result.success).toBe(false)
  })

  it("rejects unit price cells under per-booking rate plans", () => {
    const result = ratePlanMatrixImportSchema.safeParse({
      productId: "prod_123",
      optionId: "popt_123",
      priceCatalogId: "pcat_123",
      ratePlans: [
        {
          code: "GROUP",
          name: "Group rate",
          pricingMode: "per_booking",
          unitPrices: [{ unitId: "ounit_123", sellAmountCents: 129900 }],
        },
      ],
    })

    expect(result.success).toBe(false)
  })

  it("rejects rate plans that provide both scheduleCode and priceScheduleId", () => {
    const result = ratePlanMatrixImportSchema.safeParse({
      productId: "prod_123",
      optionId: "popt_123",
      priceCatalogId: "pcat_123",
      ratePlans: [
        {
          code: "SUMMER-DBL-BB",
          name: "Summer double BB",
          scheduleCode: "SUMMER-2026",
          priceScheduleId: "psch_123",
        },
      ],
    })

    expect(result.success).toBe(false)
  })

  it("dry-runs rate plans that reference schedules and categories from the same payload", async () => {
    const parsed = ratePlanMatrixImportSchema.parse({
      productId: "prod_123",
      optionId: "popt_123",
      priceCatalogId: "pcat_123",
      schedules: [
        {
          code: "SUMMER-2026",
          name: "Summer 2026",
          recurrenceRule: "FREQ=DAILY",
        },
      ],
      pricingCategories: [
        {
          code: "DBL",
          name: "Double room",
          categoryType: "room",
          seatOccupancy: 2,
        },
      ],
      ratePlans: [
        {
          code: "SUMMER-DBL-BB",
          name: "Summer double BB",
          scheduleCode: "SUMMER-2026",
          pricingMode: "per_person",
          unitPrices: [
            {
              unitId: "ounit_123",
              categoryCode: "DBL",
              sellAmountCents: 129900,
            },
          ],
        },
      ],
    })

    const result = await importRatePlanMatrix(fakeDb as never, parsed)

    expect(result.summary.schedules).toMatchObject({ created: 1, updated: 0 })
    expect(result.summary.pricingCategories).toMatchObject({ created: 1, updated: 0 })
    expect(result.summary.ratePlans).toMatchObject({ created: 1, updated: 0 })
    expect(result.summary.unitPrices).toMatchObject({ created: 1, updated: 0 })
  })

  it("rejects dry-run references to unknown schedule codes", async () => {
    const parsed = ratePlanMatrixImportSchema.parse({
      productId: "prod_123",
      optionId: "popt_123",
      priceCatalogId: "pcat_123",
      ratePlans: [
        {
          code: "SUMMER-DBL-BB",
          name: "Summer double BB",
          scheduleCode: "MISSING",
          pricingMode: "per_person",
        },
      ],
    })

    await expect(importRatePlanMatrix(fakeDb as never, parsed)).rejects.toThrow(
      "Unknown price schedule code: MISSING",
    )
  })
})
