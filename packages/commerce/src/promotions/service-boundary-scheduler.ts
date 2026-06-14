/**
 * Promotions boundary scheduler — emits `promotion.changed` events when
 * offers cross their `valid_from` / `valid_until` boundaries since the
 * last tick.
 *
 * The catalog projection is `now()`-dependent (active offers fire at
 * `valid_from`, expire at `valid_until`). Without a scheduled trigger,
 * an indexed product document continues to show an expired discount
 * until something else reindexes it. This scheduler is what guarantees
 * the storefront eventually sees the boundary transition — within the
 * cron interval (5 min by default in the operator starter).
 *
 * Per docs/architecture/promotions-architecture.md §9.2.
 *
 * Operator starter wires this to a Cloudflare Workers cron in
 * `src/api/promotion-scheduled.ts` + `wrangler.jsonc`.
 *
 * Idempotent on retry: the scheduler's effect is "emit `promotion.changed`
 * events for crossings since `last_tick`". Re-running with the same
 * `last_tick` re-emits the same events; the catalog bridge's reindex
 * subscriber is idempotent (reindexing the same product twice is a
 * no-op modulo the eventual-consistency window).
 */

import type { EventBus } from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { and, eq, gt, lte } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  PROMOTION_CHANGED_EVENT,
  type PromotionChangedAffected,
  type PromotionChangedEvent,
  type PromotionChangedSource,
} from "./events.js"
import {
  type PromotionalOffer,
  promotionalOfferSchedulerState,
  promotionalOffers,
} from "./schema.js"
import { resolveScopeProductIds } from "./service.js"
import type { PromotionalOfferScope } from "./validation.js"

/** Sentinel value for the single-row scheduler-state table's `singleton_key`. */
const SINGLETON_KEY = "singleton" as const

export interface BoundarySchedulerOptions {
  /**
   * How far back to look on the very first tick (when no watermark row
   * exists yet). Defaults to 24h — covers same-day deployments where the
   * scheduler starts after some offers have already crossed their
   * `valid_from`. Pin to a small value if you'd rather only catch
   * forward-going crossings.
   */
  initialLookbackMs?: number
  /** Override `now()` for testing. */
  now?: () => Date
}

/**
 * One detected boundary crossing. Returned in `result.crossings` so callers
 * without an event bus (e.g., Cloudflare Workers cron handlers, where the
 * in-process bus from the running app isn't reachable) can dispatch the
 * reindex inline.
 */
export interface BoundaryCrossing {
  offerId: string
  source: PromotionChangedSource
  affected: PromotionChangedAffected
}

export interface BoundarySchedulerResult {
  /** Wall clock at the start of this tick — the new watermark. */
  tickedAt: Date
  /** Watermark used as the lower bound for the crossing scan. */
  lastTick: Date
  /** Offers crossing `valid_from` in the window — emit with source="updated". */
  validFromCrossings: number
  /** Offers crossing `valid_until` in the window — emit with source="expired". */
  validUntilCrossings: number
  /** Total events emitted to the bus when one was provided (else 0). */
  emitted: number
  /**
   * Every crossing detected this tick. Always populated — independent of
   * whether an event bus was supplied. Lets cron-style callers dispatch
   * the reindex inline when no bus is reachable.
   */
  crossings: BoundaryCrossing[]
}

export interface BoundarySchedulerDeps {
  db: AnyDrizzleDb
  eventBus?: EventBus
}

/**
 * Run a single boundary-scheduler tick. Safe to call repeatedly; the
 * watermark advances monotonically.
 */
