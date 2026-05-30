export type CapabilitySupport = "supported" | "unsupported" | "unknown"

export type ProviderCapabilityKey =
  | "category_availability_counts"
  | "physical_inventory_units"
  | "inventory_assignment_selection"
  | "price_ranges"
  | "offer_applicability_evaluation"
  | "promotion_media"
  | "promotion_stacking_rules"

/**
 * Normalized capability / limitation declaration for a provider connection.
 * Use explicit `unsupported` rows for meaningful negative facts so SDKs and
 * UI surfaces do not infer precision the upstream feed does not expose.
 */
export interface ProviderCapabilityDeclaration {
  capability: ProviderCapabilityKey
  support: CapabilitySupport
  /** Optional vertical, product family, or upstream scope the declaration applies to. */
  applies_to?: ReadonlyArray<string>
  /** Human-oriented diagnostic for operators and integration authors. */
  reason?: string
  /** Provider field, endpoint, docs section, or sync observation behind this declaration. */
  evidence?: string
  source_updated_at?: Date | string
}

export type PromotionApplicabilityEvaluation = "evaluable" | "not_evaluable_locally" | "unknown"

export type PromotionPriceEffect = "price_affecting" | "informational_only" | "unknown"

export type PromotionApplicabilityConstraintKind =
  | "loyalty"
  | "solo_traveler"
  | "market"
  | "language"
  | "currency"
  | "fare_code"
  | "passenger_occupancy"
  | "booking_window"
  | "travel_window"
  | "customer_session"

export type PromotionApplicabilityResolution =
  | "eligible"
  | "ineligible"
  | "customer_context_required"
  | "not_evaluable_locally"
  | "unknown"

/**
 * One normalized applicability rule from a provider promotion row. The shape
 * is intentionally value-bagged because upstreams vary: fare-code lists,
 * loyalty tiers, markets, occupancy bounds, and date windows can all be
 * represented without pretending the catalog plane can evaluate every rule.
 */
export interface PromotionApplicabilityConstraint {
  kind: PromotionApplicabilityConstraintKind
  resolution: PromotionApplicabilityResolution
  values?: ReadonlyArray<string>
  min?: number
  max?: number
  starts_at?: Date | string
  ends_at?: Date | string
  requires_customer_context?: boolean
  reason?: string
}

export interface PromotionApplicability {
  evaluation: PromotionApplicabilityEvaluation
  price_effect: PromotionPriceEffect
  constraints: ReadonlyArray<PromotionApplicabilityConstraint>
}

export type PromotionMediaKind = "hero" | "primary" | "thumbnail" | "logo" | "other"

export interface PromotionMediaAsset {
  kind: PromotionMediaKind
  url: string
  alt_text?: string
  mime_type?: string
  width?: number
  height?: number
}

export interface PromotionDisplayFields {
  display_name?: string
  subtitle?: string
  rich_description?: string
  terms_and_conditions?: string
  media?: ReadonlyArray<PromotionMediaAsset>
  featured?: boolean
  display_priority?: number
}

export type PromotionStackingSemantics = "stackable" | "exclusive" | "provider_defined" | "unknown"

export interface ProviderPromotion {
  source_offer_id: string
  source_offer_ref?: string
  provider?: string
  display?: PromotionDisplayFields
  applicability: PromotionApplicability
  stacking: PromotionStackingSemantics
  raw_payload?: Record<string, unknown>
}

export type AvailabilityRowKind = "entity" | "departure" | "sailing" | "category" | "fare" | "other"

export type AvailabilityUnitPrecision =
  | "exact"
  | "category_count"
  | "lower_bound"
  | "upper_bound"
  | "unknown"

export type AvailabilityStatus =
  | "available"
  | "low"
  | "unavailable"
  | "sold_out"
  | "on_request"
  | "unknown"

export type AvailabilityBadgeKind =
  | "available"
  | "low_availability"
  | "sold_out"
  | "on_request"
  | "unknown"

export interface AvailabilityBadge {
  kind: AvailabilityBadgeKind
  label?: string
}

/**
 * Search/detail projection for normalized inventory counts. `available_units`
 * may be exact, category-level, a bound, or unknown; callers must respect the
 * `precision` before rendering exact cabin/seat/unit claims.
 */
export interface AvailabilityProjection {
  row_kind: AvailabilityRowKind
  row_id?: string
  available_units: number | null
  precision: AvailabilityUnitPrecision
  status: AvailabilityStatus
  low_availability_threshold?: number | null
  badge?: AvailabilityBadge
  /** Stable numeric ordering hint for indexers; lower values sort first. */
  sort_priority?: number
  source_updated_at?: Date | string
}
