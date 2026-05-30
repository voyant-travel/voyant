import { describe, expect, it } from "vitest"
import type { z } from "zod"

import type {
  AvailabilityBadge,
  AvailabilityBadgeKind,
  AvailabilityProjection,
  AvailabilityRowKind,
  AvailabilityStatus,
  AvailabilityUnitPrecision,
  CapabilitySupport,
  PromotionApplicability,
  PromotionApplicabilityConstraint,
  PromotionApplicabilityConstraintKind,
  PromotionApplicabilityEvaluation,
  PromotionApplicabilityResolution,
  PromotionDisplayFields,
  PromotionMediaAsset,
  PromotionMediaKind,
  PromotionPriceEffect,
  PromotionStackingSemantics,
  ProviderCapabilityDeclaration,
  ProviderCapabilityKey,
  ProviderPromotion,
} from "./contract.js"
import {
  availabilityBadgeKindSchema,
  availabilityBadgeSchema,
  availabilityProjectionSchema,
  availabilityRowKindSchema,
  availabilityStatusSchema,
  availabilityUnitPrecisionSchema,
  capabilitySupportSchema,
  promotionApplicabilityConstraintKindSchema,
  promotionApplicabilityConstraintSchema,
  promotionApplicabilityEvaluationSchema,
  promotionApplicabilityResolutionSchema,
  promotionApplicabilitySchema,
  promotionDisplayFieldsSchema,
  promotionMediaAssetSchema,
  promotionMediaKindSchema,
  promotionPriceEffectSchema,
  promotionStackingSemanticsSchema,
  providerCapabilityDeclarationSchema,
  providerCapabilityKeySchema,
  providerPromotionSchema,
} from "./schemas.js"

type AssertEquivalent<Actual, Expected> = Actual extends Expected
  ? Expected extends Actual
    ? true
    : never
  : never

const typeChecks: [
  AssertEquivalent<z.infer<typeof capabilitySupportSchema>, CapabilitySupport>,
  AssertEquivalent<z.infer<typeof providerCapabilityKeySchema>, ProviderCapabilityKey>,
  AssertEquivalent<
    z.infer<typeof providerCapabilityDeclarationSchema>,
    ProviderCapabilityDeclaration
  >,
  AssertEquivalent<
    z.infer<typeof promotionApplicabilityEvaluationSchema>,
    PromotionApplicabilityEvaluation
  >,
  AssertEquivalent<z.infer<typeof promotionPriceEffectSchema>, PromotionPriceEffect>,
  AssertEquivalent<
    z.infer<typeof promotionApplicabilityConstraintKindSchema>,
    PromotionApplicabilityConstraintKind
  >,
  AssertEquivalent<
    z.infer<typeof promotionApplicabilityResolutionSchema>,
    PromotionApplicabilityResolution
  >,
  AssertEquivalent<
    z.infer<typeof promotionApplicabilityConstraintSchema>,
    PromotionApplicabilityConstraint
  >,
  AssertEquivalent<z.infer<typeof promotionApplicabilitySchema>, PromotionApplicability>,
  AssertEquivalent<z.infer<typeof promotionMediaKindSchema>, PromotionMediaKind>,
  AssertEquivalent<z.infer<typeof promotionMediaAssetSchema>, PromotionMediaAsset>,
  AssertEquivalent<z.infer<typeof promotionDisplayFieldsSchema>, PromotionDisplayFields>,
  AssertEquivalent<z.infer<typeof promotionStackingSemanticsSchema>, PromotionStackingSemantics>,
  AssertEquivalent<z.infer<typeof providerPromotionSchema>, ProviderPromotion>,
  AssertEquivalent<z.infer<typeof availabilityRowKindSchema>, AvailabilityRowKind>,
  AssertEquivalent<z.infer<typeof availabilityUnitPrecisionSchema>, AvailabilityUnitPrecision>,
  AssertEquivalent<z.infer<typeof availabilityStatusSchema>, AvailabilityStatus>,
  AssertEquivalent<z.infer<typeof availabilityBadgeKindSchema>, AvailabilityBadgeKind>,
  AssertEquivalent<z.infer<typeof availabilityBadgeSchema>, AvailabilityBadge>,
  AssertEquivalent<z.infer<typeof availabilityProjectionSchema>, AvailabilityProjection>,
] = [
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
]
void typeChecks

