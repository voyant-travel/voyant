/**
 * Accommodation content synthesizer — fallback for thin adapters that
 * declare `supportsContentFetch: false`.
 *
 * Produces the most complete `AccommodationContent` blob we can
 * legitimately synthesize from the durable sourced-entry projection +
 * locale-aware overlays + plane-level provenance. Fields the
 * projection doesn't carry render as typed empty states (`room_types:
 * []`, `rate_plans: []`).
 *
 * Per §3.6: never invents plausible-but-unverified fields ("hotels
 * usually have a pool" is not a basis for an amenity), never
 * machine-translates, never mines snapshots, never caches its own
 * output.
 */

import {
  fetchOverlaysForEntity,
  mergeOverlaysIntoContent,
  type ProvenanceReadResult,
} from "@voyantjs/catalog"
import type { AnyDrizzleDb } from "@voyantjs/db"

import {
  ACCOMMODATION_CONTENT_SCHEMA_VERSION,
  type AccommodationContent,
  accommodationContentSchema,
} from "./content-shape.js"

export interface SynthesizeAccommodationContentOptions {
  provenance: Extract<ProvenanceReadResult, { kind: "sourced" }>
  overlays?: ReadonlyArray<{ field_path: string; value: unknown }>
}

export interface SynthesizedAccommodationContent {
  content: AccommodationContent
  content_schema_version: string
  served_locale: string
  source_kind: string
  source_provider?: string
}

export function synthesizeAccommodationContent(
  scope: { locale: string },
  options: SynthesizeAccommodationContentOptions,
): SynthesizedAccommodationContent {
  const projection = options.provenance.projection
  const hotel = pickHotelSummary(projection, options.provenance)
  const amenities = pickAmenities(projection)
  const policies = pickPolicies(projection)

  const baseContent: AccommodationContent = {
    hotel,
    room_types: [],
    rate_plans: [],
    meal_plans: [],
    amenities,
    policies,
  }

  let merged = baseContent
  if (options.overlays && options.overlays.length > 0) {
    const result = mergeOverlaysIntoContent(baseContent, options.overlays, {
      validate(p) {
        const r = accommodationContentSchema.safeParse(p)
        return r.success
          ? { valid: true }
          : { valid: false, reason: r.error.issues[0]?.message ?? "invalid" }
      },
    })
    merged = accommodationContentSchema.parse(result)
  }

  return {
    content: merged,
    content_schema_version: ACCOMMODATION_CONTENT_SCHEMA_VERSION,
    served_locale: scope.locale,
    source_kind: options.provenance.provenance.source_kind,
    source_provider: options.provenance.provenance.source_provider,
  }
}

export async function synthesizeAccommodationContentFromDb(
  db: AnyDrizzleDb,
  scope: { locale: string },
  provenance: Extract<ProvenanceReadResult, { kind: "sourced" }>,
): Promise<SynthesizedAccommodationContent> {
  const entityId = entityIdFromProvenance(provenance)
  const overlays = await fetchOverlaysForEntity(db, "accommodations", entityId)
  return synthesizeAccommodationContent(scope, {
    provenance,
    overlays: overlays.map((o) => ({ field_path: o.field_path, value: o.value })),
  })
}

function entityIdFromProvenance(
  provenance: Extract<ProvenanceReadResult, { kind: "sourced" }>,
): string {
  const fromProjection = provenance.projection.id
  if (typeof fromProjection === "string" && fromProjection.length > 0) {
    return fromProjection
  }
  return provenance.entry_id
}

function pickHotelSummary(
  projection: Record<string, unknown>,
  provenance: Extract<ProvenanceReadResult, { kind: "sourced" }>,
): AccommodationContent["hotel"] {
  return {
    id: stringOr(projection.id, "") || provenance.entry_id,
    name: stringOr(projection.name, "") || stringOr(projection.title, "") || "Unnamed property",
    description: stringOr(projection.description, null),
    star_rating: numberOr(projection.star_rating, null),
    hero_image_url: stringOr(projection.hero_image_url, null),
    highlights: stringArrayOr(projection.highlights, []),
    brand: stringOr(projection.brand, null) ?? provenance.provenance.source_provider ?? null,
    country: stringOr(projection.country, null),
    city: stringOr(projection.city, null),
    address: stringOr(projection.address, null),
    postal_code: stringOr(projection.postal_code, null),
    latitude: numberOr(projection.latitude, null),
    longitude: numberOr(projection.longitude, null),
    check_in_time: stringOr(projection.check_in_time, null),
    check_out_time: stringOr(projection.check_out_time, null),
  }
}

function pickAmenities(projection: Record<string, unknown>): AccommodationContent["amenities"] {
  // Bedbanks commonly emit a flat string array for amenities. We map
  // each into the structured shape with no inferred category — that's
  // genuinely unknown without a real getContent.
  const list = projection.amenities
  if (!Array.isArray(list)) return []
  const out: AccommodationContent["amenities"] = []
  for (const item of list) {
    if (typeof item === "string" && item.length > 0) {
      out.push({
        id: slugifyAmenityId(item),
        category: null,
        name: item,
        description: null,
      })
    } else if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>
      const name = stringOr(obj.name, null) ?? stringOr(obj.label, null)
      if (!name) continue
      out.push({
        id: stringOr(obj.id, null) ?? slugifyAmenityId(name),
        category: stringOr(obj.category, null),
        name,
        description: stringOr(obj.description, null),
        is_free: typeof obj.is_free === "boolean" ? obj.is_free : undefined,
      })
    }
  }
  return out
}

function pickPolicies(projection: Record<string, unknown>): AccommodationContent["policies"] {
  const out: AccommodationContent["policies"] = []
  const cancel = stringOr(projection.cancellation_policy, null)
  if (cancel) out.push({ kind: "cancellation", body: cancel })
  const payment = stringOr(projection.payment_terms, null)
  if (payment) out.push({ kind: "payment", body: payment })
  const checkin = stringOr(projection.check_in_policy, null)
  if (checkin) out.push({ kind: "check_in", body: checkin })
  return out
}

function slugifyAmenityId(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 64) || "amenity"
  )
}

function stringOr<T>(value: unknown, fallback: T): string | T {
  return typeof value === "string" && value.length > 0 ? value : fallback
}

function numberOr<T>(value: unknown, fallback: T): number | T {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function stringArrayOr(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback
  const out = value.filter((v): v is string => typeof v === "string")
  return out.length > 0 ? out : fallback
}
