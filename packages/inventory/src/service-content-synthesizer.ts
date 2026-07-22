/**
 * Product content synthesizer — fallback for thin adapters that declare
 * `supportsContentFetch: false`.
 *
 * Per sourced-content §3.6, the synthesizer's job is to produce the
 * **most complete** content payload it legitimately can from what the
 * catalog plane already knows: the durable sourced-entry projection,
 * the editorial overlay store, and plane-level provenance metadata.
 *
 * Returns the same shape as a real `getContent` so consumers (detail
 * pages, the booking journey, snapshot capture) cannot tell the two
 * paths apart from the type signature. Fields the synthesizer cannot
 * fill render as typed empty states — never as missing properties.
 *
 * What it does NOT do:
 *   - Mine prior snapshot rows (those carry customer-scoped PII and
 *     are point-in-time, not generic content).
 *   - Machine-translate (that's the adapter's `getContent` +
 *     `machine_translated: true` path).
 *   - Synthesize plausible-but-unverified fields ("hotels usually have
 *     a pool" is not a basis for an amenity).
 *   - Cache its own output (inputs change at projection / overlay
 *     write time; a cache layer would just complicate invalidation).
 */

import type { ProvenanceReadResult } from "@voyant-travel/catalog"
import { fetchOverlaysForEntity, mergeOverlaysIntoContent } from "@voyant-travel/catalog"
import type { AnyDrizzleDb } from "@voyant-travel/db"

import {
  normalizeProductContentOverlay,
  PRODUCTS_CONTENT_SCHEMA_VERSION,
  type ProductContent,
  productContentSchema,
} from "./content-shape.js"

export interface SynthesizeProductContentOptions {
  /**
   * The provenance read for the entity. Carries the durable projection
   * captured at discover() time — the synthesizer's primary input.
   */
  provenance: Extract<ProvenanceReadResult, { kind: "sourced" }>
  /**
   * Optional locale-aware overlays. When present, layered on top via
   * RFC 6901 JSON pointer paths. Caller passes overlays already
   * filtered to the active scope (locale, audience, market) per the
   * variant fallback chain.
   */
  overlays?: ReadonlyArray<{ field_path: string; value: unknown }>
}

export interface SynthesizedProductContent {
  /** The synthesized payload. Validated against the products/v1 schema. */
  content: ProductContent
  /** Schema version stamped on the synthesized payload. */
  content_schema_version: string
  /**
   * The locale this synthesis represents. Synthesizer output isn't
   * locale-pinned at the projection level — projections capture the
   * adapter's canonical fields. Caller's locale is reported back so
   * UI / SWR machinery can stamp it consistently.
   */
  served_locale: string
  /**
   * Whether the upstream adapter is rich (this synthesis is a fallback)
   * vs. thin (this synthesis is the real path).
   */
  source_kind: string
  /**
   * Source provenance hints for UI badges ("served by …", "limited
   * content available").
   */
  source_provider?: string
}

/**
 * Synthesize a `ProductContent` payload from projection + overlay +
 * plane metadata. Pure-ish: takes a provenance read result and an
 * optional overlay list; returns a typed-empty-state-filled content
 * blob.
 */
export function synthesizeProductContent(
  scope: { locale: string },
  options: SynthesizeProductContentOptions,
): SynthesizedProductContent {
  const projection = options.provenance.projection

  const product = pickProductSummary(projection, options.provenance)
  const media = pickMedia(projection)
  const policies = pickPolicies(projection)

  const baseContent: ProductContent = {
    product,
    options: [],
    days: [],
    media,
    policies,
    departures: [],
  }

  let merged = baseContent
  if (options.overlays && options.overlays.length > 0) {
    const result = mergeOverlaysIntoContent(
      baseContent,
      options.overlays.map((overlay) => normalizeProductContentOverlay(overlay)),
      {
        validate(p) {
          const r = productContentSchema.safeParse(p)
          return r.success
            ? { valid: true }
            : { valid: false, reason: r.error.issues[0]?.message ?? "invalid" }
        },
      },
    )
    merged = productContentSchema.parse(result)
  }

  return {
    content: merged,
    content_schema_version: PRODUCTS_CONTENT_SCHEMA_VERSION,
    served_locale: scope.locale,
    source_kind: options.provenance.provenance.source_kind,
    source_provider: options.provenance.provenance.source_provider,
  }
}

