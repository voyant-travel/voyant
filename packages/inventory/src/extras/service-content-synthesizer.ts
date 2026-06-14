/**
 * Extras content synthesizer — fallback for thin adapters that declare
 * `supportsContentFetch: false`.
 *
 * Produces the most complete `ExtraContent` blob we can legitimately
 * synthesize from the durable sourced-entry projection + locale-aware
 * overlays + plane-level provenance. Sub-options render as a typed
 * empty state unless the projection genuinely carries them.
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
  EXTRAS_CONTENT_SCHEMA_VERSION,
  type ExtraContent,
  extraContentSchema,
} from "./content-shape.js"

export interface SynthesizeExtraContentOptions {
  provenance: Extract<ProvenanceReadResult, { kind: "sourced" }>
  overlays?: ReadonlyArray<{ field_path: string; value: unknown }>
}

export interface SynthesizedExtraContent {
  content: ExtraContent
  content_schema_version: string
  served_locale: string
  source_kind: string
  source_provider?: string
}

export function synthesizeExtraContent(
  scope: { locale: string },
  options: SynthesizeExtraContentOptions,
): SynthesizedExtraContent {
  const projection = options.provenance.projection
  const extra = pickExtraSummary(projection, options.provenance)
  const media = pickMedia(projection)
  const policies = pickPolicies(projection)

  const baseContent: ExtraContent = {
    extra,
    options: [],
    media,
    policies,
  }

  let merged = baseContent
  if (options.overlays && options.overlays.length > 0) {
    const result = mergeOverlaysIntoContent(baseContent, options.overlays, {
      validate(p) {
        const r = extraContentSchema.safeParse(p)
        return r.success
          ? { valid: true }
          : { valid: false, reason: r.error.issues[0]?.message ?? "invalid" }
      },
    })
    merged = extraContentSchema.parse(result)
  }

  return {
    content: merged,
    content_schema_version: EXTRAS_CONTENT_SCHEMA_VERSION,
    served_locale: scope.locale,
    source_kind: options.provenance.provenance.source_kind,
    source_provider: options.provenance.provenance.source_provider,
  }
}

export async function synthesizeExtraContentFromDb(
  db: AnyDrizzleDb,
  scope: { locale: string },
  provenance: Extract<ProvenanceReadResult, { kind: "sourced" }>,
): Promise<SynthesizedExtraContent> {
  const entityId = entityIdFromProvenance(provenance)
  const overlays = await fetchOverlaysForEntity(db, "extras", entityId)
  return synthesizeExtraContent(scope, {
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

function pickExtraSummary(
  projection: Record<string, unknown>,
  provenance: Extract<ProvenanceReadResult, { kind: "sourced" }>,
): ExtraContent["extra"] {
  return {
    id: stringOr(projection.id, "") || provenance.entry_id,
    name: stringOr(projection.name, "") || stringOr(projection.title, "") || "Unnamed extra",
    status: stringOr(projection.status, undefined),
    description: stringOr(projection.description, null),
    selection_type: stringOr(projection.selection_type, "optional"),
    pricing_mode: stringOr(projection.pricing_mode, "per_booking"),
    priced_per_person:
      typeof projection.priced_per_person === "boolean" ? projection.priced_per_person : undefined,
    category: stringOr(projection.category, null),
    hero_image_url: stringOr(projection.hero_image_url, null),
    highlights: stringArrayOr(projection.highlights, []),
    supplier:
      stringOr(projection.supplier, null) ??
      stringOr(projection.supplier_name, null) ??
      provenance.provenance.source_provider ??
      null,
    duration_minutes: numberOr(projection.duration_minutes, null),
    requirements_summary: stringOr(projection.requirements_summary, null),
  }
}

function pickMedia(projection: Record<string, unknown>): ExtraContent["media"] {
  const heroUrl = stringOr(projection.hero_image_url, null)
  const out: ExtraContent["media"] = []
  if (heroUrl) {
    out.push({ url: heroUrl, type: "image", caption: null, alt: null })
  }
  const additional = projection.media
  if (Array.isArray(additional)) {
    for (const item of additional) {
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>
        const url = stringOr(obj.url, null)
        if (!url) continue
        out.push({
          url,
          type: pickMediaType(obj.type),
          caption: stringOr(obj.caption, null),
          alt: stringOr(obj.alt, null),
        })
      }
    }
  }
  return out
}

function pickMediaType(value: unknown): ExtraMediaTypeLiteral {
  if (value === "video") return "video"
  if (value === "document") return "document"
  return "image"
}
type ExtraMediaTypeLiteral = "image" | "video" | "document"

function pickPolicies(projection: Record<string, unknown>): ExtraContent["policies"] {
  const out: ExtraContent["policies"] = []
  const cancel = stringOr(projection.cancellation_policy, null)
  if (cancel) out.push({ kind: "cancellation", body: cancel })
  const payment = stringOr(projection.payment_terms, null)
  if (payment) out.push({ kind: "payment", body: payment })
  const requirements = stringOr(projection.requirements, null)
  if (requirements) out.push({ kind: "requirements", body: requirements })
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
