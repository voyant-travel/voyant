import { listResponse, listResponseSchema } from "@voyant-travel/types"
import type { InferSelectModel } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import type { priceCatalogs, priceSchedules } from "./schema-catalogs.js"
import type { pricingCategories, pricingCategoryDependencies } from "./schema-categories.js"
import type { cancellationPolicies, cancellationPolicyRules } from "./schema-policies.js"

/**
 * Response contract tests (voyant#2114) for the pricing-core admin routes. Each
 * fixture is typed as the real Drizzle row so column drift breaks compilation;
 * the JSON round-trip (Date → ISO string, `date` columns → strings) mirrors
 * `c.json` so a declared/actual mismatch breaks the test. The schemas below
 * mirror the response shapes declared in `routes-core.ts`.
 */

const isoTimestamp = z.string()
const metadataSchema = z.record(z.string(), z.unknown()).nullable()

const pricingCategorySchema = z.object({
  id: z.string(),
  productId: z.string().nullable(),
  optionId: z.string().nullable(),
  unitId: z.string().nullable(),
  code: z.string().nullable(),
  name: z.string(),
  categoryType: z.string(),
  seatOccupancy: z.number().int(),
  groupSize: z.number().int().nullable(),
  isAgeQualified: z.boolean(),
  minAge: z.number().int().nullable(),
  maxAge: z.number().int().nullable(),
  internalUseOnly: z.boolean(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  metadata: metadataSchema,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const pricingCategoryDependencySchema = z.object({
  id: z.string(),
  pricingCategoryId: z.string(),
  masterPricingCategoryId: z.string(),
  dependencyType: z.string(),
  maxPerMaster: z.number().int().nullable(),
  maxDependentSum: z.number().int().nullable(),
  active: z.boolean(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const cancellationPolicySchema = z.object({
  id: z.string(),
  code: z.string().nullable(),
  name: z.string(),
  policyType: z.string(),
  simpleCutoffHours: z.number().int().nullable(),
  isDefault: z.boolean(),
  active: z.boolean(),
  notes: z.string().nullable(),
  metadata: metadataSchema,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const cancellationPolicyRuleSchema = z.object({
  id: z.string(),
  cancellationPolicyId: z.string(),
  sortOrder: z.number().int(),
  cutoffMinutesBefore: z.number().int().nullable(),
  chargeType: z.string(),
  chargeAmountCents: z.number().int().nullable(),
  chargePercentBasisPoints: z.number().int().nullable(),
  active: z.boolean(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const priceCatalogSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  currencyCode: z.string().nullable(),
  catalogType: z.string(),
  isDefault: z.boolean(),
  active: z.boolean(),
  notes: z.string().nullable(),
  metadata: metadataSchema,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const priceScheduleSchema = z.object({
  id: z.string(),
  priceCatalogId: z.string(),
  code: z.string().nullable(),
  name: z.string(),
  recurrenceRule: z.string(),
  timezone: z.string().nullable(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
  weekdays: z.array(z.string()).nullable(),
  priority: z.number().int(),
  active: z.boolean(),
  notes: z.string().nullable(),
  metadata: metadataSchema,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const createdAt = new Date("2026-01-01T00:00:00.000Z")
const updatedAt = new Date("2026-01-02T00:00:00.000Z")

const pricingCategoryRow: InferSelectModel<typeof pricingCategories> = {
  id: "pricing_categories_000000000000000000",
  productId: null,
  optionId: null,
  unitId: null,
  code: "ADULT",
  name: "Adult",
  categoryType: "other",
  seatOccupancy: 1,
  groupSize: null,
  isAgeQualified: false,
  minAge: null,
  maxAge: null,
  internalUseOnly: false,
  active: true,
  sortOrder: 0,
  metadata: null,
  createdAt,
  updatedAt,
}

const pricingCategoryDependencyRow: InferSelectModel<typeof pricingCategoryDependencies> = {
  id: "pricing_category_dependencies_00000000",
  pricingCategoryId: "pricing_categories_000000000000000000",
  masterPricingCategoryId: "pricing_categories_111111111111111111",
  dependencyType: "requires",
  maxPerMaster: null,
  maxDependentSum: null,
  active: true,
  notes: null,
  createdAt,
  updatedAt,
}

const cancellationPolicyRow: InferSelectModel<typeof cancellationPolicies> = {
  id: "cancellation_policies_0000000000000000",
  code: "STD",
  name: "Standard",
  policyType: "custom",
  simpleCutoffHours: 48,
  isDefault: false,
  active: true,
  notes: null,
  metadata: null,
  createdAt,
  updatedAt,
}

const cancellationPolicyRuleRow: InferSelectModel<typeof cancellationPolicyRules> = {
  id: "cancellation_policy_rules_000000000000",
  cancellationPolicyId: "cancellation_policies_0000000000000000",
  sortOrder: 0,
  cutoffMinutesBefore: 2880,
  chargeType: "none",
  chargeAmountCents: null,
  chargePercentBasisPoints: null,
  active: true,
  notes: null,
  createdAt,
  updatedAt,
}

const priceCatalogRow: InferSelectModel<typeof priceCatalogs> = {
  id: "price_catalogs_00000000000000000000000",
  code: "PUBLIC",
  name: "Public",
  currencyCode: null,
  catalogType: "public",
  isDefault: true,
  active: true,
  notes: null,
  metadata: null,
  createdAt,
  updatedAt,
}

const priceScheduleRow: InferSelectModel<typeof priceSchedules> = {
  id: "price_schedules_0000000000000000000000",
  priceCatalogId: "price_catalogs_00000000000000000000000",
  code: null,
  name: "High season",
  recurrenceRule: "FREQ=DAILY",
  timezone: "Europe/Bucharest",
  validFrom: "2026-06-01",
  validTo: "2026-09-30",
  weekdays: ["monday", "tuesday"],
  priority: 0,
  active: true,
  notes: null,
  metadata: null,
  createdAt,
  updatedAt,
}

const cases = [
  ["pricing category", pricingCategorySchema, pricingCategoryRow],
  ["pricing category dependency", pricingCategoryDependencySchema, pricingCategoryDependencyRow],
  ["cancellation policy", cancellationPolicySchema, cancellationPolicyRow],
  ["cancellation policy rule", cancellationPolicyRuleSchema, cancellationPolicyRuleRow],
  ["price catalog", priceCatalogSchema, priceCatalogRow],
  ["price schedule", priceScheduleSchema, priceScheduleRow],
] as const

describe("pricing-core list response contracts", () => {
  for (const [label, schema, row] of cases) {
    it(`the serialized ${label} list satisfies the declared OpenAPI schema`, () => {
      const wire = JSON.parse(
        JSON.stringify(listResponse([row], { total: 1, limit: 50, offset: 0 })),
      )
      const parsed = listResponseSchema(schema).safeParse(wire)
      expect(parsed.success ? null : parsed.error.toString()).toBeNull()
    })
  }
})

describe("pricing-core single-entity response contracts", () => {
  for (const [label, schema, row] of cases) {
    it(`the serialized ${label} { data } envelope satisfies the declared OpenAPI schema`, () => {
      const wire = JSON.parse(JSON.stringify({ data: row }))
      const parsed = z.object({ data: schema }).safeParse(wire)
      expect(parsed.success ? null : parsed.error.toString()).toBeNull()
    })
  }

  it("the delete envelope satisfies the declared OpenAPI schema", () => {
    const parsed = z.object({ success: z.boolean() }).safeParse({ success: true })
    expect(parsed.success).toBe(true)
  })
})