const providerCapabilityDeclaration: ProviderCapabilityDeclaration = {
  capability: "offer_applicability_evaluation",
  support: "unknown",
  reason: "loyalty eligibility depends on shopper session context",
}

const promotionApplicabilityConstraint: PromotionApplicabilityConstraint = {
  kind: "fare_code",
  resolution: "not_evaluable_locally",
  values: ["PAST-GUEST"],
  requires_customer_context: true,
  reason: "provider does not link every sale row to a specific offer row",
}

const promotionApplicability: PromotionApplicability = {
  evaluation: "not_evaluable_locally",
  price_effect: "informational_only",
  constraints: [promotionApplicabilityConstraint],
}

const promotionMediaAsset: PromotionMediaAsset = {
  kind: "hero",
  url: "https://example.com/offers/hero.jpg",
  alt_text: "River cruise promotion",
  width: 1600,
  height: 900,
}

const promotionDisplayFields: PromotionDisplayFields = {
  display_name: "Past Guest Savings",
  subtitle: "Exclusive loyalty pricing",
  rich_description: "<p>Save on selected departures.</p>",
  terms_and_conditions: "Eligibility required.",
  media: [promotionMediaAsset],
  featured: true,
  display_priority: 10,
}

const providerPromotion: ProviderPromotion = {
  source_offer_id: "offer_123",
  source_offer_ref: "PG-2026",
  provider: "uniworld",
  display: promotionDisplayFields,
  applicability: promotionApplicability,
  stacking: "unknown",
  raw_payload: { offerCode: "PG-2026" },
}

const availabilityBadge: AvailabilityBadge = {
  kind: "low_availability",
  label: "Only 3 left",
}

const availabilityProjection: AvailabilityProjection = {
  row_kind: "category",
  row_id: "suite-deluxe",
  available_units: 3,
  precision: "category_count",
  status: "low",
  low_availability_threshold: 4,
  badge: availabilityBadge,
  sort_priority: 20,
  source_updated_at: "2026-05-30T00:00:00Z",
}

const roundTripCases = [
  ["capabilitySupportSchema", capabilitySupportSchema, "unsupported" satisfies CapabilitySupport],
  [
    "providerCapabilityKeySchema",
    providerCapabilityKeySchema,
    "physical_inventory_units" satisfies ProviderCapabilityKey,
  ],
  [
    "providerCapabilityDeclarationSchema",
    providerCapabilityDeclarationSchema,
    providerCapabilityDeclaration,
  ],
  [
    "promotionApplicabilityEvaluationSchema",
    promotionApplicabilityEvaluationSchema,
    "not_evaluable_locally" satisfies PromotionApplicabilityEvaluation,
  ],
  [
    "promotionPriceEffectSchema",
    promotionPriceEffectSchema,
    "informational_only" satisfies PromotionPriceEffect,
  ],
  [
    "promotionApplicabilityConstraintKindSchema",
    promotionApplicabilityConstraintKindSchema,
    "customer_session" satisfies PromotionApplicabilityConstraintKind,
  ],
  [
    "promotionApplicabilityResolutionSchema",
    promotionApplicabilityResolutionSchema,
    "customer_context_required" satisfies PromotionApplicabilityResolution,
  ],
  [
    "promotionApplicabilityConstraintSchema",
    promotionApplicabilityConstraintSchema,
    promotionApplicabilityConstraint,
  ],
  ["promotionApplicabilitySchema", promotionApplicabilitySchema, promotionApplicability],
  ["promotionMediaKindSchema", promotionMediaKindSchema, "primary" satisfies PromotionMediaKind],
  ["promotionMediaAssetSchema", promotionMediaAssetSchema, promotionMediaAsset],
  ["promotionDisplayFieldsSchema", promotionDisplayFieldsSchema, promotionDisplayFields],
  [
    "promotionStackingSemanticsSchema",
    promotionStackingSemanticsSchema,
    "provider_defined" satisfies PromotionStackingSemantics,
  ],
  ["providerPromotionSchema", providerPromotionSchema, providerPromotion],
  ["availabilityRowKindSchema", availabilityRowKindSchema, "sailing" satisfies AvailabilityRowKind],
  [
    "availabilityUnitPrecisionSchema",
    availabilityUnitPrecisionSchema,
    "category_count" satisfies AvailabilityUnitPrecision,
  ],
  ["availabilityStatusSchema", availabilityStatusSchema, "sold_out" satisfies AvailabilityStatus],
  [
    "availabilityBadgeKindSchema",
    availabilityBadgeKindSchema,
    "low_availability" satisfies AvailabilityBadgeKind,
  ],
  ["availabilityBadgeSchema", availabilityBadgeSchema, availabilityBadge],
  ["availabilityProjectionSchema", availabilityProjectionSchema, availabilityProjection],
] as const

