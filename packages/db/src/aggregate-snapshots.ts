import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { aggregateSnapshots } from "./schema/aggregate-snapshots.js"

/**
 * A key part for {@link aggregateSnapshotKey}. `null`/`undefined` parts
 * are skipped; objects are stable-stringified (sorted keys) so the same
 * params always produce the same key regardless of property order.
 */
export type AggregateSnapshotKeyPart =
  | string
  | number
  | boolean
  | null
  | undefined
  | Record<string, unknown>

export interface ReadThroughAggregateSnapshotOptions<T> {
  /**
   * Semantic cache key, e.g. `finance:aggregates:<paramsHash>`. MUST
   * include every parameter that changes the computed result — build it
   * with {@link aggregateSnapshotKey}.
   */
  key: string
  /** Freshness window. A row older than this is recomputed in place. */
  ttlSeconds: number
  /** The (expensive) aggregate computation. Result must be JSON-serializable. */
  compute: () => Promise<T>
  /** Clock override for tests. Defaults to `() => new Date()`. */
  now?: () => Date
}

export interface AggregateSnapshotResult<T> {
  data: T
  computedAt: Date
  /** `true` when served from a fresh stored snapshot, `false` when computed live. */
  fromSnapshot: boolean
}

const MAX_INLINE_PART_LENGTH = 48

// FNV-1a 64-bit. Not cryptographic — just a compact, dependency-free,
// sync digest for long cache-key parts (collisions only risk a shared
// cache entry within the same endpoint scope).
const FNV64_OFFSET_BASIS = 0xcbf29ce484222325n
const FNV64_PRIME = 0x100000001b3n
const FNV64_MASK = 0xffffffffffffffffn

function fnv1a64Hex(input: string): string {
  let hash = FNV64_OFFSET_BASIS
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i))
    hash = (hash * FNV64_PRIME) & FNV64_MASK
  }
  return hash.toString(16).padStart(16, "0")
}

/** JSON.stringify with sorted object keys so key generation is order-stable. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`
  }
  return JSON.stringify(value) ?? "null"
}

/**
 * Builds a snapshot key by joining parts with `:`. `null`/`undefined`
 * parts are skipped; object parts are stable-stringified (sorted keys,
 * `undefined` values dropped) so `{ from, to }` and `{ to, from }` hit
 * the same snapshot. Any rendered part longer than 48 chars is replaced
 * by its FNV-1a 64-bit hex digest so keys stay short and index-friendly.
 *
 * Example: `aggregateSnapshotKey("finance", "aggregates", query)` →
 * `finance:aggregates:{"from":"2026-01-01"}` (or
 * `finance:aggregates:<hash>` for long param sets).
 */
export function aggregateSnapshotKey(...parts: AggregateSnapshotKeyPart[]): string {
  const rendered: string[] = []
  for (const part of parts) {
    if (part === null || part === undefined) continue
    const text = typeof part === "object" ? stableStringify(part) : String(part)
    rendered.push(text.length > MAX_INLINE_PART_LENGTH ? fnv1a64Hex(text) : text)
  }
  return rendered.join(":")
}

/**
 * Read-through TTL cache over the `aggregate_snapshots` table.
 *
 * Reads the row for `key`; if it is still fresh (`stale_after > now`)
 * the stored payload is returned without running `compute`. Otherwise
 * `compute()` runs and the result is upserted in a single
 * `INSERT ... ON CONFLICT (key) DO UPDATE` statement (works on
 * neon-http — no transaction required).
 *
 * The cache is strictly best-effort:
 * - a failed snapshot read (e.g. table not yet migrated) is treated as
 *   a miss — the endpoint still computes and responds;
 * - a failed upsert is swallowed — the freshly computed data is
 *   returned regardless.
 *
 * Concurrency: two concurrent cold/stale requests may both run
 * `compute()` and both upsert — that is acceptable by design (last
 * write wins, the results are equivalent fresh aggregates). There is
 * deliberately no locking or stampede protection.
 *
 * Serialization caveat: the payload round-trips through `jsonb`, so a
 * snapshot hit returns the JSON shape of `T` (e.g. `Date` fields come
 * back as ISO strings). For HTTP handlers that immediately
 * `c.json(...)` the result, the response bytes are identical either way.
 */
export async function readThroughAggregateSnapshot<T>(
  db: PostgresJsDatabase,
  options: ReadThroughAggregateSnapshotOptions<T>,
): Promise<AggregateSnapshotResult<T>> {
  const { key, ttlSeconds, compute } = options
  const now = options.now ?? (() => new Date())

  try {
    const [row] = await db
      .select()
      .from(aggregateSnapshots)
      .where(eq(aggregateSnapshots.key, key))
      .limit(1)
    if (row && row.staleAfter.getTime() > now().getTime()) {
      return { data: row.payload as T, computedAt: row.computedAt, fromSnapshot: true }
    }
  } catch {
    // Best-effort: a read failure (missing table, transient error) is a miss.
  }

  const data = await compute()
  const computedAt = now()
  const staleAfter = new Date(computedAt.getTime() + ttlSeconds * 1000)

  try {
    await db
      .insert(aggregateSnapshots)
      .values({ key, payload: data, computedAt, staleAfter })
      .onConflictDoUpdate({
        target: aggregateSnapshots.key,
        set: { payload: data, computedAt, staleAfter },
      })
  } catch {
    // Best-effort: storing the snapshot failed; serve the computed data anyway.
  }

  return { data, computedAt, fromSnapshot: false }
}
