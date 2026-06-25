import { legalTargetKindSchema } from "@voyant-travel/legal-contracts/targets/validation"
import { listResponse, listResponseSchema } from "@voyant-travel/types"
import type { InferSelectModel } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import type { legalTerms } from "../../../src/terms/schema.js"

/**
 * Response contract tests (voyant#2114) for the legal terms admin + public
 * routes. The fixture is typed as the real Drizzle `$inferSelect` row so column
 * drift breaks compilation; the JSON round-trip (Date → ISO string, §17) mirrors
 * `c.json` so a declared/actual mismatch breaks the test. The schema below
 * mirrors the response shape declared in `src/terms/routes.ts`.
 */

const isoTimestamp = z.string()
const jsonValue = z.unknown()

const legalTermSchema = z.object({
  id: z.string(),
  contractId: z.string().nullable(),
  policyVersionId: z.string().nullable(),
  targetKind: legalTargetKindSchema.nullable(),
  targetId: z.string().nullable(),
  targetProvider: z.string().nullable(),
  targetSourceRef: z.string().nullable(),
  legacyTransactionOfferId: z.string().nullable(),
  legacyTransactionOrderId: z.string().nullable(),
  termType: z.enum([
    "terms_and_conditions",
    "cancellation",
    "guarantee",
    "payment",
    "pricing",
    "commission",
    "other",
  ]),
  title: z.string(),
  body: z.string(),
  language: z.string().nullable(),
  required: z.boolean(),
  sortOrder: z.number().int(),
  acceptanceStatus: z.enum(["not_required", "pending", "accepted", "declined"]),
  acceptedAt: isoTimestamp.nullable(),
  acceptedBy: z.string().nullable(),
  metadata: jsonValue,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const createdAt = new Date("2026-01-01T00:00:00.000Z")
const updatedAt = new Date("2026-01-02T00:00:00.000Z")

const legalTermRow: InferSelectModel<typeof legalTerms> = {
  id: "order_terms_00000000000000000000000",
  contractId: "contracts_000000000000000000000000000",
  policyVersionId: null,
  targetKind: "booking",
  targetId: "bookings_000000000000000000000000000",
  targetProvider: null,
  targetSourceRef: null,
  legacyTransactionOfferId: null,
  legacyTransactionOrderId: null,
  termType: "terms_and_conditions",
  title: "Booking terms",
  body: "These are the terms and conditions for your booking.",
  language: "en",
  required: true,
  sortOrder: 0,
  acceptanceStatus: "accepted",
  acceptedAt: updatedAt,
  acceptedBy: "Ada Lovelace",
  metadata: { source: "ui" },
  createdAt,
  updatedAt,
}

describe("legal terms list response contracts", () => {
  it("the serialized legal term list satisfies the declared OpenAPI list envelope", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([legalTermRow], { total: 1, limit: 50, offset: 0 })),
    )
    const parsed = listResponseSchema(legalTermSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })
})

describe("legal terms single-entity response contracts", () => {
  it("the serialized legal term { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: legalTermRow }))
    const parsed = z.object({ data: legalTermSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the delete envelope satisfies the declared OpenAPI schema", () => {
    const parsed = z.object({ success: z.boolean() }).safeParse({ success: true })
    expect(parsed.success).toBe(true)
  })
})
