/**
 * Cruise content synthesizer — fallback for thin adapters that declare
 * `supportsContentFetch: false`.
 *
 * Produces the most complete `CruiseContent` blob we can legitimately
 * synthesize from the durable sourced-entry projection + locale-aware
 * overlays + plane-level provenance. Fields the projection doesn't
 * carry render as typed empty states (`sailings: []`,
 * `cabin_categories: []`).
 *
 * Per §3.6: never invents plausible-but-unverified fields, never
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
  CRUISES_CONTENT_SCHEMA_VERSION,
  type CruiseContent,
  cruiseContentSchema,
} from "./content-shape.js"

export interface SynthesizeCruiseContentOptions {
  provenance: Extract<ProvenanceReadResult, { kind: "sourced" }>
  overlays?: ReadonlyArray<{ field_path: string; value: unknown }>
}

export interface SynthesizedCruiseContent {
  content: CruiseContent
  content_schema_version: string
  served_locale: string
  source_kind: string
  source_provider?: string
}

export function synthesizeCruiseContent(
  scope: { locale: string },
  options: SynthesizeCruiseContentOptions,
): SynthesizedCruiseContent {
  const projection = options.provenance.projection
  const cruise = pickCruiseSummary(projection, options.provenance)
  const ship = pickShip(projection)
  const itinerary = pickItineraryStops(projection)
  const policies = pickPolicies(projection)

  const baseContent: CruiseContent = {
    cruise,
    ship,
    sailings: [],
    cabin_categories: [],
    itinerary_stops: itinerary,
    policies,
  }

  let merged = baseContent
  if (options.overlays && options.overlays.length > 0) {
    const result = mergeOverlaysIntoContent(baseContent, options.overlays, {
      validate(p) {
        const r = cruiseContentSchema.safeParse(p)
        return r.success
          ? { valid: true }
          : { valid: false, reason: r.error.issues[0]?.message ?? "invalid" }
      },
    })
    merged = cruiseContentSchema.parse(result)
  }

  return {
    content: merged,
    content_schema_version: CRUISES_CONTENT_SCHEMA_VERSION,
    served_locale: scope.locale,
    source_kind: options.provenance.provenance.source_kind,
    source_provider: options.provenance.provenance.source_provider,
  }
}

export async function synthesizeCruiseContentFromDb(
  db: AnyDrizzleDb,
  scope: { locale: string },
  provenance: Extract<ProvenanceReadResult, { kind: "sourced" }>,
): Promise<SynthesizedCruiseContent> {
  const entityId = entityIdFromProvenance(provenance)
  const overlays = await fetchOverlaysForEntity(db, "cruises", entityId)
  return synthesizeCruiseContent(scope, {
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

function pickCruiseSummary(
  projection: Record<string, unknown>,
  provenance: Extract<ProvenanceReadResult, { kind: "sourced" }>,
): CruiseContent["cruise"] {
  return {
    id: stringOr(projection.id, "") || provenance.entry_id,
    name: stringOr(projection.name, "") || stringOr(projection.title, "") || "Unnamed cruise",
    status: stringOr(projection.status, undefined),
    description: stringOr(projection.description, null),
    cruise_type: stringOr(projection.cruise_type, null),
    hero_image_url: stringOr(projection.hero_image_url, null),
    highlights: stringArrayOr(projection.highlights, []),
    cruise_line:
      stringOr(projection.cruise_line, null) ??
      stringOr(projection.line_name, null) ??
      provenance.provenance.source_provider ??
      null,
    duration_nights: numberOr(projection.duration_nights, null),
    embarkation_port: stringOr(projection.embarkation_port, null),
    disembarkation_port: stringOr(projection.disembarkation_port, null),
  }
}

function pickShip(projection: Record<string, unknown>): CruiseContent["ship"] {
  const shipName = stringOr(projection.ship_name, null) ?? stringOr(projection.ship, null)
  if (!shipName) return null
  return {
    name: shipName,
    description: stringOr(projection.ship_description, null),
    capacity: numberOr(projection.ship_capacity, null),
    decks: numberOr(projection.ship_decks, null),
    gallery: [],
  }
}

function pickItineraryStops(projection: Record<string, unknown>): CruiseContent["itinerary_stops"] {
  const stops = projection.itinerary
  if (!Array.isArray(stops)) return []
  const result: CruiseContent["itinerary_stops"] = []
  for (const item of stops) {
    if (!item || typeof item !== "object") continue
    const obj = item as Record<string, unknown>
    const portName = stringOr(obj.port_name, null) ?? stringOr(obj.port, null)
    const dayNumber = numberOr(obj.day_number, null) ?? numberOr(obj.day, null)
    if (!portName || dayNumber === null || dayNumber <= 0) continue
    result.push({
      day_number: dayNumber,
      date: stringOr(obj.date, null),
      port_name: portName,
      arrival_time: stringOr(obj.arrival_time, null),
      departure_time: stringOr(obj.departure_time, null),
      description: stringOr(obj.description, null),
      is_at_sea: typeof obj.is_at_sea === "boolean" ? obj.is_at_sea : false,
    })
  }
  return result
}

function pickPolicies(projection: Record<string, unknown>): CruiseContent["policies"] {
  const out: CruiseContent["policies"] = []
  const cancel = stringOr(projection.cancellation_policy, null)
  if (cancel) out.push({ kind: "cancellation", body: cancel })
  const payment = stringOr(projection.payment_terms, null)
  if (payment) out.push({ kind: "payment", body: payment })
  return out
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
