import { listResponse, listResponseSchema } from "@voyant-travel/types"
import type { InferSelectModel } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import type {
  tripComponents,
  tripEnvelopes,
  tripRequirements,
  tripSnapshots,
} from "../src/schema.js"

/**
 * Response contract tests (voyant#2114 / voyant#2208) for the trips
 * (Travel Composer) OpenAPI routes. Each fixture is typed as the real Drizzle
 * row so column drift breaks compilation; the JSON round-trip (Date → ISO
 * string) mirrors `c.json` so a declared/actual response mismatch breaks the
 * test. The schemas below mirror the row shapes declared in `routes.ts`
 * (deeply-composed sub-objects are modeled as opaque pass-throughs).
 */

const isoTimestamp = z.string()
const jsonObject = z.record(z.string(), z.unknown())

const tripEnvelopeRowSchema = z.object({
  id: z.string(),
  status: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  travelerParty: jsonObject,
  constraints: jsonObject,
  aggregateCurrency: z.string().nullable(),
  aggregateSubtotalAmountCents: z.number().int().nullable(),
  aggregateTaxAmountCents: z.number().int().nullable(),
  aggregateTotalAmountCents: z.number().int().nullable(),
  aggregatePricingSnapshot: z.unknown().nullable(),
  currentPriceExpiresAt: isoTimestamp.nullable(),
  bookingGroupId: z.string().nullable(),
  orderId: z.string().nullable(),
  paymentSessionId: z.string().nullable(),
  reserveIdempotencyKey: z.string().nullable(),
  reserveStartedAt: isoTimestamp.nullable(),
  reservedAt: isoTimestamp.nullable(),
  checkoutIdempotencyKey: z.string().nullable(),
  checkoutStartedAt: isoTimestamp.nullable(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const tripComponentRowSchema = z.object({
  id: z.string(),
  envelopeId: z.string(),
  sequence: z.number().int(),
  kind: z.string(),
  status: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  entityModule: z.string().nullable(),
  entityId: z.string().nullable(),
  sourceKind: z.string().nullable(),
  sourceConnectionId: z.string().nullable(),
  sourceRef: z.string().nullable(),
  bookingDraftId: z.string().nullable(),
  catalogQuoteId: z.string().nullable(),
  bookingId: z.string().nullable(),
  bookingGroupId: z.string().nullable(),
  orderId: z.string().nullable(),
  paymentSessionId: z.string().nullable(),
  providerRef: z.string().nullable(),
  supplierRef: z.string().nullable(),
  componentCurrency: z.string().nullable(),
  componentSubtotalAmountCents: z.number().int().nullable(),
  componentTaxAmountCents: z.number().int().nullable(),
  componentTotalAmountCents: z.number().int().nullable(),
  pricingSnapshot: z.unknown().nullable(),
  taxLines: z.array(z.unknown()).nullable(),
  cancellationSnapshot: z.unknown().nullable(),
  holdToken: z.string().nullable(),
  holdExpiresAt: isoTimestamp.nullable(),
  priceExpiresAt: isoTimestamp.nullable(),
  warningCodes: z.array(z.string()),
  metadata: jsonObject,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const tripRequirementRowSchema = z.object({
  id: z.string(),
  envelopeId: z.string(),
  sequence: z.number().int(),
  status: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  vertical: z.string(),
  criteria: jsonObject,
  criteriaVersion: z.string(),
  required: z.boolean(),
  selectedCandidateId: z.string().nullable(),
  resolvedComponentId: z.string().nullable(),
  lastSourcedAt: isoTimestamp.nullable(),
  metadata: jsonObject,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const tripSnapshotRowSchema = z.object({
  id: z.string(),
  envelopeId: z.string(),
  sourceEnvelopeUpdatedAt: isoTimestamp,
  titleSnapshot: z.string().nullable(),
  descriptionSnapshot: z.string().nullable(),
  travelerPartySnapshot: jsonObject,
  constraintsSnapshot: jsonObject,
  currency: z.string(),
  subtotalAmountCents: z.number().int(),
  taxAmountCents: z.number().int(),
  totalAmountCents: z.number().int(),
  componentCount: z.number().int(),
  pricedComponentCount: z.number().int(),
  frozenEnvelope: z.unknown(),
  frozenComponents: z.array(z.unknown()),
  proposal: z.unknown(),
  createdBy: z.string().nullable(),
  createdAt: isoTimestamp,
})

const tripAggregateSchema = z.object({
  envelope: tripEnvelopeRowSchema,
  components: z.array(tripComponentRowSchema),
})

const createdAt = new Date("2026-01-01T00:00:00.000Z")
const updatedAt = new Date("2026-01-02T00:00:00.000Z")

const envelopeRow: InferSelectModel<typeof tripEnvelopes> = {
  id: "trip_envelopes_000000000000000000000",
  status: "draft",
  title: "Honeymoon",
  description: null,
  travelerParty: {},
  constraints: {},
  aggregateCurrency: "EUR",
  aggregateSubtotalAmountCents: 10000,
  aggregateTaxAmountCents: 1900,
  aggregateTotalAmountCents: 11900,
  aggregatePricingSnapshot: {
    currency: "EUR",
    subtotalAmountCents: 10000,
    taxAmountCents: 1900,
    totalAmountCents: 11900,
    componentCount: 1,
    pricedComponentCount: 1,
  },
  currentPriceExpiresAt: updatedAt,
  bookingGroupId: null,
  orderId: null,
  paymentSessionId: null,
  reserveIdempotencyKey: null,
  reserveStartedAt: null,
  reservedAt: null,
  checkoutIdempotencyKey: null,
  checkoutStartedAt: null,
  createdBy: "user_1",
  updatedBy: null,
  createdAt,
  updatedAt,
}

const componentRow: InferSelectModel<typeof tripComponents> = {
  id: "trip_components_000000000000000000000",
  envelopeId: "trip_envelopes_000000000000000000000",
  sequence: 0,
  kind: "catalog_booking",
  status: "priced",
  title: "Hotel",
  description: null,
  entityModule: "products",
  entityId: "prod_1",
  sourceKind: "owned",
  sourceConnectionId: null,
  sourceRef: null,
  bookingDraftId: null,
  catalogQuoteId: null,
  bookingId: null,
  bookingGroupId: null,
  orderId: null,
  paymentSessionId: null,
  providerRef: null,
  supplierRef: null,
  componentCurrency: "EUR",
  componentSubtotalAmountCents: 10000,
  componentTaxAmountCents: 1900,
  componentTotalAmountCents: 11900,
  pricingSnapshot: {
    currency: "EUR",
    subtotalAmountCents: 10000,
    taxAmountCents: 1900,
    totalAmountCents: 11900,
  },
  taxLines: [],
  cancellationSnapshot: null,
  holdToken: null,
  holdExpiresAt: null,
  priceExpiresAt: updatedAt,
  warningCodes: [],
  metadata: {},
  createdAt,
  updatedAt,
}

const requirementRow: InferSelectModel<typeof tripRequirements> = {
  id: "trip_requirements_0000000000000000000",
  envelopeId: "trip_envelopes_000000000000000000000",
  sequence: 0,
  status: "open",
  title: "3-night stay in Cairo",
  description: null,
  vertical: "accommodation",
  criteria: { nights: 3, adults: 2 },
  criteriaVersion: "v1",
  required: true,
  selectedCandidateId: null,
  resolvedComponentId: null,
  lastSourcedAt: null,
  metadata: {},
  createdAt,
  updatedAt,
}

const snapshotRow: InferSelectModel<typeof tripSnapshots> = {
  id: "trip_snapshots_000000000000000000000",
  envelopeId: "trip_envelopes_000000000000000000000",
  sourceEnvelopeUpdatedAt: updatedAt,
  titleSnapshot: "Honeymoon",
  descriptionSnapshot: null,
  travelerPartySnapshot: {},
  constraintsSnapshot: {},
  currency: "EUR",
  subtotalAmountCents: 10000,
  taxAmountCents: 1900,
  totalAmountCents: 11900,
  componentCount: 1,
  pricedComponentCount: 1,
  frozenEnvelope: { id: "trip_envelopes_000000000000000000000" },
  frozenComponents: [],
  proposal: {
    envelopeId: "trip_envelopes_000000000000000000000",
    title: "Honeymoon",
    description: null,
    currency: "EUR",
    subtotalAmountCents: 10000,
    taxAmountCents: 1900,
    totalAmountCents: 11900,
    componentCount: 1,
    pricedComponentCount: 1,
    warnings: [],
    frozenAt: updatedAt.toISOString(),
    lines: [],
  },
  createdBy: "user_1",
  createdAt,
}

const singleCases = [
  ["trip envelope", tripEnvelopeRowSchema, envelopeRow],
  ["trip component", tripComponentRowSchema, componentRow],
  ["trip requirement", tripRequirementRowSchema, requirementRow],
  ["trip snapshot", tripSnapshotRowSchema, snapshotRow],
] as const

describe("trips single-entity response contracts", () => {
  for (const [label, schema, row] of singleCases) {
    it(`the serialized ${label} { data } envelope satisfies the declared OpenAPI schema`, () => {
      const wire = JSON.parse(JSON.stringify({ data: row }))
      const parsed = z.object({ data: schema }).safeParse(wire)
      expect(parsed.success ? null : parsed.error.toString()).toBeNull()
    })
  }
})

describe("trips list response contract", () => {
  it("the serialized list of { envelope, components } aggregates satisfies the declared schema", () => {
    const aggregate = { envelope: envelopeRow, components: [componentRow] }
    const wire = JSON.parse(
      JSON.stringify(listResponse([aggregate], { total: 1, limit: 50, offset: 0 })),
    )
    const parsed = listResponseSchema(tripAggregateSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })
})
