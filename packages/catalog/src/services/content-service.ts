/**
 * Catalog content-service primitives.
 *
 * Phase C of the sourced-content architecture. This module is the runtime
 * home for per-vertical content services.
 *
 * The pure, dependency-free primitives — `isStale`, `pickBestCachedLocale`,
 * `parseJsonPointer` / `applyJsonPointerOverlay`, and
 * `mergeOverlaysIntoContent` — now live in `@voyant-travel/catalog-contracts`
 * so external adapter authors can compose and validate content payloads
 * without the catalog runtime. They are re-exported here so existing
 * `@voyant-travel/catalog` import paths stay stable.
 *
 * What remains defined here are the runtime-bound primitives that need a
 * Drizzle/Postgres connection and therefore cannot live in the contracts
 * package:
 *
 *   - `withContentRefreshLock` — Postgres advisory-lock singleflight for
 *                                cross-worker SWR refresh dedup.
 *   - `createInvalidateOnDrift` / `buildDriftInvalidationPredicate` —
 *                                content-drift → cache-invalidation against
 *                                a per-vertical `*_sourced_content` table.
 *
 * See `docs/architecture/catalog-sourced-content.md` §3.4, §3.4.1, §3.5.3,
 * §3.5.4.
 */

import type { AnyDrizzleDb } from "@voyant-travel/db"
import { and, eq, type SQL, sql } from "drizzle-orm"
import type { PgColumn, PgTable } from "drizzle-orm/pg-core"

import type { ContentDriftEvent } from "../drift/events.js"

// ─────────────────────────────────────────────────────────────────────────────
// Pure content primitives — single source of truth in @voyant-travel/catalog-contracts
// ─────────────────────────────────────────────────────────────────────────────

export {
  applyJsonPointerOverlay,
  CONTENT_ROOT_NODE_KEY,
  CONTENT_ROOT_NODE_KIND,
  type ContentLocaleMatchKind,
  type ContentLocaleResolution,
  type ContentOverlay,
  isStale,
  JsonPointerError,
  type MergeOverlaysOptions,
  mergeOverlaysIntoContent,
  parseJsonPointer,
  pickBestCachedLocale,
} from "@voyant-travel/catalog-contracts/content"

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
    // agent-quality: raw-sql reviewed -- owner: catalog; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
    sql`SELECT pg_try_advisory_lock(hashtextextended(${key}, 0)) AS locked`,
  )
  // Drizzle's execute() result shape varies by driver; we accept both
  // an array-shaped result and a `.rows` wrapper.
  const first = pickFirstRow<{ locked: boolean }>(rows)
  return Boolean(first?.locked)
}

async function releaseAdvisoryLock(db: AnyDrizzleDb, key: string): Promise<void> {
  // agent-quality: raw-sql reviewed -- owner: catalog; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
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

/**
 * Per-vertical `invalidateOnDrift(db, event)` runner. Built via
 * `createInvalidateOnDrift(table)` against the vertical's
 * `*_sourced_content` table. When a `ContentDriftEvent` fires, the
 * vertical's wired runner sets `fresh_until = now()` on every row
 * matching `(entity_module, entity_id [, locale [, market]])` so the
 * next read serves stale + schedules a SWR refresh (sourced-content
 * §3.4.1).
 */
export type InvalidateOnDrift = (
  db: AnyDrizzleDb,
  event: ContentDriftEvent,
) => Promise<{ invalidated: number }>

/**
 * Column shape every vertical's `*_sourced_content` table satisfies.
 * The factory uses these to build the WHERE clause without importing
 * per-vertical tables — keeps the catalog package neutral.
 */
export interface VerticalContentInvalidatableTable {
  entity_id: PgColumn
  locale: PgColumn
  market: PgColumn
  fresh_until: PgColumn
}

export interface CreateInvalidateOnDriftOptions {
  /**
   * Entity module this invalidator handles (e.g. `"products"`,
   * `"cruises"`). Events targeting other modules are skipped silently.
   * Templates wire one runner per vertical and dispatch by
   * `event.entity_module`.
   */
  entityModule: string
}

/**
 * Build a per-vertical `invalidateOnDrift` runner against the
 * vertical's `*_sourced_content` drizzle table. The returned function
 * is the sourced-content §3.4.1 invalidation primitive — verticals
 * subscribe their runner to the drift-event bus.
 *
 * Semantics:
 *   - Skips events whose `entity_module` doesn't match `options.entityModule`.
 *     Templates compose runners across verticals; mismatched events are
 *     not this runner's concern.
 *   - When the event scopes `locale` and/or `market`, the WHERE clause
 *     narrows accordingly. Wildcards (event.locale unset / event.market
 *     unset) match all rows for that axis — full-entity invalidation.
 *   - Returns `{ invalidated }` count for ops dashboards.
 */
export function createInvalidateOnDrift<TTable extends PgTable & VerticalContentInvalidatableTable>(
  table: TTable,
  options: CreateInvalidateOnDriftOptions,
): InvalidateOnDrift {
  return async function invalidateOnDrift(db, event) {
    if (event.entity_module !== options.entityModule) {
      return { invalidated: 0 }
    }

    const conditions: SQL[] = [eq(table.entity_id, event.entity_id)]
    if (event.locale) conditions.push(eq(table.locale, event.locale))
    if (event.market) conditions.push(eq(table.market, event.market))

    const where = conditions.length === 1 ? conditions[0]! : and(...conditions)!

    // Drizzle's update-set typing is generic over the table's
    // $inferInsert keys; the generic wrapper here narrows away those
    // keys, so we use raw SQL for the SET clause and the table reference
    // for the WHERE/RETURNING. This keeps the SQL identical to a
    // typed-call while the catalog package stays neutral about the
    // vertical's exact table schema.
    // biome-ignore lint/suspicious/noExplicitAny: see comment above -- owner: catalog; existing suppression is intentional pending typed cleanup.
    const updateBuilder: any = db.update(table)
    const result = (await updateBuilder
      .set({ fresh_until: sql`now()` })
      .where(where)
      .returning({ entity_id: table.entity_id })) as Array<{ entity_id: string }>

    return { invalidated: result.length }
  }
}

export function buildDriftInvalidationPredicate(event: ContentDriftEvent): BuiltDriftPredicate {
  return {
    entity_module: event.entity_module,
    entity_id: event.entity_id,
    locale: event.locale ?? null,
    market: event.market ?? null,
  }
}
