import { legalTargetKindSchema } from "@voyant-travel/legal-contracts/targets/validation"
import { listResponse, listResponseSchema } from "@voyant-travel/types"
import type { InferSelectModel } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import type {
  policies,
  policyAcceptances,
  policyAssignments,
  policyRules,
  policyVersions,
} from "../../../src/policies/schema.js"

/**
 * Response contract tests (voyant#2114) for the legal policies admin + public
 * routes. Each fixture is typed as the real Drizzle `$inferSelect` row so column
 * drift breaks compilation; the JSON round-trip (Date → ISO string, `date`
 * columns → strings, §17) mirrors `c.json` so a declared/actual mismatch breaks
 * the test. The schemas below mirror the response shapes declared in
 * `src/policies/routes.ts`.
 */

const isoTimestamp = z.string()
const jsonValue = z.unknown()

const policySchema = z.object({
  id: z.string(),
  kind: z.enum([
    "cancellation",
    "payment",
    "terms_and_conditions",
    "privacy",
    "refund",
    "commission",
    "guarantee",
    "other",
  ]),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  language: z.string(),
  currentVersionId: z.string().nullable(),
  metadata: jsonValue,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const policyVersionSchema = z.object({
  id: z.string(),
  policyId: z.string(),
  version: z.number().int(),
  status: z.enum(["draft", "published", "retired"]),
  title: z.string(),
  body: z.string().nullable(),
  publishedAt: isoTimestamp.nullable(),
  publishedBy: z.string().nullable(),
  retiredAt: isoTimestamp.nullable(),
  metadata: jsonValue,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const policyRuleSchema = z.object({
  id: z.string(),
  policyVersionId: z.string(),
  ruleType: z.enum(["window", "percentage", "flat_amount", "date_range", "custom"]),
  label: z.string().nullable(),
  daysBeforeDeparture: z.number().int().nullable(),
  refundPercent: z.number().int().nullable(),
  refundType: z.enum(["cash", "credit", "cash_or_credit", "none"]).nullable(),
  flatAmountCents: z.number().int().nullable(),
  currency: z.string().nullable(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
  conditions: jsonValue,
  sortOrder: z.number().int(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const policyAssignmentSchema = z.object({
  id: z.string(),
  policyId: z.string(),
  scope: z.enum(["product", "channel", "supplier", "market", "organization", "global"]),
  productId: z.string().nullable(),
  channelId: z.string().nullable(),
  supplierId: z.string().nullable(),
  marketId: z.string().nullable(),
  organizationId: z.string().nullable(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
  priority: z.number().int(),
  metadata: jsonValue,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const policyAcceptanceSchema = z.object({
  id: z.string(),
  policyVersionId: z.string(),
  personId: z.string().nullable(),
  bookingId: z.string().nullable(),
  targetKind: legalTargetKindSchema.nullable(),
  targetId: z.string().nullable(),
  targetProvider: z.string().nullable(),
  targetSourceRef: z.string().nullable(),
  legacyTransactionOfferId: z.string().nullable(),
  legacyTransactionOrderId: z.string().nullable(),
  acceptedAt: isoTimestamp,
  acceptedBy: z.string().nullable(),
  method: z.enum(["implicit", "explicit_checkbox", "signature"]),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  metadata: jsonValue,
  createdAt: isoTimestamp,
})

const createdAt = new Date("2026-01-01T00:00:00.000Z")
const updatedAt = new Date("2026-01-02T00:00:00.000Z")

const policyRow: InferSelectModel<typeof policies> = {
  id: "policies_0000000000000000000000000",
  kind: "cancellation",
  name: "Standard cancellation",
  slug: "standard-cancellation",
  description: "Default cancellation policy",
  language: "en",
  currentVersionId: "policy_versions_000000000000000000",
  metadata: { source: "ui" },
  createdAt,
  updatedAt,
}

const policyVersionRow: InferSelectModel<typeof policyVersions> = {
  id: "policy_versions_000000000000000000",
  policyId: "policies_0000000000000000000000000",
  version: 1,
  status: "published",
  title: "Cancellation terms v1",
  body: "Cancel up to 30 days for a full refund.",
  publishedAt: updatedAt,
  publishedBy: "users_00000000000000000000000000000",
  retiredAt: null,
  metadata: null,
  createdAt,
  updatedAt,
}

const policyRuleRow: InferSelectModel<typeof policyRules> = {
  id: "policy_rules_0000000000000000000000",
  policyVersionId: "policy_versions_000000000000000000",
  ruleType: "window",
  label: "30+ days",
  daysBeforeDeparture: 30,
  refundPercent: 10000,
  refundType: "cash",
  flatAmountCents: null,
  currency: "EUR",
  validFrom: "2026-01-01",
  validTo: "2026-12-31",
  conditions: null,
  sortOrder: 0,
  createdAt,
  updatedAt,
}

const policyAssignmentRow: InferSelectModel<typeof policyAssignments> = {
  id: "policy_assignments_00000000000000000",
  policyId: "policies_0000000000000000000000000",
  scope: "product",
  productId: "products_000000000000000000000000",
  channelId: null,
  supplierId: null,
  marketId: null,
  organizationId: null,
  validFrom: "2026-01-01",
  validTo: null,
  priority: 10,
  metadata: null,
  createdAt,
  updatedAt,
}

const policyAcceptanceRow: InferSelectModel<typeof policyAcceptances> = {
  id: "policy_acceptances_00000000000000000",
  policyVersionId: "policy_versions_000000000000000000",
  personId: "people_00000000000000000000000000000",
  bookingId: "bookings_000000000000000000000000000",
  targetKind: "booking",
  targetId: "bookings_000000000000000000000000000",
  targetProvider: null,
  targetSourceRef: null,
  legacyTransactionOfferId: null,
  legacyTransactionOrderId: null,
  acceptedAt: createdAt,
  acceptedBy: "Ada Lovelace",
  method: "explicit_checkbox",
  ipAddress: "203.0.113.4",
  userAgent: "Mozilla/5.0",
  metadata: null,
  createdAt,
}

const listCases = [
  ["policy", policySchema, policyRow],
  ["policy assignment", policyAssignmentSchema, policyAssignmentRow],
  ["policy acceptance", policyAcceptanceSchema, policyAcceptanceRow],
] as const

const singleCases = [
  ["policy", policySchema, policyRow],
  ["policy version", policyVersionSchema, policyVersionRow],
  ["policy rule", policyRuleSchema, policyRuleRow],
  ["policy assignment", policyAssignmentSchema, policyAssignmentRow],
  ["policy acceptance", policyAcceptanceSchema, policyAcceptanceRow],
] as const

const arrayEnvelopeCases = [
  ["policy versions", policyVersionSchema, policyVersionRow],
  ["policy rules", policyRuleSchema, policyRuleRow],
] as const

describe("legal policies list response contracts", () => {
  for (const [label, schema, row] of listCases) {
    it(`the serialized ${label} list satisfies the declared OpenAPI list envelope`, () => {
      const wire = JSON.parse(
        JSON.stringify(listResponse([row], { total: 1, limit: 50, offset: 0 })),
      )
      const parsed = listResponseSchema(schema).safeParse(wire)
      expect(parsed.success ? null : parsed.error.toString()).toBeNull()
    })
  }
})

describe("legal policies single-entity response contracts", () => {
  for (const [label, schema, row] of singleCases) {
    it(`the serialized ${label} { data } envelope satisfies the declared OpenAPI schema`, () => {
      const wire = JSON.parse(JSON.stringify({ data: row }))
      const parsed = z.object({ data: schema }).safeParse(wire)
      expect(parsed.success ? null : parsed.error.toString()).toBeNull()
    })
  }
})

describe("legal policies array { data } envelope response contracts", () => {
  for (const [label, schema, row] of arrayEnvelopeCases) {
    it(`the serialized ${label} { data } array envelope satisfies the declared OpenAPI schema`, () => {
      const wire = JSON.parse(JSON.stringify({ data: [row] }))
      const parsed = z.object({ data: z.array(schema) }).safeParse(wire)
      expect(parsed.success ? null : parsed.error.toString()).toBeNull()
    })
  }
})

describe("legal policies public response contracts", () => {
  it("the public { policy, version } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify({ data: { policy: policyRow, version: policyVersionRow } }),
    )
    const parsed = z
      .object({ data: z.object({ policy: policySchema, version: policyVersionSchema }) })
      .safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the delete envelope satisfies the declared OpenAPI schema", () => {
    const parsed = z.object({ success: z.boolean() }).safeParse({ success: true })
    expect(parsed.success).toBe(true)
  })
})
