/**
 * Catalog content-service primitives.
 *
 * Phase C of the sourced-content architecture. Pure helpers — no
 * vertical adopts these yet (Phase D for products onward); they exist as
 * a shared toolbox so per-vertical content services don't reinvent the
 * locale fallback chain, SWR staleness check, JSON-pointer overlay
 * merger, content-drift invalidation, or cross-worker singleflight.
 *
 * Five primitives:
 *
 *   1. `isStale`                       — TTL check against `fresh_until`.
 *   2. `pickBestCachedLocale`          — locale-fallback scorer over a
 *                                        list of cached rows.
 *   3. `applyJsonPointerOverlay`       — RFC 6901 JSON-pointer applier
 *                                        for content-shape-aware merging.
 *   4. `mergeOverlaysIntoContent`      — composes
 *                                        `applyJsonPointerOverlay` over
 *                                        every overlay matching scope.
 *   5. `withContentRefreshLock`        — Postgres advisory-lock
 *                                        singleflight for cross-worker
 *                                        SWR refresh dedup.
 *
 * Plus a content-drift invalidation helper that returns the SQL
 * predicate to apply to a per-vertical content table — verticals call
 * `db.update(table).set({ fresh_until: now }).where(predicate)` directly
 * to keep the catalog package neutral about per-vertical table refs.
 *
 * See `docs/architecture/catalog-sourced-content.md` §3.4, §3.4.1, §3.5.3,
 * §3.5.4.
 */

import type { AnyDrizzleDb } from "@voyantjs/db"
import { sql } from "drizzle-orm"

import type { ContentDriftEvent } from "../drift/events.js"

// ─────────────────────────────────────────────────────────────────────────────
// Staleness
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stale-while-revalidate predicate. A row is stale when its
 * `fresh_until` is in the past. Rows with no `fresh_until` are never
 * stale on their own — the vertical's default TTL kicks in via the
 * caller's own logic.
 */
export function isStale(
  row: { fresh_until: Date | null | undefined },
  now: Date = new Date(),
): boolean {
  if (!row.fresh_until) return false
  return row.fresh_until.getTime() <= now.getTime()
}

// ─────────────────────────────────────────────────────────────────────────────
// Locale resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Coarse classification of how good a locale match was. Surfaces in the
 * UI as a hint when content was served in a non-preferred language.
 *
 *   - `exact`            — preference matched directly.
 *   - `language_match`   — language tag matched but region didn't (asked
 *                          for "fr-CA", got "fr-FR").
 *   - `fallback_chain`   — fell through to a deployment-default locale.
 *   - `any`              — last resort, served whatever the cache had.
 */
export type ContentLocaleMatchKind = "exact" | "language_match" | "fallback_chain" | "any"

export interface ContentLocaleResolution<T> {
  /** The chosen candidate. */
  candidate: T
  /** The locale the candidate is in. */
  served_locale: string
  /** How well the chosen candidate matched the preference chain. */
  match_kind: ContentLocaleMatchKind
}

/**
 * Pick the best candidate from a list of cached rows against an ordered
 * locale-preference chain. Pure scoring — no DB; the caller queries
 * candidates and passes them in.
 *
 * Score order, highest wins:
 *   1. Exact locale match (e.g. "ro-RO" matches "ro-RO").
 *   2. Language-tag match (e.g. "fr-CA" matches "fr-FR" → match_kind:
 *      "language_match").
 *   3. Earlier in `preferredLocales` beats later for ties.
 *   4. Any candidate when nothing else matches → match_kind: "any".
 *
 * Returns `null` when `candidates` is empty.
 */
