/**
 * SourcedEntryService — drizzle-bound entry point for the
 * `catalog_sourced_entries` store.
 *
 * One row per sourced entity, written at `discover()` time. The row carries
 * provenance, lifecycle markers, and the canonical local copy of the
 * indexed projection (so the read service and the thin-content synthesizer
 * can dispatch without round-tripping the search index).
 *
 * Three primitives:
 *
 *   - `upsertSourcedEntry` — called from `sync.ts` for every projection;
 *     idempotent on (entity_module, entity_id) and on
 *     (source_kind, source_connection_id, source_ref).
 *   - `readSourcedEntry`   — point-read by Voyant-side identity. Returns
 *     null for owned entities (which have no row here).
 *   - `createReadProvenance` — factory that composes `readSourcedEntry`
 *     with vertical-specific owned-checkers to produce a unified
 *     `readProvenance(db, entity_module, entity_id)` that returns one of:
 *     `{ kind: "owned" }`, `{ kind: "sourced", ... }`, or `null`.
 *
 * The factory pattern keeps this package neutral — it doesn't know how to
 * read the products / cruises / hotels owned tables. Each vertical
 * registers its owned-checker once when wiring its content service (Phase
 * D and beyond).
 *
 * See `docs/architecture/catalog-sourced-content.md` §2.5.
 */

import type { AnyDrizzleDb } from "@voyant-travel/db"
import { and, eq, inArray, isNull, notInArray, type SQL, sql } from "drizzle-orm"

import type { CatalogProjection } from "../adapter/contract.js"
import type { SourceFreshness } from "../contract.js"
import type { Provenance, SourceKind } from "../provenance.js"
import {
  catalogSourcedEntriesTable,
  type SelectCatalogSourcedEntry,
  type SourcedEntryStatus,
} from "../schema-sourced-entries.js"

// ─────────────────────────────────────────────────────────────────────────────
// Provenance read result
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Result of a `readProvenance` call. Three shapes:
 *
 *   - `{ kind: "owned" }`           — entity exists in the vertical's owned
 *                                     table; no sourced-entry row.
 *   - `{ kind: "sourced", ... }`    — entity is sourced; carries the durable
 *                                     provenance row + entry id.
 *   - `null`                        — entity not found in either store.
 *
 * Callers pattern-match on `kind` to dispatch owned-vs-sourced reads.
 */
export type ProvenanceReadResult =
  | { kind: "owned"; provenance: Provenance }
  | {
      kind: "sourced"
      provenance: Provenance
      entry_id: string
      status: SourcedEntryStatus
      projection: Record<string, unknown>
      projection_etag: string | null
      projection_seen_at: Date
      first_seen_at: Date
      last_seen_at: Date
    }

/**
 * Vertical-specific owned-checker. Returns `true` iff the entity exists in
 * the vertical's owned table (i.e. its id matches a row that has no source
 * link). Implementations are tiny per-vertical helpers and live in the
 * vertical package — the catalog plane doesn't import them directly.
 */
export type OwnedChecker = (db: AnyDrizzleDb, entityId: string) => Promise<boolean>

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read one sourced-entry row by Voyant-side identity. Returns `null` for
 * entities that aren't in the sourced-entry store — owned entities, or
 * sourced entities the deployment hasn't yet discovered.
 */
export async function readSourcedEntry(
  db: AnyDrizzleDb,
  entityModule: string,
  entityId: string,
): Promise<SelectCatalogSourcedEntry | null> {
  const rows = await db
    .select()
    .from(catalogSourcedEntriesTable)
    .where(
      and(
        eq(catalogSourcedEntriesTable.entity_module, entityModule),
        eq(catalogSourcedEntriesTable.entity_id, entityId),
      ),
    )
    .limit(1)
  return rows[0] ?? null
}

