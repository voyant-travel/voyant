import { describe, expect, it } from "vitest"
import {
  insertOptionUnitPriceRuleSchema,
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
})