export function pickBestCachedLocale<T extends { locale: string }>(
  candidates: ReadonlyArray<T>,
  preferredLocales: ReadonlyArray<string>,
): ContentLocaleResolution<T> | null {
  if (candidates.length === 0) return null

  // Score each candidate. Lower index in preferredLocales = higher
  // preference. Exact match beats language match beats nothing.
  let best: { candidate: T; rank: number; match: ContentLocaleMatchKind } | null = null

  for (const candidate of candidates) {
    let rank: number | null = null
    let match: ContentLocaleMatchKind = "any"

    for (let i = 0; i < preferredLocales.length; i += 1) {
      const pref = preferredLocales[i]!
      if (candidate.locale === pref) {
        rank = i
        match = "exact"
        break
      }
      if (languageTag(candidate.locale) === languageTag(pref)) {
        // Language tag matches, region differs. Keep looking — an
        // exact match later in the chain still wins over an earlier
        // language-only match because we want to honor the user's
        // explicit ordering.
        if (rank === null || i < rank) {
          rank = i
          match = "language_match"
        }
      }
    }

    // No match of any kind — flag as "any" with the worst rank so
    // exact / language matches always beat it, but it's still better
    // than no candidate at all.
    if (rank === null) {
      rank = preferredLocales.length
      match = "any"
    }

    if (
      !best ||
      rank < best.rank ||
      (rank === best.rank && matchScore(match) > matchScore(best.match))
    ) {
      best = { candidate, rank, match }
    }
  }

  if (!best) return null

  // When the best is from outside the preference chain altogether, mark
  // it as "fallback_chain" if the chain has length > 0 and "any"
  // otherwise.
  let final: ContentLocaleMatchKind = best.match
  if (final === "any" && preferredLocales.length > 0) {
    final = "fallback_chain"
  }

  return {
    candidate: best.candidate,
    served_locale: best.candidate.locale,
    match_kind: final,
  }
}

function languageTag(locale: string): string {
  // BCP 47: "ro-RO" → "ro", "zh-Hant-TW" → "zh". Lowercase for
  // case-insensitive comparison since BCP 47 is case-insensitive.
  return locale.split("-")[0]!.toLowerCase()
}

function matchScore(match: ContentLocaleMatchKind): number {
  switch (match) {
    case "exact":
      return 3
    case "language_match":
      return 2
    case "fallback_chain":
      return 1
    case "any":
      return 0
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON pointer overlay
// ─────────────────────────────────────────────────────────────────────────────

export class JsonPointerError extends Error {
  constructor(
    public readonly pointer: string,
    public readonly reason: string,
  ) {
    super(`json-pointer ${pointer}: ${reason}`)
    this.name = "JsonPointerError"
  }
}

/**
 * Parse an RFC 6901 JSON pointer into segments. The empty string `""`
 * refers to the whole document and parses to `[]`. Each segment
 * unescapes `~1` → `/` and `~0` → `~` (in that order, per the spec).
 */
export function parseJsonPointer(pointer: string): string[] {
  if (pointer === "") return []
  if (!pointer.startsWith("/")) {
    throw new JsonPointerError(pointer, "must start with '/' or be empty")
  }
  return pointer
    .slice(1)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"))
}

/**
 * Apply an overlay value to `target` at the given JSON-pointer location.
 * Returns the (mutated) target. Treats numeric segments as array
 * indices when the parent is an array.
 *
 * Behavior on missing intermediate paths: throws `JsonPointerError`
 * rather than silently creating a structure. Operators get a
 * surface-level diagnostic ("overlay X failed validation") instead of
 * the read returning corrupted data. Callers in the read service catch
 * this and skip the offending overlay.
 *
 * Pure mutation (in place). Callers should pass a fresh deep clone of
 * the cached payload — overlays should never mutate the cache row.
 */
export function applyJsonPointerOverlay(target: unknown, pointer: string, value: unknown): unknown {
  const segments = parseJsonPointer(pointer)
  if (segments.length === 0) {
    // Empty pointer means "replace the whole document". Allowed but
    // unusual — would only make sense when the overlay is the whole
    // content blob. The caller decides whether to support this; we
    // honor it by returning `value` unchanged.
    return value
  }

  let cursor: unknown = target
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i]!
    cursor = stepInto(cursor, segment, pointer)
  }
  const lastSegment = segments[segments.length - 1]!
  setAt(cursor, lastSegment, value, pointer)
  return target
}