export async function runPromotionBoundaryScheduler(
  deps: BoundarySchedulerDeps,
  options: BoundarySchedulerOptions = {},
): Promise<BoundarySchedulerResult> {
  const initialLookbackMs = options.initialLookbackMs ?? 24 * 60 * 60 * 1000
  const nowFn = options.now ?? (() => new Date())
  const tickedAt = nowFn()

  const lastTick = await readWatermark(deps.db, tickedAt, initialLookbackMs)

  // Fetch every active offer whose `valid_from` OR `valid_until` falls in
  // the (lastTick, tickedAt] window. Two passes (one per boundary) so we
  // can attribute the right `source` per emission.
  const validFromRows = await deps.db
    .select()
    .from(promotionalOffers)
    .where(
      and(
        eq(promotionalOffers.active, true),
        gt(promotionalOffers.validFrom, lastTick),
        lte(promotionalOffers.validFrom, tickedAt),
      ),
    )

  const validUntilRows = await deps.db
    .select()
    .from(promotionalOffers)
    .where(
      and(
        eq(promotionalOffers.active, true),
        gt(promotionalOffers.validUntil, lastTick),
        lte(promotionalOffers.validUntil, tickedAt),
      ),
    )

  // Resolve `affected` once per offer (each call hits the link table) so we
  // can both populate the returned `crossings[]` and feed the optional
  // event bus from the same payload.
  const validFromCrossings = await buildCrossings(deps.db, validFromRows, "updated")
  const validUntilCrossings = await buildCrossings(deps.db, validUntilRows, "expired")
  const crossings = [...validFromCrossings, ...validUntilCrossings]

  let emitted = 0
  if (deps.eventBus) {
    for (const crossing of crossings) {
      const payload: PromotionChangedEvent = {
        offerId: crossing.offerId,
        source: crossing.source,
        affected: crossing.affected,
      }
      await deps.eventBus.emit(PROMOTION_CHANGED_EVENT, payload, {
        category: "domain",
        source: "service",
      })
      emitted++
    }
  }

  await writeWatermark(deps.db, tickedAt)

  return {
    tickedAt,
    lastTick,
    validFromCrossings: validFromRows.length,
    validUntilCrossings: validUntilRows.length,
    emitted,
    crossings,
  }
}

async function buildCrossings(
  db: AnyDrizzleDb,
  offers: PromotionalOffer[],
  source: PromotionChangedSource,
): Promise<BoundaryCrossing[]> {
  const out: BoundaryCrossing[] = []
  for (const offer of offers) {
    out.push({
      offerId: offer.id,
      source,
      affected: await resolveAffected(db, offer.scope),
    })
  }
  return out
}

async function resolveAffected(
  db: AnyDrizzleDb,
  scope: PromotionalOfferScope,
): Promise<PromotionChangedAffected> {
  // `resolveScopeProductIds` is typed against `PostgresJsDatabase` to match
  // the rest of `service.ts`. The structural compatibility across drizzle
  // driver flavors makes the cast safe at runtime — only `.select(...)` is
  // used here.
  const productIds = await resolveScopeProductIds(db as PostgresJsDatabase, scope)
  if (productIds === null) return { kind: "all" }
  return { kind: "products", productIds }
}

async function readWatermark(
  db: AnyDrizzleDb,
  tickedAt: Date,
  initialLookbackMs: number,
): Promise<Date> {
  const rows = await db
    .select({ lastTick: promotionalOfferSchedulerState.lastTick })
    .from(promotionalOfferSchedulerState)
    .where(eq(promotionalOfferSchedulerState.singletonKey, SINGLETON_KEY))
    .limit(1)
  const existing = rows[0]
  if (existing) return existing.lastTick
  return new Date(tickedAt.getTime() - initialLookbackMs)
}

async function writeWatermark(db: AnyDrizzleDb, tickedAt: Date): Promise<void> {
  // Upsert keyed on the singleton sentinel — first call inserts, every
  // subsequent call advances the existing row's `last_tick`.
  //
  // Cast: `AnyDrizzleDb` is a union of three driver flavors whose
  // `.insert(...).onConflictDoUpdate(...)` return types differ at the
  // type level (NeonHttp returns a different QueryResult shape than
  // postgres-js / NeonWs). Runtime is identical — drizzle's PgDatabase
  // surface is structurally the same across drivers — so the cast is
  // safe. Same pattern as elsewhere in the workspace where service code
  // accepts the union but uses a write that only typechecks against one
  // concrete driver.
  await (db as PostgresJsDatabase)
    .insert(promotionalOfferSchedulerState)
    .values({
      singletonKey: SINGLETON_KEY,
      lastTick: tickedAt,
      updatedAt: tickedAt,
    })
    .onConflictDoUpdate({
      target: promotionalOfferSchedulerState.singletonKey,
      set: {
        lastTick: tickedAt,
        updatedAt: tickedAt,
      },
    })
}

// Exposed for tests so they can probe the watermark without recreating the SQL.
export const __test__ = { SINGLETON_KEY, readWatermark, writeWatermark }
