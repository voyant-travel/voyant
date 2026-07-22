/**
 * Overlay resolver — applies editorial overlays to a source projection,
 * walking the variant fallback chain.
 *
 * Variant axes are `locale`, `audience`, `market`. The resolver walks an
 * 8-step fallback (most-specific → least-specific) and applies the matching
 * overlay value using the merge rule from the field policy.
 *
 * Pure logic: no DB access, no IO. Callers fetch overlays by entity in one
 * query, pass them in here as `OverlayLookup`, and get back the resolved
 * field value tree.
 *
 * See `docs/architecture/catalog-architecture.md` §5.2.1 for the fallback
 * chain and §7.1 for the split rule that keeps merging predictable.
 */

import type { FieldPolicy, FieldPolicyRegistry, MergeRule, Visibility } from "../contract.js"
import { OVERLAY_DEFAULT_SCOPE } from "./schema.js"

/** A single overlay row reduced to what the resolver needs. */
export interface ResolverOverlay {
  field_path: string
  node_kind?: string
  node_key?: string
  locale: string
  audience: Visibility | typeof OVERLAY_DEFAULT_SCOPE
  market: string
  value: unknown
  version?: number
  id?: string
}

/**
 * The variant-scoped query the caller is asking the resolver to satisfy.
 * Returned values reflect overlays applicable to this exact tuple, with
 * fallbacks down through `default` sentinels.
 */
export interface ResolverScope {
  locale: string
  audience: Visibility
  market: string
  /** The actor making the request — used for visibility filtering. */
  actor: Visibility
}

/**
 * Set of overlay rows fetched for a single entity. The resolver indexes
 * them internally by `(field_path, locale, audience, market)` for the
 * fallback walk.
 */
export type OverlayLookup = ReadonlyArray<ResolverOverlay>

/**
 * Resolved-view emitter. Given a per-entity source projection and the
 * applicable overlays, returns the per-(field_path → value) map after
 * applying the variant fallback chain, the merge rule, and the visibility
 * filter for the requesting actor.
 */
export interface ResolvedView {
  /** Resolved values keyed by field path. */
  values: Map<string, unknown>
  /**
   * Fields the resolver intentionally omitted because they are not visible
   * to the requesting actor. Useful for debug / "preview as audience X"
   * views; consumers should not display these.
   */
  hidden: Set<string>
  /**
   * Per-field provenance: which variant slice satisfied the lookup. `null`
   * means the source projection's value was used (no overlay applied).
   */
  provenance: Map<string, ResolvedFieldProvenance | null>
}

export interface ResolvedFieldProvenance {
  locale: string
  audience: Visibility | typeof OVERLAY_DEFAULT_SCOPE
  market: string
}

/**
 * The 8-step variant fallback chain, ordered from most-specific to
 * least-specific. The resolver walks this list and stops at the first
 * overlay it finds for the requested field path.
 */
export function variantFallbackChain(
  scope: ResolverScope,
): Array<{ locale: string; audience: string; market: string }> {
  const D = OVERLAY_DEFAULT_SCOPE
  const { locale, audience, market } = scope
  return [
    { locale, audience, market },
    { locale, audience, market: D },
    { locale, audience: D, market },
    { locale, audience: D, market: D },
    { locale: D, audience, market },
    { locale: D, audience, market: D },
    { locale: D, audience: D, market },
    { locale: D, audience: D, market: D },
  ]
}

/**
 * Indexes overlay rows by `(field_path, locale, audience, market)` for the
 * resolver's fallback walk. Idempotent — passing the same overlay twice
 * produces a deterministic last-write-wins (by array position) result.
 */
function isRootOverlay(overlay: ResolverOverlay): boolean {
  return (overlay.node_kind ?? "root") === "root" && (overlay.node_key ?? "root") === "root"
}

function indexOverlays(overlays: OverlayLookup): Map<string, Map<string, ResolverOverlay>> {
  const byField = new Map<string, Map<string, ResolverOverlay>>()
  for (const overlay of overlays) {
    if (!isRootOverlay(overlay)) continue
    let inner = byField.get(overlay.field_path)
    if (!inner) {
      inner = new Map<string, ResolverOverlay>()
      byField.set(overlay.field_path, inner)
    }
    const key = `${overlay.locale}|${overlay.audience}|${overlay.market}`
    inner.set(key, overlay)
  }
  return byField
}

/**
 * Looks up the overlay for a single field path under the variant fallback
 * chain. Returns the first match, or `undefined` if no overlay applies at
 * any fallback level.
 */