function stepInto(node: unknown, segment: string, pointer: string): unknown {
  if (Array.isArray(node)) {
    const idx = parseArrayIndex(segment, pointer)
    const next = node[idx]
    if (next === undefined) {
      throw new JsonPointerError(pointer, `array index ${idx} out of range`)
    }
    return next
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>
    if (!(segment in obj)) {
      throw new JsonPointerError(pointer, `object has no key "${segment}"`)
    }
    return obj[segment]
  }
  throw new JsonPointerError(
    pointer,
    `cannot descend through non-object/array node at "${segment}"`,
  )
}

function setAt(node: unknown, segment: string, value: unknown, pointer: string): void {
  if (Array.isArray(node)) {
    const idx = parseArrayIndex(segment, pointer)
    if (idx > node.length) {
      throw new JsonPointerError(pointer, `array index ${idx} out of range (length=${node.length})`)
    }
    node[idx] = value
    return
  }
  if (node && typeof node === "object") {
    ;(node as Record<string, unknown>)[segment] = value
    return
  }
  throw new JsonPointerError(pointer, `cannot set on non-object/array node`)
}

function parseArrayIndex(segment: string, pointer: string): number {
  if (segment === "-") {
    throw new JsonPointerError(pointer, "RFC 6901 '-' (append) is not supported")
  }
  if (!/^\d+$/.test(segment)) {
    throw new JsonPointerError(pointer, `invalid array index "${segment}"`)
  }
  return Number.parseInt(segment, 10)
}

// ─────────────────────────────────────────────────────────────────────────────
// Overlay merge
// ─────────────────────────────────────────────────────────────────────────────

export interface ContentOverlay {
  /** RFC 6901 JSON pointer (`/days/3/description`, `/media/0/caption`). */
  field_path: string
  /** Override value. */
  value: unknown
}

export interface MergeOverlaysOptions {
  /**
   * Optional validator run after merging. When present, the merged
   * payload is validated; on failure, the offending overlay is logged
   * and rolled back. Set per-vertical via the content_schema_version
   * validator.
   */
  validate?: (payload: unknown) => { valid: boolean; reason?: string }
  /**
   * Failure sink. Called once per overlay that could not be applied
   * (invalid pointer, missing intermediate, validator rejection). Lets
   * the read path surface diagnostics ("overlay X failed validation")
   * to ops without corrupting the read.
   */
  onOverlayError?: (event: { overlay: ContentOverlay; reason: string }) => void
}

/**
 * Apply a list of overlays to a content payload via JSON pointers. The
 * payload is deep-cloned before mutation; the original is untouched.
 * Each overlay is applied in input order; failures are reported via
 * `onOverlayError` and the offending overlay is skipped. When a
 * validator is supplied, an overlay that produces an invalid payload is
 * rolled back and reported.
 */
export function mergeOverlaysIntoContent(
  payload: unknown,
  overlays: ReadonlyArray<ContentOverlay>,
  options: MergeOverlaysOptions = {},
): unknown {
  let merged = deepClone(payload)
  for (const overlay of overlays) {
    const before = deepClone(merged)
    try {
      merged = applyJsonPointerOverlay(merged, overlay.field_path, overlay.value)
    } catch (err) {
      options.onOverlayError?.({
        overlay,
        reason: err instanceof Error ? err.message : String(err),
      })
      merged = before
      continue
    }
    if (options.validate) {
      const result = options.validate(merged)
      if (!result.valid) {
        options.onOverlayError?.({
          overlay,
          reason: result.reason ?? "validator rejected merged payload",
        })
        merged = before
      }
    }
  }
  return merged
}