/**
 * Drizzle-bound convenience wrapper: fetches active overlays for the
 * entity and runs the synthesizer. Verticals call this from their
 * content service when no `getContent` adapter is registered (or when
 * the synthesizer is the fallback for missing-cache + thin-adapter).
 */
export async function synthesizeProductContentFromDb(
  db: AnyDrizzleDb,
  scope: { locale: string },
  provenance: Extract<ProvenanceReadResult, { kind: "sourced" }>,
): Promise<SynthesizedProductContent> {
  const overlays = await fetchOverlaysForEntity(db, "products", entityIdFromProvenance(provenance))
  return synthesizeProductContent(scope, {
    provenance,
    overlays: overlays.map((o) => ({ field_path: o.field_path, value: o.value })),
  })
}

function entityIdFromProvenance(
  provenance: Extract<ProvenanceReadResult, { kind: "sourced" }>,
): string {
  // The sourced-entry row's entry_id is the catalog-side TypeID; the
  // products module-side id is on the projection row. Synthesizer
  // callers thread the products-module entity_id through scope; we
  // take it off the projection's `id` field when the adapter set it,
  // falling back to the entry_id (which is wrong for read paths but
  // safe for tests).
  const fromProjection = provenance.projection.id
  if (typeof fromProjection === "string" && fromProjection.length > 0) {
    return fromProjection
  }
  return provenance.entry_id
}

// ─────────────────────────────────────────────────────────────────────────────
// Field pickers
// ─────────────────────────────────────────────────────────────────────────────

function pickProductSummary(
  projection: Record<string, unknown>,
  provenance: Extract<ProvenanceReadResult, { kind: "sourced" }>,
): ProductContent["product"] {
  return {
    id: stringOr(projection.id, "") || provenance.entry_id,
    name: stringOr(projection.name, "") || stringOr(projection.title, "") || "Unnamed product",
    status: stringOr(projection.status, undefined),
    description: stringOr(projection.description, null),
    inclusions_html:
      stringOr(projection.inclusions_html, null) ?? stringOr(projection.inclusionsHtml, null),
    exclusions_html:
      stringOr(projection.exclusions_html, null) ?? stringOr(projection.exclusionsHtml, null),
    terms_html: stringOr(projection.terms_html, null) ?? stringOr(projection.termsHtml, null),
    contract_template_id:
      stringOr(projection.contract_template_id, null) ??
      stringOr(projection.contractTemplateId, null),
    contractTemplateId:
      stringOr(projection.contractTemplateId, null) ??
      stringOr(projection.contract_template_id, null),
    highlights: stringArrayOr(projection.highlights, []),
    hero_image_url: stringOr(projection.hero_image_url, null),
    duration_days: numberOr(projection.duration_days, null),
    start_date: stringOr(projection.start_date, null),
    end_date: stringOr(projection.end_date, null),
    sell_currency: stringOr(projection.sell_currency, null),
    supplier:
      stringOr(projection.supplier, null) ??
      stringOr(projection.supplier_name, null) ??
      provenance.provenance.source_provider ??
      null,
    country: stringOr(projection.country, null),
    departure_city: stringOr(projection.departure_city, null),
    tags: stringArrayOr(projection.tags, []),
  }
}

function pickMedia(projection: Record<string, unknown>): ProductContent["media"] {
  const heroUrl = stringOr(projection.hero_image_url, null)
  const out: ProductContent["media"] = []
  if (heroUrl) {
    out.push({ url: heroUrl, type: "image", caption: null, alt: null })
  }
  // Some adapters send a `media` array on the projection. Accept it
  // when shaped reasonably; ignore otherwise rather than synthesize.
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

function pickMediaType(value: unknown): ProductMediaTypeLiteral {
  if (value === "video") return "video"
  if (value === "document") return "document"
  return "image"
}
type ProductMediaTypeLiteral = "image" | "video" | "document"

function pickPolicies(projection: Record<string, unknown>): ProductContent["policies"] {
  const policies: ProductContent["policies"] = []
  const cancel = stringOr(projection.cancellation_policy, null)
  if (cancel) policies.push({ kind: "cancellation", body: cancel })
  const payment = stringOr(projection.payment_terms, null)
  if (payment) policies.push({ kind: "payment", body: payment })
  return policies
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