function lookupOverlay(
  byField: Map<string, Map<string, ResolverOverlay>>,
  fieldPath: string,
  policy: FieldPolicy,
  scope: ResolverScope,
): ResolverOverlay | undefined {
  const inner = byField.get(fieldPath)
  if (!inner) return undefined
  for (const variant of variantFallbackChain(scope)) {
    if (
      policy.localized &&
      scope.locale !== OVERLAY_DEFAULT_SCOPE &&
      variant.locale === OVERLAY_DEFAULT_SCOPE
    ) {
      continue
    }
    const key = `${variant.locale}|${variant.audience}|${variant.market}`
    const hit = inner.get(key)
    if (hit) return hit
  }
  return undefined
}

/**
 * Applies the field policy's merge rule to combine a source value with an
 * overlay value. Returns the resolved value.
 *
 * Throws if `merge: "source-only"` is configured but an overlay was passed —
 * this means the overlay-write path validation failed and a forbidden
 * override slipped through; refuse to honor it at read time.
 */
export function applyMerge(
  policy: FieldPolicy,
  sourceValue: unknown,
  overlayValue: unknown,
): unknown {
  return mergeByRule(policy.merge, sourceValue, overlayValue, policy.path)
}

function mergeByRule(
  rule: MergeRule,
  sourceValue: unknown,
  overlayValue: unknown,
  path: string,
): unknown {
  switch (rule) {
    case "source-only":
      throw new Error(
        `field "${path}" has merge: "source-only" but received an overlay value (overlay-write validation should have rejected this)`,
      )
    case "replace":
      return overlayValue
    case "additive-set": {
      const sourceArray = Array.isArray(sourceValue) ? sourceValue : []
      const overlayArray = Array.isArray(overlayValue) ? overlayValue : []
      // Preserve insertion order; first occurrence wins on duplicates.
      const seen = new Set<unknown>()
      const merged: unknown[] = []
      for (const item of [...sourceArray, ...overlayArray]) {
        if (!seen.has(item)) {
          seen.add(item)
          merged.push(item)
        }
      }
      return merged
    }
    case "additive-list": {
      const sourceArray = Array.isArray(sourceValue) ? sourceValue : []
      const overlayArray = Array.isArray(overlayValue) ? overlayValue : []
      return [...sourceArray, ...overlayArray]
    }
    case "list-position": {
      const sourceArray = Array.isArray(sourceValue) ? [...sourceValue] : []
      // overlayValue is a sparse array: positions to override.
      const overlay = overlayValue as Record<number, unknown>
      for (const [posStr, value] of Object.entries(overlay)) {
        const pos = Number(posStr)
        if (Number.isInteger(pos) && pos >= 0) {
          sourceArray[pos] = value
        }
      }
      return sourceArray
    }
  }
}

/**
 * Resolves a source projection plus a set of overlays into a final view for
 * the requesting `(locale, audience, market)` scope, filtered by the actor's
 * visibility.
 *
 * The source projection is keyed by field path; only fields present in the
 * registry are considered. Fields whose policy hides them from the actor's
 * audience are placed in `hidden`, not `values`.
 */
export function resolveOverlay(
  registry: FieldPolicyRegistry,
  sourceProjection: ReadonlyMap<string, unknown>,
  overlays: OverlayLookup,
  scope: ResolverScope,
): ResolvedView {
  const indexed = indexOverlays(overlays)
  const values = new Map<string, unknown>()
  const hidden = new Set<string>()
  const provenance = new Map<string, ResolvedFieldProvenance | null>()

  const candidatePaths = new Set<string>(sourceProjection.keys())
  for (const overlay of overlays) {
    if (isRootOverlay(overlay)) candidatePaths.add(overlay.field_path)
  }

  for (const path of candidatePaths) {
    const sourceValue = sourceProjection.get(path)
    const policy = registry.resolve(path)
    if (!policy) {
      // Field exists in the source projection but not in the registry. The
      // resolver leaves it out — the registry is authoritative about which
      // fields are part of the catalog projection.
      continue
    }

    // Visibility filter: skip fields not visible to the requesting actor.
    if (!isVisibleTo(policy, scope.actor)) {
      hidden.add(path)
      continue
    }

    const overlay = lookupOverlay(indexed, path, policy, scope)
    if (overlay && policy.merge !== "source-only") {
      values.set(path, applyMerge(policy, sourceValue, overlay.value))
      provenance.set(path, {
        locale: overlay.locale,
        audience: overlay.audience,
        market: overlay.market,
      })
    } else if (sourceProjection.has(path)) {
      values.set(path, sourceValue)
      provenance.set(path, null)
    } else {
      continue
    }
  }

  return { values, hidden, provenance }
}

/** Visibility check: is the field visible to the requesting actor? */
export function isVisibleTo(policy: FieldPolicy, actor: Visibility): boolean {
  return policy.visibility.includes(actor)
}
