import { listResponse, listResponseSchema } from "@voyant-travel/types"
import type { InferSelectModel } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import type {
  offerExpirationEvents,
  offerRefreshRuns,
  sellabilityExplanations,
  sellabilityPolicies,
  sellabilityPolicyResults,
  sellabilitySnapshotItems,
  sellabilitySnapshots,
} from "../../src/sellability/schema.js"
import {
  offerExpirationEventStatusSchema,
  offerRefreshRunStatusSchema,
  sellabilityExplanationTypeSchema,
  sellabilityPolicyResultStatusSchema,
  sellabilityPolicyScopeSchema,
  sellabilityPolicyTypeSchema,
  sellabilitySnapshotStatusSchema,
} from "../../src/sellability/validation.js"

/**
 * Response contract tests (voyant#2114) for the commerce sellability admin
 * routes. Each table-backed fixture is typed as the real Drizzle `$inferSelect`
 * row so column drift breaks compilation; the JSON round-trip (Date → ISO
 * string) mirrors `c.json` so a declared/actual mismatch breaks the test. The
 * schemas below mirror the response shapes declared in
 * `src/sellability/routes.ts` (§17 dates → strings; jsonb → records). Every LIST
 * leg goes through the shared `paginate(...)` → `{ data, total, limit, offset }`
 * envelope, so list cases assert `listResponseSchema(...)`; single-entity legs
 * assert the `{ data }` envelope.
 */

const isoTimestamp = z.string()
const jsonRecord = z.record(z.string(), z.unknown())

const snapshotComponentKindSchema = z.enum(["base", "unit", "pickup", "start_time_adjustment"])