/**
 * Build a unified `readProvenance(db, entity_module, entity_id)` against a
 * registry of vertical-specific owned-checkers. The returned function:
 *
 *   1. Calls the vertical's owned-checker. If it returns `true`, the entity
 *      is owned — return `{ kind: "owned", provenance: ... }` without
 *      touching the sourced-entry table.
 *   2. Otherwise, look up the sourced-entry row. If found, return
 *      `{ kind: "sourced", ... }`.
 *   3. If neither, return `null`.
 *
 * Verticals not in `ownedCheckers` skip the owned check (treated as
 * sourced-only). This is intentional: not every vertical has an owned
 * counterpart for every sourced entity.
 */
export function createReadProvenance(options: {
  ownedCheckers?: ReadonlyMap<string, OwnedChecker>
}): (
  db: AnyDrizzleDb,
  entityModule: string,
  entityId: string,
) => Promise<ProvenanceReadResult | null> {
  const ownedCheckers = options.ownedCheckers ?? new Map<string, OwnedChecker>()

  return async function readProvenance(
    db: AnyDrizzleDb,
    entityModule: string,
    entityId: string,
  ): Promise<ProvenanceReadResult | null> {
    const ownedChecker = ownedCheckers.get(entityModule)
    if (ownedChecker) {
      const isOwned = await ownedChecker(db, entityId)
      if (isOwned) {
        return {
          kind: "owned",
          provenance: { source_kind: "owned", source_freshness: "static" },
        }
      }
    }

    const row = await readSourcedEntry(db, entityModule, entityId)
    if (!row) return null

    return {
      kind: "sourced",
      provenance: {
        source_kind: row.source_kind,
        source_provider: row.source_provider ?? undefined,
        source_connection_id: row.source_connection_id ?? undefined,
        source_ref: row.source_ref ?? undefined,
        source_freshness: row.source_freshness,
        last_sourced_at: row.last_sourced_at ?? undefined,
      },
      entry_id: row.id,
      status: row.status,
      projection: row.projection,
      projection_etag: row.projection_etag,
      projection_seen_at: row.projection_seen_at,
      first_seen_at: row.first_seen_at,
      last_seen_at: row.last_seen_at,
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Input for `upsertSourcedEntry`. Accepts a `CatalogProjection` (the shape
 * `discover()` emits) plus optional metadata the adapter chose not to put
 * on the projection (etag, freshness override).
 */
export interface UpsertSourcedEntryInput {
  /** The projection emitted by `adapter.discover()`. */
  projection: CatalogProjection
  /**
   * Optional ETag-style marker for the projection itself. Distinct from
   * the content cache's etag — this one stamps the indexed projection.
   */
  projectionEtag?: string
  /**
   * When the upstream said this projection was last sourced. Defaults to
   * `provenance.last_sourced_at` if set, otherwise `new Date()`.
   */
  lastSourcedAt?: Date
  /**
   * Optional override for the lifecycle status. Withdrawal sweepers set
   * this to `"withdrawn"` for rows the upstream stopped emitting.
   */
  status?: SourcedEntryStatus
}

/**
 * Upsert a sourced-entry row. Idempotent on `(entity_module, entity_id)`
 * — repeated calls update `projection`, `projection_etag`,
 * `projection_seen_at`, `last_seen_at`, `last_sourced_at`,
 * `source_freshness`, and `updated_at`. The first-seen timestamp is
 * preserved.
 *
 * Owned projections are rejected — `provenance.source_kind === "owned"`
 * has no place in the sourced-entry store. Callers in `sync.ts` should
 * already filter these out, but this guard makes the invariant explicit.
 */
export async function upsertSourcedEntry(
  db: AnyDrizzleDb,
  input: UpsertSourcedEntryInput,
): Promise<SelectCatalogSourcedEntry> {
  const { projection, projectionEtag, lastSourcedAt, status } = input
  const provenance = projection.provenance

  if (provenance.source_kind === "owned") {
    throw new Error(
      `upsertSourcedEntry called with owned provenance for ${projection.entity_module}/${projection.entity_id}; owned entities live in the vertical's owned schema, not catalog_sourced_entries`,
    )
  }

  const now = new Date()
  const stampedAt = lastSourcedAt ?? provenance.last_sourced_at ?? now

  const rows = await db
    .insert(catalogSourcedEntriesTable)
    .values({
      entity_module: projection.entity_module,
      entity_id: projection.entity_id,
      source_kind: provenance.source_kind as SourceKind,
      source_provider: provenance.source_provider ?? null,
      source_connection_id: provenance.source_connection_id ?? null,
      source_ref: provenance.source_ref ?? null,
      source_freshness: (provenance.source_freshness ?? "static") as SourceFreshness,
      last_sourced_at: stampedAt,
      status: status ?? "active",
      first_seen_at: now,
      last_seen_at: now,
      projection: projection.fields,
      projection_etag: projectionEtag ?? null,
      projection_seen_at: now,
      created_at: now,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: [catalogSourcedEntriesTable.entity_module, catalogSourcedEntriesTable.entity_id],
      set: {
        source_kind: sql`excluded.source_kind`,
        source_provider: sql`excluded.source_provider`,
        source_connection_id: sql`excluded.source_connection_id`,
        source_ref: sql`excluded.source_ref`,
        source_freshness: sql`excluded.source_freshness`,
        last_sourced_at: sql`excluded.last_sourced_at`,
        status: sql`excluded.status`,
        last_seen_at: sql`excluded.last_seen_at`,
        projection: sql`excluded.projection`,
        projection_etag: sql`excluded.projection_etag`,
        projection_seen_at: sql`excluded.projection_seen_at`,
        updated_at: sql`excluded.updated_at`,
      },
    })
    .returning()

  const row = rows[0]
  if (!row) {
    throw new Error(
      `upsertSourcedEntry returned no row for ${projection.entity_module}/${projection.entity_id}`,
    )
  }
  return row
}

/**
 * Mark a sourced-entry row as withdrawn (the upstream stopped emitting
 * it). Used by the periodic withdrawal sweeper or by drift events of kind
 * `entity_archived`. Does not delete the row — withdrawals are auditable.
 */
export async function markSourcedEntryWithdrawn(
  db: AnyDrizzleDb,
  entityModule: string,
  entityId: string,
): Promise<void> {
  const now = new Date()
  await db
    .update(catalogSourcedEntriesTable)
    .set({ status: "withdrawn", updated_at: now })
    .where(
      and(
        eq(catalogSourcedEntriesTable.entity_module, entityModule),
        eq(catalogSourcedEntriesTable.entity_id, entityId),
      ),
    )
}

/**
 * Mark active sourced rows missing from a successful full-source discovery pass
 * as withdrawn. Callers should invoke this only after an adapter completed its
 * projection stream; failed refreshes must leave existing rows untouched.
 */
export async function markMissingSourcedEntriesWithdrawn(
  db: AnyDrizzleDb,
  input: {
    entityModule: string
    sourceKind: string
    sourceConnectionId?: string | null
    seenEntityIds: ReadonlySet<string>
  },
): Promise<SelectCatalogSourcedEntry[]> {
  const conditions: SQL[] = [
    eq(catalogSourcedEntriesTable.entity_module, input.entityModule),
    eq(catalogSourcedEntriesTable.source_kind, input.sourceKind as SourceKind),
    eq(catalogSourcedEntriesTable.status, "active"),
    input.sourceConnectionId == null
      ? isNull(catalogSourcedEntriesTable.source_connection_id)
      : eq(catalogSourcedEntriesTable.source_connection_id, input.sourceConnectionId),
  ]

  const seen = [...input.seenEntityIds]
  if (seen.length > 0) {
    conditions.push(notInArray(catalogSourcedEntriesTable.entity_id, seen))
  }

  const rows = await db
    .select()
    .from(catalogSourcedEntriesTable)
    .where(and(...conditions))

  if (rows.length === 0) return []

  const now = new Date()
  await db
    .update(catalogSourcedEntriesTable)
    .set({ status: "withdrawn", updated_at: now })
    .where(
      inArray(
        catalogSourcedEntriesTable.id,
        rows.map((row) => row.id),
      ),
    )

  return rows
}
