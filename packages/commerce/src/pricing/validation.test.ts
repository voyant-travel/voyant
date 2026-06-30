import { describe, expect, it } from "vitest"
import {
  insertOptionPriceRuleSchema,
  insertOptionUnitPriceRuleSchema,
  insertPriceScheduleSchema,
  insertPricingCategorySchema,
  updateCancellationPolicyRuleSchema,
  updateCancellationPolicySchema,
  updateDeparturePriceOverrideSchema,
  updateDropoffPriceRuleSchema,
  updateExtraPriceRuleSchema,
  updateOptionPriceRuleSchema,
  updateOptionStartTimeRuleSchema,
  updateOptionUnitPriceRuleSchema,
  updateOptionUnitTierSchema,
  updatePickupPriceRuleSchema,
  updatePriceCatalogSchema,
  updatePriceScheduleSchema,
  updatePricingCategoryDependencySchema,
  updatePricingCategorySchema,
  validateMergedOptionPriceRule,
  validateMergedOptionUnitPriceRule,
  validateMergedPriceSchedule,
  validateMergedPricingCategory,
} from "./validation.js"

const updateCases = [
  ["pricing category", updatePricingCategorySchema, { name: "Adult" }],
  [
    "pricing category dependency",
    updatePricingCategoryDependencySchema,
    { notes: "Requires adult" },
  ],
  ["cancellation policy", updateCancellationPolicySchema, { name: "Standard" }],
  ["cancellation policy rule", updateCancellationPolicyRuleSchema, { notes: "Manual review" }],
  ["price catalog", updatePriceCatalogSchema, { name: "Public" }],
  ["price schedule", updatePriceScheduleSchema, { name: "High season" }],
  ["option price rule", updateOptionPriceRuleSchema, { baseSellAmountCents: 69000 }],
  ["option unit price rule", updateOptionUnitPriceRuleSchema, { sellAmountCents: 69000 }],
  ["option start time rule", updateOptionStartTimeRuleSchema, { sellAdjustmentCents: 1000 }],
  ["option unit tier", updateOptionUnitTierSchema, { sellAmountCents: 12000 }],
  ["pickup price rule", updatePickupPriceRuleSchema, { sellAmountCents: 3000 }],
  ["dropoff price rule", updateDropoffPriceRuleSchema, { sellAmountCents: 3000 }],
  ["extra price rule", updateExtraPriceRuleSchema, { sellAmountCents: 5000 }],
  ["departure price override", updateDeparturePriceOverrideSchema, { sellAmountCents: 75000 }],
] as const

