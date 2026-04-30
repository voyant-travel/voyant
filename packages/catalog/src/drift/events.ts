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
