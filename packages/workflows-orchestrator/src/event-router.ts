// Pure event router — given a manifest and an envelope, decide which
// filters match and produce the per-match descriptors drivers feed into
// `trigger()`.
//
// Drivers (InMemory, Mode 2 / Postgres, Mode 1 / CF edge) wrap this in
// their own `ingestEvent` impl: they fetch the manifest from their store,
// call `routeEvent(...)`, then invoke `trigger()` per match.
//
// Architecture: docs/architecture/workflows-runtime-architecture.md §15.

import {
  evaluatePredicate,
  type InputMapper,
  type PredicateEnvelope,
  type PredicateExpr,
  projectInput,
} from "@voyantjs/workflows/events"
import type { WorkflowManifest } from "@voyantjs/workflows/protocol"

// ---- Public types ----

/**
 * Outcome of routing a single envelope through every filter in a manifest.
 * Each match describes exactly enough for a driver to call `trigger()`:
 *   - `targetWorkflowId` and `input` are the trigger args.
 *   - `idempotencyKey` derives from `${filterId}:${eventId}` so retries of
 *     the same envelope produce a stable run regardless of which driver
 *     applies the trigger.
 */
export type RouterMatch =
  | {
      filterId: string
      targetWorkflowId: string
      input: unknown
      idempotencyKey: string
      status: "matched"
    }
  | {
      filterId: string
      status: "skipped"
      reason: "where_eval_error" | "input_projection_error"
      details?: string
    }

export interface RouteEventArgs {
  manifest: WorkflowManifest
  envelope: PredicateEnvelope
  /**
   * Stable id for the envelope. Drivers derive this from
   * `metadata.eventId` (when set) or fall back to a content hash; passing
   * it in keeps the router pure.
   */
  eventId: string
  /**
   * Optional caller-supplied idempotency override (per
   * `IngestEventArgs.idempotencyKey`). When set, the per-match key
   * becomes `${filterId}:${suppliedKey}` instead of
   * `${filterId}:${eventId}`.
   */
  idempotencyOverride?: string
}

// ---- Public API ----

/**
 * Route an envelope through a manifest. Pure: no IO, no side effects.
 * Returns one entry per filter that targets the envelope's eventType, in
 * the order they appear in `manifest.eventFilters` (which is itself
 * id-sorted from `buildManifest`).
 *
 * `where` evaluation errors and `input` projection errors are isolated to
 * the offending filter — other filters still produce matches. Drivers
 * surface skips as `IngestMatch.status === "skipped"` in the response.
 */
export function routeEvent(args: RouteEventArgs): RouterMatch[] {
  const out: RouterMatch[] = []
  for (const filter of args.manifest.eventFilters) {
    if (filter.eventType !== args.envelope.name) continue

    // Predicate gate.
    if (filter.where !== undefined) {
      try {
        const matched = evaluatePredicate(filter.where as PredicateExpr, args.envelope)
        if (!matched) continue
      } catch (err) {
        out.push({
          filterId: filter.id,
          status: "skipped",
          reason: "where_eval_error",
          details: err instanceof Error ? err.message : String(err),
        })
        continue
      }
    }

    // Input projection.
    let input: unknown
    try {
      input = projectInput(filter.input as InputMapper, args.envelope)
    } catch (err) {
      out.push({
        filterId: filter.id,
        status: "skipped",
        reason: "input_projection_error",
        details: err instanceof Error ? err.message : String(err),
      })
      continue
    }

    const baseKey = args.idempotencyOverride ?? args.eventId
    out.push({
      filterId: filter.id,
      targetWorkflowId: filter.targetWorkflowId,
      input,
      idempotencyKey: `${filter.id}:${baseKey}`,
      status: "matched",
    })
  }
  return out
}