const snapshotSchema = z.object({
  id: z.string(),
  offerId: z.string().nullable(),
  marketId: z.string().nullable(),
  channelId: z.string().nullable(),
  productId: z.string().nullable(),
  optionId: z.string().nullable(),
  slotId: z.string().nullable(),
  requestedCurrencyCode: z.string().nullable(),
  sourceCurrencyCode: z.string().nullable(),
  fxRateSetId: z.string().nullable(),
  status: sellabilitySnapshotStatusSchema,
  queryPayload: jsonRecord,
  pricingSummary: jsonRecord,
  expiresAt: isoTimestamp.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const snapshotItemSchema = z.object({
  id: z.string(),
  snapshotId: z.string(),
  candidateIndex: z.number(),
  componentIndex: z.number(),
  productId: z.string().nullable(),
  optionId: z.string().nullable(),
  slotId: z.string().nullable(),
  unitId: z.string().nullable(),
  requestRef: z.string().nullable(),
  componentKind: snapshotComponentKindSchema,
  title: z.string(),
  quantity: z.number(),
  pricingMode: z.string(),
  pricingCategoryId: z.string().nullable(),
  pricingCategoryName: z.string().nullable(),
  unitName: z.string().nullable(),
  unitType: z.string().nullable(),
  currencyCode: z.string(),
  sellAmountCents: z.number(),
  costAmountCents: z.number(),
  sourceRuleId: z.string().nullable(),
  tierId: z.string().nullable(),
  isSelected: z.boolean(),
  createdAt: isoTimestamp,
})

const policySchema = z.object({
  id: z.string(),
  name: z.string(),
  scope: sellabilityPolicyScopeSchema,
  policyType: sellabilityPolicyTypeSchema,
  productId: z.string().nullable(),
  optionId: z.string().nullable(),
  marketId: z.string().nullable(),
  channelId: z.string().nullable(),
  priority: z.number(),
  active: z.boolean(),
  conditions: jsonRecord,
  effects: jsonRecord,
  notes: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const policyResultSchema = z.object({
  id: z.string(),
  snapshotId: z.string(),
  snapshotItemId: z.string().nullable(),
  policyId: z.string().nullable(),
  candidateIndex: z.number(),
  status: sellabilityPolicyResultStatusSchema,
  message: z.string().nullable(),
  details: jsonRecord.nullable(),
  createdAt: isoTimestamp,
})

const offerRefreshRunSchema = z.object({
  id: z.string(),
  offerId: z.string(),
  snapshotId: z.string().nullable(),
  status: offerRefreshRunStatusSchema,
  startedAt: isoTimestamp,
  completedAt: isoTimestamp.nullable(),
  notes: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const offerExpirationEventSchema = z.object({
  id: z.string(),
  offerId: z.string(),
  snapshotId: z.string().nullable(),
  expiresAt: isoTimestamp,
  expiredAt: isoTimestamp.nullable(),
  status: offerExpirationEventStatusSchema,
  reason: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const explanationSchema = z.object({
  id: z.string(),
  snapshotId: z.string(),
  snapshotItemId: z.string().nullable(),
  candidateIndex: z.number(),
  explanationType: sellabilityExplanationTypeSchema,
  code: z.string().nullable(),
  message: z.string(),
  details: jsonRecord.nullable(),
  createdAt: isoTimestamp,
})

const createdAt = new Date("2026-01-01T00:00:00.000Z")
const updatedAt = new Date("2026-01-02T00:00:00.000Z")

const snapshotRow: InferSelectModel<typeof sellabilitySnapshots> = {
  id: "sellability_snapshots_0000000000000000000",
  offerId: "offers_000000000000000000000000000",
  marketId: "markets_00000000000000000000000000",
  channelId: "channels_0000000000000000000000000",
  productId: "products_0000000000000000000000000",
  optionId: "product_options_00000000000000000000",
  slotId: "slots_0000000000000000000000000000",
  requestedCurrencyCode: "EUR",
  sourceCurrencyCode: "RON",
  fxRateSetId: null,
  status: "resolved",
  queryPayload: { productId: "products_0000000000000000000000000" },
  pricingSummary: { totalCandidates: 1, selectedCandidateIndex: null },
  expiresAt: null,
  createdAt,
  updatedAt,
}

const snapshotItemRow: InferSelectModel<typeof sellabilitySnapshotItems> = {
  id: "sellability_snapshot_items_000000000000",
  snapshotId: "sellability_snapshots_0000000000000000000",
  candidateIndex: 0,
  componentIndex: 0,
  productId: "products_0000000000000000000000000",
  optionId: "product_options_00000000000000000000",
  slotId: "slots_0000000000000000000000000000",
  unitId: null,
  requestRef: null,
  componentKind: "base",
  title: "Adult",
  quantity: 1,
  pricingMode: "per_booking",
  pricingCategoryId: null,
  pricingCategoryName: null,
  unitName: null,
  unitType: null,
  currencyCode: "EUR",
  sellAmountCents: 12000,
  costAmountCents: 8000,
  sourceRuleId: null,
  tierId: null,
  isSelected: true,
  createdAt,
}

const policyRow: InferSelectModel<typeof sellabilityPolicies> = {
  id: "sellability_policies_000000000000000000",
  name: "Min party size",
  scope: "global",
  policyType: "occupancy",
  productId: null,
  optionId: null,
  marketId: null,
  channelId: null,
  priority: 10,
  active: true,
  conditions: { min: 2 },
  effects: { block: true },
  notes: "Require at least two travelers",
  metadata: { source: "ui" },
  createdAt,
  updatedAt,
}

const policyResultRow: InferSelectModel<typeof sellabilityPolicyResults> = {
  id: "sellability_policy_results_000000000000",
  snapshotId: "sellability_snapshots_0000000000000000000",
  snapshotItemId: "sellability_snapshot_items_000000000000",
  policyId: "sellability_policies_000000000000000000",
  candidateIndex: 0,
  status: "passed",
  message: null,
  details: { evaluated: true },
  createdAt,
}

const offerRefreshRunRow: InferSelectModel<typeof offerRefreshRuns> = {
  id: "offer_refresh_runs_0000000000000000000",
  offerId: "offers_000000000000000000000000000",
  snapshotId: "sellability_snapshots_0000000000000000000",
  status: "completed",
  startedAt: createdAt,
  completedAt: updatedAt,
  notes: null,
  metadata: null,
  createdAt,
  updatedAt,
}

const offerExpirationEventRow: InferSelectModel<typeof offerExpirationEvents> = {
  id: "offer_expiration_events_00000000000000",
  offerId: "offers_000000000000000000000000000",
  snapshotId: "sellability_snapshots_0000000000000000000",
  expiresAt: updatedAt,
  expiredAt: null,
  status: "scheduled",
  reason: null,
  metadata: null,
  createdAt,
  updatedAt,
}

const explanationRow: InferSelectModel<typeof sellabilityExplanations> = {
  id: "sellability_explanations_0000000000000",
  snapshotId: "sellability_snapshots_0000000000000000000",
  snapshotItemId: null,
  candidateIndex: 0,
  explanationType: "policy",
  code: "min_party_size",
  message: "Requires at least two travelers",
  details: null,
  createdAt,
}

const cases = [
  ["sellability snapshot", snapshotSchema, snapshotRow],
  ["sellability snapshot item", snapshotItemSchema, snapshotItemRow],
  ["sellability policy", policySchema, policyRow],
  ["sellability policy result", policyResultSchema, policyResultRow],
  ["offer refresh run", offerRefreshRunSchema, offerRefreshRunRow],
  ["offer expiration event", offerExpirationEventSchema, offerExpirationEventRow],
  ["sellability explanation", explanationSchema, explanationRow],
] as const

describe("commerce sellability list response contracts", () => {
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

describe("commerce sellability single-entity response contracts", () => {
  for (const [label, schema, row] of cases) {
    it(`the serialized ${label} { data } envelope satisfies the declared OpenAPI schema`, () => {
      const wire = JSON.parse(JSON.stringify({ data: row }))
      const parsed = z.object({ data: schema }).safeParse(wire)
      expect(parsed.success ? null : parsed.error.toString()).toBeNull()
    })
  }
})