describe("pricing update validation", () => {
  for (const [label, schema, patch] of updateCases) {
    it(`does not apply core defaults when parsing a partial ${label} patch`, () => {
      expect(schema.parse(patch)).toEqual(patch)
    })
  }

  it("keeps defaults on insert schemas", () => {
    expect(
      insertOptionUnitPriceRuleSchema.parse({
        optionPriceRuleId: "option_price_rules_0000000000000000000",
        optionId: "option_00000000000000000000000000000",
        unitId: "unit_000000000000000000000000000000000",
      }),
    ).toMatchObject({
      pricingMode: "per_unit",
      active: true,
      sortOrder: 0,
    })
  })

  it("rejects pricing category age ranges where minAge is greater than maxAge", () => {
    const result = insertPricingCategorySchema.safeParse({
      name: "Senior",
      isAgeQualified: true,
      minAge: 70,
      maxAge: 12,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ["maxAge"], message: "maxAge must be ≥ minAge" }),
        ]),
      )
    }
  })

  it("accepts pricing category age ranges where minAge equals maxAge", () => {
    expect(
      insertPricingCategorySchema.parse({
        name: "Exact age",
        isAgeQualified: true,
        minAge: 18,
        maxAge: 18,
      }),
    ).toMatchObject({ minAge: 18, maxAge: 18 })
  })

  it("rejects price schedules with validFrom later than validTo", () => {
    const result = insertPriceScheduleSchema.safeParse({
      priceCatalogId: "price_catalogs_00000000000000000000000",
      name: "Inverted season",
      recurrenceRule: "FREQ=DAILY",
      validFrom: "2026-09-30",
      validTo: "2026-06-01",
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ["validTo"], message: "validTo must be ≥ validFrom" }),
        ]),
      )
    }
  })

  it("rejects price schedules with malformed recurrenceRule", () => {
    const result = insertPriceScheduleSchema.safeParse({
      priceCatalogId: "price_catalogs_00000000000000000000000",
      name: "Malformed recurrence",
      recurrenceRule: "not a rule",
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["recurrenceRule"],
            message: "recurrenceRule must be a valid RRULE",
          }),
        ]),
      )
    }
  })

  it("accepts price schedules where validFrom equals validTo and the RRULE is valid", () => {
    expect(
      insertPriceScheduleSchema.parse({
        priceCatalogId: "price_catalogs_00000000000000000000000",
        name: "Single day",
        recurrenceRule: "FREQ=DAILY",
        validFrom: "2026-06-01",
        validTo: "2026-06-01",
      }),
    ).toMatchObject({ validFrom: "2026-06-01", validTo: "2026-06-01" })
  })

  it("rejects option price rules where minPerBooking is greater than maxPerBooking", () => {
    const result = insertOptionPriceRuleSchema.safeParse({
      productId: "product_0000000000000000000000000000",
      optionId: "option_00000000000000000000000000000",
      priceCatalogId: "price_catalogs_00000000000000000000000",
      name: "Impossible booking range",
      minPerBooking: 8,
      maxPerBooking: 2,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["maxPerBooking"],
            message: "maxPerBooking must be ≥ minPerBooking",
          }),
        ]),
      )
    }
  })

  it("accepts option price rules where minPerBooking equals maxPerBooking", () => {
    expect(
      insertOptionPriceRuleSchema.parse({
        productId: "product_0000000000000000000000000000",
        optionId: "option_00000000000000000000000000000",
        priceCatalogId: "price_catalogs_00000000000000000000000",
        name: "Exact booking range",
        minPerBooking: 2,
        maxPerBooking: 2,
      }),
    ).toMatchObject({ minPerBooking: 2, maxPerBooking: 2 })
  })

  it("rejects option unit price rules where minQuantity is greater than maxQuantity", () => {
    const result = insertOptionUnitPriceRuleSchema.safeParse({
      optionPriceRuleId: "option_price_rules_0000000000000000000",
      optionId: "option_00000000000000000000000000000",
      unitId: "unit_000000000000000000000000000000000",
      minQuantity: 10,
      maxQuantity: 3,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["maxQuantity"],
            message: "maxQuantity must be ≥ minQuantity",
          }),
        ]),
      )
    }
  })

  it("accepts option unit price rules where minQuantity equals maxQuantity", () => {
    expect(
      insertOptionUnitPriceRuleSchema.parse({
        optionPriceRuleId: "option_price_rules_0000000000000000000",
        optionId: "option_00000000000000000000000000000",
        unitId: "unit_000000000000000000000000000000000",
        minQuantity: 4,
        maxQuantity: 4,
      }),
    ).toMatchObject({ minQuantity: 4, maxQuantity: 4 })
  })

  it("validates merged pricing ranges for partial updates", () => {
    expect(validateMergedPricingCategory({ minAge: 70, maxAge: 12 })).toEqual({
      ok: false,
      issues: [{ path: ["maxAge"], message: "maxAge must be ≥ minAge" }],
    })
    expect(
      validateMergedPriceSchedule({
        recurrenceRule: "FREQ=DAILY",
        validFrom: "2026-09-30",
        validTo: "2026-06-01",
      }),
    ).toEqual({
      ok: false,
      issues: [{ path: ["validTo"], message: "validTo must be ≥ validFrom" }],
    })
    expect(validateMergedOptionPriceRule({ minPerBooking: 8, maxPerBooking: 2 })).toEqual({
      ok: false,
      issues: [{ path: ["maxPerBooking"], message: "maxPerBooking must be ≥ minPerBooking" }],
    })
    expect(validateMergedOptionUnitPriceRule({ minQuantity: 10, maxQuantity: 3 })).toEqual({
      ok: false,
      issues: [{ path: ["maxQuantity"], message: "maxQuantity must be ≥ minQuantity" }],
    })
  })
})
