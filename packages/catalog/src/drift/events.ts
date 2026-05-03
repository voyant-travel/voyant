/**
 * Drift events — emitted when a feeder detects a material upstream change in
 * a sourced field. Events go to an ops queue for review.
 *
 * Drift severity per field is declared in the field-policy registry (see
 * `contract.ts`). Critical drift on a field blocks new bookings on the
 * affected entity until ops acknowledges; lower severities just notify.
 *
 * See `docs/architecture/catalog-architecture.md` §5.5 for the full design.
 */

import type { DriftSeverity } from "../contract.js"

/**
 * A single field-level drift detection. Multiple drifts on the same entity
 * may be batched into one `CatalogDriftEvent` (see below).
 */
export interface FieldDrift {
  /** Field-policy path that drifted (e.g. `"title"`, `"cancellation_policy_rules"`). */
  field_path: string
  /** Severity declared on the field policy at the time of detection. */
  severity: DriftSeverity
  /** The previous source value (truncated / sanitized for non-staff visibility). */
  before?: unknown
  /** The new source value (truncated / sanitized for non-staff visibility). */
  after?: unknown
  /**
   * Whether an editorial overlay was active on this field at the time of
   * detection. Drift on overridden fields is the most operationally important
   * case — the override stays in effect, but ops should review.
   */
  had_overlay: boolean
}

/**
 * Drift event payload. Carries one or more field-level drifts detected for a
 * single entity in a single feeder pass.
 */
export interface CatalogDriftEvent {
  /** TypeID of the drift event itself (`cdrf_...`). */
  drift_event_id: string
  /** Vertical that owns the entity. */
  entity_module: string
  /** Entity that drifted. */
  entity_id: string
  /** Source connection id that detected the drift. */
  source_connection_id: string
  /** Source kind (denormalized for routing convenience). */
  source_kind: string
  /** Per-field drift details. */
  drifts: FieldDrift[]
  /** Timestamp of detection. */
  detected_at: Date
  /** Highest severity among the field drifts (for ops dashboard sorting). */
  max_severity: DriftSeverity
  /**
   * Whether this drift event blocks new bookings on the entity until ops
   * acknowledges. True iff `max_severity === "critical"`.
   */
  blocks_bookings: boolean
}

/**
 * Computes the highest severity across a set of field drifts.
 */
export function maxDriftSeverity(drifts: FieldDrift[]): DriftSeverity {
  const order: Record<DriftSeverity, number> = {
    none: 0,
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  }
  let highest: DriftSeverity = "none"
  for (const drift of drifts) {
    if (order[drift.severity] > order[highest]) {
      highest = drift.severity
    }
  }
  return highest
}

/**
 * Returns true if the drift severity should block new bookings on the
 * affected entity until ops acknowledges.
 */
export function blocksBookings(severity: DriftSeverity): boolean {
  return severity === "critical"
}

// ─────────────────────────────────────────────────────────────────────────────
// Content drift
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Coarse classification of why a content row drifted. The cache uses this
 * to decide whether to invalidate (and at what granularity).
 */
export type ContentDriftKind =
  /** Upstream signaled new content via etag / source_updated_at. */
  | "content_changed"
  /** Upstream added a locale we didn't previously have. */
  | "content_locale_added"
  /** Explicit invalidation (debug tooling, ops escalation). */
  | "content_invalidated"

/**
 * Content-shaped drift event. Sibling to `CatalogDriftEvent`.
 *
 * The existing `FieldDrift` / `CatalogDriftEvent` shape is field-policy-
 * bound — `field_path, severity, before, after, had_overlay`. That's right
 * for indexed-field drift but doesn't speak to *content* drift, which has
 * different invalidation granularity (per-locale, per-content-section,
 * per-etag).
 *
 * When a content-drift event fires, the cache invalidates rows matching
 * `(entity_module, entity_id, locale, market)` — wildcards on locale /
 * market when those event fields are null. The next read for any matched
 * row goes through SWR's stale-serve + background-refresh path.
 *
 * See `docs/architecture/catalog-sourced-content.md` §3.4.1.
 */
export interface ContentDriftEvent {
  /** TypeID of the drift event itself — same lineage as `CatalogDriftEvent`. */
  id: string
  entity_module: string
  entity_id: string
  /** When known: the locale that drifted. NULL means "all locales". */
  locale?: string
  /** When known: the market that drifted. NULL means "all markets". */
  market?: string
  kind: ContentDriftKind
  /** ETag we last cached, when the event source can compare. */
  previous_etag?: string
  /** ETag the upstream now reports. */
  current_etag?: string
  /**
   * Optional content-section: when only a section drifted, the cache could
   * in theory do a section-scoped refresh. v1 always re-pulls the whole
   * content blob; this field is for future surgical refreshes.
   */
  section?: string
  detected_at: Date
}