const invalidCases = [
  ["capabilitySupportSchema", capabilitySupportSchema, "partial"],
  ["providerCapabilityKeySchema", providerCapabilityKeySchema, "deck_plans"],
  [
    "providerCapabilityDeclarationSchema",
    providerCapabilityDeclarationSchema,
    { ...providerCapabilityDeclaration, support: "partial" },
  ],
  ["promotionApplicabilityEvaluationSchema", promotionApplicabilityEvaluationSchema, "local"],
  ["promotionPriceEffectSchema", promotionPriceEffectSchema, "discount"],
  [
    "promotionApplicabilityConstraintKindSchema",
    promotionApplicabilityConstraintKindSchema,
    "tier",
  ],
  ["promotionApplicabilityResolutionSchema", promotionApplicabilityResolutionSchema, "maybe"],
  [
    "promotionApplicabilityConstraintSchema",
    promotionApplicabilityConstraintSchema,
    { ...promotionApplicabilityConstraint, values: [123] },
  ],
  [
    "promotionApplicabilitySchema",
    promotionApplicabilitySchema,
    { ...promotionApplicability, constraints: undefined },
  ],
  ["promotionMediaKindSchema", promotionMediaKindSchema, "banner"],
  [
    "promotionMediaAssetSchema",
    promotionMediaAssetSchema,
    { ...promotionMediaAsset, url: "image" },
  ],
  [
    "promotionDisplayFieldsSchema",
    promotionDisplayFieldsSchema,
    { ...promotionDisplayFields, media: [{ ...promotionMediaAsset, width: 0 }] },
  ],
  ["promotionStackingSemanticsSchema", promotionStackingSemanticsSchema, "combinable"],
  [
    "providerPromotionSchema",
    providerPromotionSchema,
    { ...providerPromotion, source_offer_id: 123 },
  ],
  ["availabilityRowKindSchema", availabilityRowKindSchema, "cabin"],
  ["availabilityUnitPrecisionSchema", availabilityUnitPrecisionSchema, "estimated"],
  ["availabilityStatusSchema", availabilityStatusSchema, "limited"],
  ["availabilityBadgeKindSchema", availabilityBadgeKindSchema, "few_left"],
  ["availabilityBadgeSchema", availabilityBadgeSchema, { kind: "few_left" }],
  [
    "availabilityProjectionSchema",
    availabilityProjectionSchema,
    { ...availabilityProjection, available_units: -1 },
  ],
] as const

describe("provider catalog contract schemas", () => {
  it.each(roundTripCases)("parses %s fixtures without changing shape", (_name, schema, value) => {
    expect(schema.parse(value)).toEqual(value)
  })

  it.each(invalidCases)("rejects invalid %s fixtures", (_name, schema, value) => {
    expect(schema.safeParse(value).success).toBe(false)
  })
})
