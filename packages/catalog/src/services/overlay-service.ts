// agent-quality: file-size exception -- owner: catalog; overlay persistence, optimistic concurrency, and audit history stay co-located so all mutation paths share one transaction/concurrency implementation.
/**
 * OverlayService — drizzle-bound entry point for the catalog overlay store.
 *
 * Wraps the pure `resolveOverlay` logic (in `../overlay/resolver.ts`) with
 * the DB queries verticals actually need: fetch active overlays for an
 * entity, write a new overlay row, soft-delete an overlay, list by origin,
 * and the all-in-one `resolveEntityView` helper that fetches + resolves in
 * one call.
 *
 * Functions take an `AnyDrizzleDb` as their first parameter to match the
 * existing voyant convention (see `packages/products/src/service.ts`). Pure
 * resolver logic stays separate and remains unit-testable without a DB.
 *
 * See `docs/architecture/catalog-architecture.md` §5.2 for the design.
 */

import type { AnyDrizzleDb } from "@voyant-travel/db"
import { newId } from "@voyant-travel/db/lib/typeid"
import { withOptionalTransaction } from "@voyant-travel/db/transaction"
import { and, eq, inArray, isNull, sql } from "drizzle-orm"

import type { FieldPolicyRegistry, Visibility } from "../contract.js"
import {
  type OverlayLookup,
  type ResolvedView,
  type ResolverOverlay,
  type ResolverScope,
  resolveOverlay,
} from "../overlay/resolver.js"
import {
  catalogOverlayHistoryTable,
  catalogOverlayTable,
  OVERLAY_DEFAULT_SCOPE,
  OVERLAY_ROOT_NODE_KEY,
  OVERLAY_ROOT_NODE_KIND,
  type OverlayOrigin,
  type SelectCatalogOverlay,
  type SelectCatalogOverlayHistory,
} from "../overlay/schema.js"

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all active (not soft-deleted) overlays for an entity in one query.
 * The resolver expects this exact shape; downstream callers pass the result
 * straight into `resolveOverlay`.
 */
export async function fetchOverlaysForEntity(
  db: AnyDrizzleDb,
  entityModule: string,
  entityId: string,
): Promise<ResolverOverlay[]> {
  const rows = await db
    .select({
      field_path: catalogOverlayTable.field_path,
      node_kind: catalogOverlayTable.node_kind,
      node_key: catalogOverlayTable.node_key,
      locale: catalogOverlayTable.locale,
      audience: catalogOverlayTable.audience,
      market: catalogOverlayTable.market,
      value: catalogOverlayTable.value,
      version: catalogOverlayTable.version,
      id: catalogOverlayTable.id,
    })
    .from(catalogOverlayTable)
    .where(
      and(
        eq(catalogOverlayTable.entity_module, entityModule),
        eq(catalogOverlayTable.entity_id, entityId),
        isNull(catalogOverlayTable.deleted_at),
      ),
    )

  return rows.map((row) => ({
    field_path: row.field_path,
    node_kind: row.node_kind,
    node_key: row.node_key,
    locale: row.locale,
    audience: row.audience,
    market: row.market,
    value: row.value,
    version: row.version,
    id: row.id,
  }))
}

/**
 * Batched form of `fetchOverlaysForEntity`: fetch all active overlays for
 * many entities of one module in a single query, grouped by entity id.
 *
 * Every requested id is present in the returned map (entities without
 * overlays map to an empty array), so callers can index without null
 * checks. Pass the per-entity array straight into
 * `resolveEntityViewWithOverlays` — the result is identical to calling
 * `resolveEntityView` once per entity, minus the N-1 round trips.
 */