function deepClone<T>(value: T): T {
  // structuredClone is in Node 17+ and Workers; fall back to JSON if
  // not available (worse for Date / Map / Set, but our content
  // payloads are JSON-shaped).
  if (typeof structuredClone === "function") {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

// ─────────────────────────────────────────────────────────────────────────────
// Cross-worker singleflight via Postgres advisory lock
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Acquire a Postgres advisory lock keyed on
 * `content:${entityModule}:${entityId}:${locale}:${market}` and run
 * `fn`. If the lock is held by another worker, returns `null` without
 * running `fn` — the caller serves the stale row and lets the
 * lock-holder do the refresh.
 *
 * Uses session-level `pg_try_advisory_lock` + `pg_advisory_unlock`. The
 * lock is released when the function returns or throws. Caller is
 * responsible for serving stale data when this returns null.
 *
 * Cross-worker dedup is the point — in-process Map-based singleflight
 * only collapses requests inside one worker; CF Workers / multi-pod
 * deployments need DB-level coordination (see sourced-content §3.4).
 */
export async function withContentRefreshLock<T>(
  db: AnyDrizzleDb,
  options: {
    entityModule: string
    entityId: string
    locale: string
    market?: string
  },
  fn: () => Promise<T>,
): Promise<T | null> {
  const key = contentLockKey(options)
  const acquired = await tryAdvisoryLock(db, key)
  if (!acquired) return null
  try {
    return await fn()
  } finally {
    await releaseAdvisoryLock(db, key)
  }
}

function contentLockKey(options: {
  entityModule: string
  entityId: string
  locale: string
  market?: string
}): string {
  return `content:${options.entityModule}:${options.entityId}:${options.locale}:${options.market ?? "*"}`
}

async function tryAdvisoryLock(db: AnyDrizzleDb, key: string): Promise<boolean> {
  // pg_try_advisory_lock(bigint) — hash the string into a bigint. Use
  // hashtextextended which Postgres exposes for stable string hashing
  // (bigint output, not int4 like hashtext).
  const rows = await db.execute<{ locked: boolean }>(
    sql`SELECT pg_try_advisory_lock(hashtextextended(${key}, 0)) AS locked`,
  )
  // Drizzle's execute() result shape varies by driver; we accept both
  // an array-shaped result and a `.rows` wrapper.
  const first = pickFirstRow<{ locked: boolean }>(rows)
  return Boolean(first?.locked)
}

async function releaseAdvisoryLock(db: AnyDrizzleDb, key: string): Promise<void> {
  await db.execute(sql`SELECT pg_advisory_unlock(hashtextextended(${key}, 0))`)
}

function pickFirstRow<T>(result: unknown): T | undefined {
  if (Array.isArray(result)) return result[0] as T | undefined
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows: unknown }).rows
    if (Array.isArray(rows)) return rows[0] as T | undefined
  }
  return undefined
}

// ─────────────────────────────────────────────────────────────────────────────
// Content drift → invalidation predicate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the SQL predicate that matches cache rows affected by a
 * `ContentDriftEvent`. Verticals call this to scope an invalidation
 * `UPDATE … SET fresh_until = now()` against their own content table.
 *
 * Predicate semantics:
 *   - Always matches `entity_module = event.entity_module` AND
 *     `entity_id = event.entity_id`.
 *   - When `event.locale` is set, narrows to that locale only;
 *     otherwise matches all locales.
 *   - When `event.market` is set, narrows to that market only;
 *     otherwise matches all markets.
 *
 * Returned shape is a `BuiltDriftPredicate` carrying the column names
 * the vertical needs to match, plus the values. Verticals build their
 * `where(...)` clause from this; we don't import per-vertical tables
 * here.
 */
export interface BuiltDriftPredicate {
  entity_module: string
  entity_id: string
  locale: string | null
  market: string | null
}

export function buildDriftInvalidationPredicate(event: ContentDriftEvent): BuiltDriftPredicate {
  return {
    entity_module: event.entity_module,
    entity_id: event.entity_id,
    locale: event.locale ?? null,
    market: event.market ?? null,
  }
}
