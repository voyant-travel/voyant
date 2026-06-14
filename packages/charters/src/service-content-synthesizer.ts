/**
 * Charter content synthesizer — fallback for thin adapters that
 * declare `supportsContentFetch: false`.
 *
 * Produces the most complete `CharterContent` blob we can legitimately
 * synthesize from the durable sourced-entry projection + locale-aware
 * overlays + plane-level provenance. Yacht spec, voyage list, suite
 * map, and schedule_days render as typed empty states unless the
 * projection genuinely carries them.
 *
 * Per §3.6: never invents plausible-but-unverified fields, never
 * machine-translates, never mines snapshots, never caches its own
 * output.
 */

import {
  fetchOverlaysForEntity,
  mergeOverlaysIntoContent,
  type ProvenanceReadResult,
} from "@voyant-travel/catalog"
import type { AnyDrizzleDb } from "@voyant-travel/db"

import {
  CHARTERS_CONTENT_SCHEMA_VERSION,
  type CharterContent,
  charterContentSchema,
} from "./content-shape.js"

export interface SynthesizeCharterContentOptions {
  provenance: Extract<ProvenanceReadResult, { kind: "sourced" }>
  overlays?: ReadonlyArray<{ field_path: string; value: unknown }>
}

export interface SynthesizedCharterContent {
  content: CharterContent
  content_schema_version: string
  served_locale: string
  source_kind: string
  source_provider?: string
}

export function synthesizeCharterContent(
  scope: { locale: string },
  options: SynthesizeCharterContentOptions,
): SynthesizedCharterContent {
  const projection = options.provenance.projection
  const charter = pickCharterSummary(projection, options.provenance)
  const yacht = pickYacht(projection)
  const policies = pickPolicies(projection)

  const baseContent: CharterContent = {
    charter,
    yacht,
    voyages: [],
    suites: [],
    schedule_days: [],
    policies,
  }

  let merged = baseContent
  if (options.overlays && options.overlays.length > 0) {
    const result = mergeOverlaysIntoContent(baseContent, options.overlays, {
      validate(p) {
        const r = charterContentSchema.safeParse(p)
        return r.success
          ? { valid: true }
          : { valid: false, reason: r.error.issues[0]?.message ?? "invalid" }
      },
    })
    merged = charterContentSchema.parse(result)
  }

  return {
    content: merged,
    content_schema_version: CHARTERS_CONTENT_SCHEMA_VERSION,
    served_locale: scope.locale,
    source_kind: options.provenance.provenance.source_kind,
    source_provider: options.provenance.provenance.source_provider,
  }
}

export async function synthesizeCharterContentFromDb(
  db: AnyDrizzleDb,
  scope: { locale: string },
  provenance: Extract<ProvenanceReadResult, { kind: "sourced" }>,
): Promise<SynthesizedCharterContent> {
  const entityId = entityIdFromProvenance(provenance)
  const overlays = await fetchOverlaysForEntity(db, "charters", entityId)
  return synthesizeCharterContent(scope, {
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

function pickCharterSummary(
  projection: Record<string, unknown>,
  provenance: Extract<ProvenanceReadResult, { kind: "sourced" }>,
): CharterContent["charter"] {
  return {
    id: stringOr(projection.id, "") || provenance.entry_id,
    name: stringOr(projection.name, "") || stringOr(projection.title, "") || "Unnamed charter",
    status: stringOr(projection.status, undefined),
    description: stringOr(projection.description, null),
    charter_type: stringOr(projection.charter_type, null),
    hero_image_url: stringOr(projection.hero_image_url, null),
    highlights: stringArrayOr(projection.highlights, []),
    cruising_area: stringOr(projection.cruising_area, null) ?? stringOr(projection.area, null),
    base_port: stringOr(projection.base_port, null),
    duration_nights: numberOr(projection.duration_nights, null),
  }
}

function pickYacht(projection: Record<string, unknown>): CharterContent["yacht"] {
  const yachtName = stringOr(projection.yacht_name, null) ?? stringOr(projection.yacht, null)
  if (!yachtName) return null
  return {
    name: yachtName,
    description: stringOr(projection.yacht_description, null),
    type: stringOr(projection.yacht_type, null),
    length_meters: numberOr(projection.length_meters, null),
    capacity_guests: numberOr(projection.capacity_guests, null),
    capacity_crew: numberOr(projection.capacity_crew, null),
    cabins: numberOr(projection.cabins, null),
    year_built: numberOr(projection.year_built, null),
    builder: stringOr(projection.builder, null),
    flag: stringOr(projection.flag, null),
    amenities: stringArrayOr(projection.yacht_amenities, []),
    images: stringArrayOr(projection.yacht_images, []),
  }
}

function pickPolicies(projection: Record<string, unknown>): CharterContent["policies"] {
  const out: CharterContent["policies"] = []
  const cancel = stringOr(projection.cancellation_policy, null)
  if (cancel) out.push({ kind: "cancellation", body: cancel })
  const payment = stringOr(projection.payment_terms, null)
  if (payment) out.push({ kind: "payment", body: payment })
  const apa = stringOr(projection.apa_terms, null)
  if (apa) out.push({ kind: "apa", body: apa })
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