export async function fetchOverlaysForEntities(
  db: AnyDrizzleDb,
  entityModule: string,
  entityIds: ReadonlyArray<string>,
): Promise<Map<string, ResolverOverlay[]>> {
  const byEntity = new Map<string, ResolverOverlay[]>()
  for (const id of entityIds) {
    if (!byEntity.has(id)) byEntity.set(id, [])
  }
  if (byEntity.size === 0) return byEntity

  const rows = await db
    .select({
      entity_id: catalogOverlayTable.entity_id,
      field_path: catalogOverlayTable.field_path,
      node_kind: catalogOverlayTable.node_kind,
      node_key: catalogOverlayTable.node_key,
      locale: catalogOverlayTable.locale,
      audience: catalogOverlayTable.audience,
      market: catalogOverlayTable.market,
      value: catalogOverlayTable.value,
      version: catalogOverlayTable.version,
      id: catalogOverlayTable.id,
    })
    .from(catalogOverlayTable)
    .where(
      and(
        eq(catalogOverlayTable.entity_module, entityModule),
        inArray(catalogOverlayTable.entity_id, [...byEntity.keys()]),
        isNull(catalogOverlayTable.deleted_at),
      ),
    )

  for (const row of rows) {
    byEntity.get(row.entity_id)?.push({
      field_path: row.field_path,
      node_kind: row.node_kind,
      node_key: row.node_key,
      locale: row.locale,
      audience: row.audience,
      market: row.market,
      value: row.value,
      version: row.version,
      id: row.id,
    })
  }
  return byEntity
}

/**
 * Resolve an entity's view in one call: fetch overlays, run the resolver,
 * return the merged view filtered by the actor's visibility.
 *
 * The caller supplies the source projection (typically gathered from the
 * vertical's own service layer) and the requesting scope. Verticals call
 * this in their `getEntity` / `listEntities` paths.
 */
export async function resolveEntityView(
  db: AnyDrizzleDb,
  registry: FieldPolicyRegistry,
  entityModule: string,
  entityId: string,
  sourceProjection: ReadonlyMap<string, unknown>,
  scope: ResolverScope,
): Promise<ResolvedView> {
  const overlays = await fetchOverlaysForEntity(db, entityModule, entityId)
  return resolveOverlay(registry, sourceProjection, overlays, scope)
}

/**
 * Lower-level helper for callers that have already fetched overlays (e.g.
 * batch read-paths that pre-fetch overlays for many entities in one query).
 */
export function resolveEntityViewWithOverlays(
  registry: FieldPolicyRegistry,
  sourceProjection: ReadonlyMap<string, unknown>,
  overlays: OverlayLookup,
  scope: ResolverScope,
): ResolvedView {
  return resolveOverlay(registry, sourceProjection, overlays, scope)
}

/**
 * List overlay rows by their origin discriminator. Used by revert / re-sync
 * workflows ("show me everything Sanity wrote in the last week", "revert
 * all AI-generated overlays on this entity").
 */
export interface OverlayOriginFilter {
  kind: OverlayOrigin["kind"]
  /** Kind-specific narrowing — e.g. `provider: "sanity"` for `kind: "cms"`. */
  match?: Partial<OverlayOrigin>
}

export async function listOverlaysByOrigin(
  db: AnyDrizzleDb,
  filter: OverlayOriginFilter,
  options: { includeDeleted?: boolean; limit?: number } = {},
): Promise<SelectCatalogOverlay[]> {
  // agent-quality: raw-sql reviewed -- JSONB origin discriminator uses parameterized values; Drizzle has no helper for the `->>` JSON key predicate here.
  const conditions = [sql`${catalogOverlayTable.origin}->>'kind' = ${filter.kind}`]
  if (filter.match) {
    for (const [key, value] of Object.entries(filter.match)) {
      if (key === "kind") continue
      // agent-quality: raw-sql reviewed -- Origin match keys come from the typed overlay-origin filter and values stay parameterized.
      conditions.push(sql`${catalogOverlayTable.origin}->>${key} = ${String(value)}`)
    }
  }
  if (!options.includeDeleted) {
    // agent-quality: raw-sql reviewed -- Literal deleted_at null predicate is scoped to the overlay table.
    conditions.push(sql`${catalogOverlayTable.deleted_at} IS NULL`)
  }

  if (options.limit != null) {
    return db
      .select()
      .from(catalogOverlayTable)
      .where(and(...conditions))
      .limit(options.limit)
  }

  return db
    .select()
    .from(catalogOverlayTable)
    .where(and(...conditions))
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Input for writing a single overlay row. Variant axes default to
 * `OVERLAY_DEFAULT_SCOPE`.
 */
export interface WriteOverlayInput {
  entity_module: string
  entity_id: string
  node_kind?: string
  node_key?: string
  field_path: string
  locale?: string
  audience?: Visibility | typeof OVERLAY_DEFAULT_SCOPE
  market?: string
  value: unknown
  origin: OverlayOrigin
  expected_version?: number | null
  editorial_note?: string
}

export class OverlayVersionConflictError extends Error {
  constructor(
    public readonly currentVersion: number | null,
    public readonly expectedVersion: number | null,
  ) {
    super(
      `overlay version conflict: expected ${expectedVersion ?? "none"}, current ${
        currentVersion ?? "none"
      }`,
    )
    this.name = "OverlayVersionConflictError"
  }
}

/**
 * Write or replace an overlay row for the given variant tuple.
 *
 * If a row already exists for `(entity_module, entity_id, field_path,
 * locale, audience, market)` and is not soft-deleted, this updates its
 * value, origin, and `updated_at`. The partial unique index on the active
 * rows guarantees idempotency.
 *
 * Last-write-wins is the default conflict-resolution policy (see
 * architecture §5.2.3); per-field canonical-writer config is deferred.
 *
 * Note: this function does not validate that the field policy permits an
 * overlay write (e.g. that `merge` is not `source-only` or that the actor's
 * `editRole` matches). Callers are responsible for policy validation; the
 * service-layer caller typically wraps this with a check against the
 * vertical's `FieldPolicyRegistry`.
 */
export async function writeOverlay(
  db: AnyDrizzleDb,
  input: WriteOverlayInput,
): Promise<SelectCatalogOverlay> {
  return withOptionalTransaction(db, (tx) => writeOverlayInTransaction(tx, input))
}

async function writeOverlayInTransaction(
  db: AnyDrizzleDb,
  input: WriteOverlayInput,
): Promise<SelectCatalogOverlay> {
  const locale = input.locale ?? OVERLAY_DEFAULT_SCOPE
  const audience = input.audience ?? OVERLAY_DEFAULT_SCOPE
  const market = input.market ?? OVERLAY_DEFAULT_SCOPE
  const nodeKind = input.node_kind ?? OVERLAY_ROOT_NODE_KIND
  const nodeKey = input.node_key ?? OVERLAY_ROOT_NODE_KEY
  const existing = await findActiveOverlay(db, {
    entity_module: input.entity_module,
    entity_id: input.entity_id,
    node_kind: nodeKind,
    node_key: nodeKey,
    field_path: input.field_path,
    locale,
    audience,
    market,
  })

  if (input.expected_version !== undefined) {
    const current = existing?.version ?? null
    if (current !== input.expected_version) {
      throw new OverlayVersionConflictError(current, input.expected_version)
    }
  }

  if (existing) {
    const nextVersion = existing.version + 1
    const versionPredicate = input.expected_version ?? existing.version
    const updated = await db
      .update(catalogOverlayTable)
      .set({
        value: input.value,
        origin: input.origin,
        version: nextVersion,
        editorial_note: input.editorial_note ?? null,
        updated_at: new Date(),
      })
      .where(
        and(
          eq(catalogOverlayTable.id, existing.id),
          eq(catalogOverlayTable.version, versionPredicate),
          isNull(catalogOverlayTable.deleted_at),
        ),
      )
      .returning()
    const row = updated[0]
    if (!row) {
      const current = await findActiveOverlay(db, {
        entity_module: input.entity_module,
        entity_id: input.entity_id,
        node_kind: nodeKind,
        node_key: nodeKey,
        field_path: input.field_path,
        locale,
        audience,
        market,
      })
      throw new OverlayVersionConflictError(current?.version ?? null, versionPredicate)
    }
    await appendOverlayHistory(db, {
      row,
      action: "write",
      previous_value: existing.value,
      next_value: input.value,
      previous_version: existing.version,
      next_version: nextVersion,
      origin: input.origin,
      editorial_note: input.editorial_note,
    })
    return row
  }

  let inserted: SelectCatalogOverlay[]
  try {
    inserted = await db
      .insert(catalogOverlayTable)
      .values({
        id: newId("catalog_overlay"),
        entity_module: input.entity_module,
        entity_id: input.entity_id,
        node_kind: nodeKind,
        node_key: nodeKey,
        field_path: input.field_path,
        locale,
        audience,
        market,
        value: input.value,
        origin: input.origin,
        version: 1,
        editorial_note: input.editorial_note ?? null,
      })
      .returning()
  } catch (error) {
    if (isUniqueViolation(error)) {
      const current = await findActiveOverlay(db, {
        entity_module: input.entity_module,
        entity_id: input.entity_id,
        node_kind: nodeKind,
        node_key: nodeKey,
        field_path: input.field_path,
        locale,
        audience,
        market,
      })
      throw new OverlayVersionConflictError(
        current?.version ?? null,
        input.expected_version ?? null,
      )
    }
    throw error
  }

  const row = inserted[0]
  if (!row) throw new Error("writeOverlay: insert returned no rows")
  await appendOverlayHistory(db, {
    row,
    action: "write",
    previous_value: null,
    next_value: input.value,
    previous_version: null,
    next_version: 1,
    origin: input.origin,
    editorial_note: input.editorial_note,
  })
  return row
}

/**
 * Soft-delete an overlay row by setting `deleted_at`. The row is preserved
 * for retention / restore but no longer participates in resolver merges.
 */
export async function softDeleteOverlay(db: AnyDrizzleDb, id: string): Promise<void> {
  await withOptionalTransaction(db, async (tx) => {
    const existing = (
      await tx.select().from(catalogOverlayTable).where(eq(catalogOverlayTable.id, id)).limit(1)
    )[0]
    if (!existing) return
    const updated = await tx
      .update(catalogOverlayTable)
      .set({ deleted_at: new Date(), updated_at: new Date() })
      .where(
        and(
          eq(catalogOverlayTable.id, id),
          eq(catalogOverlayTable.version, existing.version),
          isNull(catalogOverlayTable.deleted_at),
        ),
      )
      .returning()
    const row = updated[0]
    if (!row) throw new OverlayVersionConflictError(null, existing.version)
    await appendOverlayHistory(tx, {
      row,
      action: "clear",
      previous_value: existing.value,
      next_value: null,
      previous_version: existing.version,
      next_version: existing.version,
      origin: existing.origin,
    })
  })
}

/**
 * Restore a soft-deleted overlay by clearing `deleted_at`. Used by source
 * reconnection (§5.10.5) when an entity comes back within the retention
 * window.
 */
export async function restoreOverlay(db: AnyDrizzleDb, id: string): Promise<void> {
  await withOptionalTransaction(db, async (tx) => {
    const existing = (
      await tx.select().from(catalogOverlayTable).where(eq(catalogOverlayTable.id, id)).limit(1)
    )[0]
    if (!existing) return
    const updated = await tx
      .update(catalogOverlayTable)
      .set({ deleted_at: null, updated_at: new Date() })
      .where(and(eq(catalogOverlayTable.id, id), eq(catalogOverlayTable.version, existing.version)))
      .returning()
    const row = updated[0]
    if (!row) throw new OverlayVersionConflictError(null, existing.version)
    await appendOverlayHistory(tx, {
      row,
      action: "restore",
      previous_value: null,
      next_value: existing.value,
      previous_version: existing.version,
      next_version: existing.version,
      origin: existing.origin,
    })
  })
}

interface OverlayKey {
  entity_module: string
  entity_id: string
  node_kind: string
  node_key: string
  field_path: string
  locale: string
  audience: Visibility | typeof OVERLAY_DEFAULT_SCOPE
  market: string
}

async function findActiveOverlay(
  db: AnyDrizzleDb,
  key: OverlayKey,
): Promise<SelectCatalogOverlay | null> {
  const rows = await db
    .select()
    .from(catalogOverlayTable)
    .where(
      and(
        eq(catalogOverlayTable.entity_module, key.entity_module),
        eq(catalogOverlayTable.entity_id, key.entity_id),
        eq(catalogOverlayTable.node_kind, key.node_kind),
        eq(catalogOverlayTable.node_key, key.node_key),
        eq(catalogOverlayTable.field_path, key.field_path),
        eq(catalogOverlayTable.locale, key.locale),
        eq(catalogOverlayTable.audience, key.audience),
        eq(catalogOverlayTable.market, key.market),
        isNull(catalogOverlayTable.deleted_at),
      ),
    )
    .limit(1)
  return rows[0] ?? null
}

interface AppendOverlayHistoryInput {
  row: SelectCatalogOverlay
  action: "write" | "clear" | "restore"
  previous_value: unknown
  next_value: unknown
  previous_version: number | null
  next_version: number | null
  origin: OverlayOrigin
  editorial_note?: string | null
}

async function appendOverlayHistory(
  db: AnyDrizzleDb,
  input: AppendOverlayHistoryInput,
): Promise<void> {
  await db.insert(catalogOverlayHistoryTable).values({
    id: newId("catalog_overlay"),
    overlay_id: input.row.id,
    entity_module: input.row.entity_module,
    entity_id: input.row.entity_id,
    node_kind: input.row.node_kind,
    node_key: input.row.node_key,
    field_path: input.row.field_path,
    locale: input.row.locale,
    audience: input.row.audience,
    market: input.row.market,
    action: input.action,
    previous_value: input.previous_value,
    next_value: input.next_value,
    previous_version: input.previous_version,
    next_version: input.next_version,
    origin: input.origin,
    editorial_note: input.editorial_note ?? null,
  })
}

export interface ClearOverlayByTargetInput extends OverlayKey {
  expected_version?: number | null
}

export async function clearOverlayByTarget(
  db: AnyDrizzleDb,
  input: ClearOverlayByTargetInput,
): Promise<SelectCatalogOverlay | null> {
  return withOptionalTransaction(db, (tx) => clearOverlayByTargetInTransaction(tx, input))
}

async function clearOverlayByTargetInTransaction(
  db: AnyDrizzleDb,
  input: ClearOverlayByTargetInput,
): Promise<SelectCatalogOverlay | null> {
  const existing = await findActiveOverlay(db, input)
  if (!existing) {
    if (input.expected_version !== undefined && input.expected_version !== null) {
      throw new OverlayVersionConflictError(null, input.expected_version)
    }
    return null
  }
  if (input.expected_version !== undefined && existing.version !== input.expected_version) {
    throw new OverlayVersionConflictError(existing.version, input.expected_version)
  }
  const versionPredicate = input.expected_version ?? existing.version
  const updated = await db
    .update(catalogOverlayTable)
    .set({ deleted_at: new Date(), updated_at: new Date() })
    .where(
      and(
        eq(catalogOverlayTable.id, existing.id),
        eq(catalogOverlayTable.version, versionPredicate),
        isNull(catalogOverlayTable.deleted_at),
      ),
    )
    .returning()
  const row = updated[0]
  if (!row) {
    const current = await findActiveOverlay(db, input)
    throw new OverlayVersionConflictError(current?.version ?? null, versionPredicate)
  }
  await appendOverlayHistory(db, {
    row,
    action: "clear",
    previous_value: existing.value,
    next_value: null,
    previous_version: existing.version,
    next_version: existing.version,
    origin: existing.origin,
  })
  return row
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const code = (error as { code?: unknown }).code
  if (code === "23505") return true
  const cause = (error as { cause?: unknown }).cause
  return cause ? isUniqueViolation(cause) : false
}

export async function listOverlayHistoryForTarget(
  db: AnyDrizzleDb,
  input: Partial<OverlayKey> & Pick<OverlayKey, "entity_module" | "entity_id">,
): Promise<SelectCatalogOverlayHistory[]> {
  const conditions = [
    eq(catalogOverlayHistoryTable.entity_module, input.entity_module),
    eq(catalogOverlayHistoryTable.entity_id, input.entity_id),
  ]
  if (input.node_kind) conditions.push(eq(catalogOverlayHistoryTable.node_kind, input.node_kind))
  if (input.node_key) conditions.push(eq(catalogOverlayHistoryTable.node_key, input.node_key))
  if (input.field_path) conditions.push(eq(catalogOverlayHistoryTable.field_path, input.field_path))
  if (input.locale) conditions.push(eq(catalogOverlayHistoryTable.locale, input.locale))
  if (input.audience) conditions.push(eq(catalogOverlayHistoryTable.audience, input.audience))
  if (input.market) conditions.push(eq(catalogOverlayHistoryTable.market, input.market))

  return db
    .select()
    .from(catalogOverlayHistoryTable)
    .where(and(...conditions))
}
